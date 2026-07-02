import { randomUUID } from 'node:crypto';
import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { InternalSecretGuard } from '@mcp/guards/internal-secret.guard';
import { createAcademicMcpServer } from '@mcp/infrastructure/academic-mcp.server';

@Controller('mcp')
@UseGuards(InternalSecretGuard)
export class McpController {
    constructor(private readonly academicDataRepository: AcademicDataRepository) {}

    @Post()
    async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
        const userId = req.headers['x-mcp-user-id'] as string | undefined;
        if (!userId) {
            res.status(400).json({ error: 'Missing x-mcp-user-id header.' });
            return;
        }

        const server = createAcademicMcpServer(userId, this.academicDataRepository);
        // sessionIdGenerator generates a fresh ID per request (stateless — no stored session)
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID()
        });

        try {
            // exactOptionalPropertyTypes workaround — SDK Transport type has optional fields
            // typed as T | undefined which conflicts with the strict TS config
            await server.connect(transport as never);
            await transport.handleRequest(req, res, req.body as Record<string, unknown>);
        } finally {
            await transport.close();
            await server.close();
        }
    }
}
