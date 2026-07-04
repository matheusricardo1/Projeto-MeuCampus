import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { jsonSchema } from 'ai';
import type { ToolSet } from 'ai';

export class McpClientManager {
    private readonly serverUrls: string[];
    private readonly internalSecret: string;

    constructor() {
        const raw = process.env.MCP_SERVER_URLS ?? '';
        this.serverUrls = raw.split(',').map((u) => u.trim()).filter(Boolean);
        this.internalSecret = process.env.INTERNAL_API_SECRET ?? '';
    }

    async buildTools(userId: string): Promise<ToolSet> {
        if (this.serverUrls.length === 0) {
            return {};
        }

        const allTools: ToolSet = {};

        await Promise.all(
            this.serverUrls.map((url) => this.collectToolsFromServer(url, userId, allTools))
        );

        return allTools;
    }

    private async collectToolsFromServer(
        serverUrl: string,
        userId: string,
        target: ToolSet
    ): Promise<void> {
        const client = new Client({ name: 'ai-worker', version: '1.0.0' });
        const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
            requestInit: {
                headers: {
                    'x-internal-secret': this.internalSecret,
                    'x-mcp-user-id': userId
                }
            }
        });

        try {
            // exactOptionalPropertyTypes workaround — SDK Transport type has optional fields
            // typed as T | undefined which conflicts with the strict TS config
            await client.connect(transport as never);
            const { tools: mcpTools } = await client.listTools();

            for (const mcpTool of mcpTools) {
                const capturedClient = client;
                const toolName = mcpTool.name;
                const schema = jsonSchema<Record<string, unknown>>(
                    mcpTool.inputSchema as Parameters<typeof jsonSchema>[0]
                );

                // Double-cast through unknown: tool() helper doesn't compose well with
                // jsonSchema() under exactOptionalPropertyTypes, so we construct directly.
                target[toolName] = {
                    description: mcpTool.description ?? '',
                    inputSchema: schema,
                    execute: async (args: Record<string, unknown>): Promise<string> => {
                        const result = await capturedClient.callTool({
                            name: toolName,
                            arguments: args
                        });

                        const content = result.content as Array<{ type: string; text?: string }>;
                        return content
                            .filter((c) => c.type === 'text')
                            .map((c) => c.text ?? '')
                            .join('\n');
                    }
                } as unknown as ToolSet[string];
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[McpClientManager] Failed to load tools from ${serverUrl}: ${message}`);
        } finally {
            await client.close().catch(() => undefined);
        }
    }
}
