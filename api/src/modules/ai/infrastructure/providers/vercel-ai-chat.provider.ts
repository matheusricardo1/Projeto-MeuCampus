import { randomUUID } from 'node:crypto';
import { APICallError, LoadAPIKeyError, generateText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI, openai } from '@ai-sdk/openai';
import type { AiChatProvider } from '@ai/application/ports/ai-chat-provider';
import type { AiChatReply } from '@ai/domain/models/ai-chat-reply';
import type { AiChatRequest } from '@ai/domain/models/ai-chat-request';
import { MockAiChatProvider } from '@ai/infrastructure/providers/mock-ai-chat.provider';
import { appLogger } from '@/shared/logging/app-logger';

export class VercelAiChatProvider implements AiChatProvider {
    private readonly fallbackProvider = new MockAiChatProvider();
    private readonly safeFailureMessage = 'Nao consegui responder agora. Tente novamente em instantes.';

    constructor() {
        if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
        }
    }

    async generateReply(request: AiChatRequest): Promise<AiChatReply> {
        const model = this.getModel();
        if (!model) {
            return this.fallbackProvider.generateReply(request);
        }

        const conversationId = request.conversationId?.trim() || randomUUID();
        const text = await this.generateProviderText(model, request);

        return {
            conversationId,
            message: {
                id: randomUUID(),
                role: 'assistant',
                content: text.trim(),
                createdAt: new Date().toISOString()
            }
        };
    }

    private getModel(): LanguageModel | null {
        if (process.env.GEMINI_API_KEY) {
            const gemini = createGoogleGenerativeAI({
                apiKey: process.env.GEMINI_API_KEY
            });

            return gemini(process.env.GEMINI_AI_MODEL || 'gemini-2.5-flash');
        }

        if (process.env.DEEP_SEEK_AI_API_KEY) {
            const deepSeek = createOpenAI({
                apiKey: process.env.DEEP_SEEK_AI_API_KEY,
                baseURL: process.env.DEEP_SEEK_AI_BASE_URL || 'https://api.deepseek.com',
                name: 'deepseek'
            });

            return deepSeek.chat(process.env.DEEP_SEEK_AI_MODEL || 'deepseek-v4-flash');
        }

        if (process.env.OPENAI_API_KEY) {
            return openai(process.env.AI_CHAT_MODEL || 'gpt-4o-mini');
        }

        return null;
    }

    private async generateProviderText(model: LanguageModel, request: AiChatRequest): Promise<string> {
        try {
            const { text } = await generateText({
                model,
                system: this.buildSystemPrompt(),
                messages: this.buildMessages(request)
            });

            return text;
        } catch (error) {
            return this.handleGenerationError(error);
        }
    }

    private handleGenerationError(error: unknown): string {
        if (LoadAPIKeyError.isInstance(error) || this.isLoadApiKeyError(error)) {
            appLogger.error('AI provider API key is missing or invalid.', this.getErrorContext(error));
            return this.safeFailureMessage;
        }

        if (APICallError.isInstance(error)) {
            appLogger.error('AI provider request failed.', this.getErrorContext(error));
            return this.safeFailureMessage;
        }

        appLogger.error('Unexpected AI chat generation error.', this.getErrorContext(error));
        return this.safeFailureMessage;
    }

    private getErrorContext(error: unknown): Record<string, unknown> {
        if (APICallError.isInstance(error)) {
            return {
                statusCode: error.statusCode,
                errorName: error.name,
                message: error.message,
                isRetryable: error.isRetryable
            };
        }

        if (error instanceof Error) {
            return {
                errorName: error.name,
                message: error.message
            };
        }

        return {
            errorName: 'UnknownError',
            message: String(error)
        };
    }

    private isLoadApiKeyError(error: unknown): boolean {
        return error instanceof Error && error.name === 'AI_LoadAPIKeyError';
    }

    private buildSystemPrompt(): string {
        return [
            'Voce e o assistente academico do Meu Campus.',
            'Responda em portugues brasileiro, com tom claro, calmo e objetivo.',
            'Ajude o aluno a entender notas, prazos, horarios, faltas e planejamento de estudos.',
            'Se nao houver dados suficientes, diga exatamente quais dados faltam e ofereca um proximo passo util.',
            'Nao invente dados academicos.'
        ].join(' ');
    }

    private buildMessages(request: AiChatRequest): ModelMessage[] {
        const history = request.history.map((message): ModelMessage => ({
            role: message.role === 'system' ? 'system' : message.role,
            content: message.content
        }));

        return [
            ...history,
            {
                role: 'user',
                content: request.message
            } satisfies ModelMessage
        ];
    }
}
