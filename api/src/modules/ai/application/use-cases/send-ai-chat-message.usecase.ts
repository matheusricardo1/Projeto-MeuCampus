import { randomUUID } from 'node:crypto';
import { InvalidAiMessageError } from '@ai/domain/errors/invalid-ai-message.error';
import type { AiChatMessage } from '@ai/domain/models/ai-chat-message';
import type { AiChatReply } from '@ai/domain/models/ai-chat-reply';
import { AiJobService } from '@ai/application/ports/ai-job-service';

export interface SendAiChatMessageInput {
    conversationId?: string;
    message: string;
    history?: AiChatMessage[];
}

export class SendAiChatMessageUseCase {
    constructor(private readonly aiJobService: AiJobService) {}

    async execute(userId: string, input: SendAiChatMessageInput): Promise<AiChatReply> {
        const history = this.parseHistory(input.history);
        const message = this.parseMessage(input.message, history);
        const job = await this.aiJobService.enqueue({
            userId,
            message,
            history,
            ...(input.conversationId ? { conversationId: input.conversationId } : {})
        });

        return job.waitUntilFinished(this.aiJobService.getQueueEvents(), 30000) as Promise<AiChatReply>;
    }

    private parseMessage(value: string, history: AiChatMessage[]): string {
        const message = value?.trim();
        if (!message || message.length > 2000) {
            throw new InvalidAiMessageError('Informe uma mensagem entre 1 e 2000 caracteres.');
        }

        if (this.hasPromptInjection(message)) {
            throw new InvalidAiMessageError('Nao posso processar pedidos para ignorar regras, revelar prompts ou burlar protecoes.');
        }

        if (this.isClearlyOutOfScope(message) && !this.hasAcademicContext(history)) {
            throw new InvalidAiMessageError('A IA responde apenas perguntas relacionadas a estudos, vida academica, notas, faltas, horarios e planejamento.');
        }

        return message;
    }

    private parseHistory(value?: AiChatMessage[]): AiChatMessage[] {
        if (!value) return [];
        if (!Array.isArray(value)) return [];

        return value
            .filter((message) => {
                return message
                    && ['user', 'assistant'].includes(message.role)
                    && typeof message.content === 'string'
                    && message.content.trim().length > 0;
            })
            .slice(-12)
            .map((message) => ({
                id: String(message.id || randomUUID()),
                role: message.role,
                content: this.sanitizeHistoryContent(message.content),
                createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString()
            }));
    }

    private sanitizeHistoryContent(value: string): string {
        return value
            .trim()
            .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
            .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [TOKEN_REMOVIDO]')
            .slice(0, 1500);
    }

    private hasPromptInjection(message: string): boolean {
        const normalized = message.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const blockedPatterns = [
            /ignore (as )?(instrucoes|regras|system|prompt)/,
            /ignore previous/,
            /revel(e|ar).*(prompt|system|instrucoes|regras)/,
            /mostr(e|ar).*(prompt|system|instrucoes|regras)/,
            /bypass|jailbreak|developer message|system prompt/,
            /aja como.*sem regras/,
            /desative.*(seguranca|guardrail|filtro)/
        ];

        return blockedPatterns.some((pattern) => pattern.test(normalized));
    }

    private isAcademicScope(message: string): boolean {
        const normalized = message.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const academicTerms = [
            'nota',
            'falt',
            'frequencia',
            'aula',
            'horario',
            'materia',
            'disciplina',
            'periodo',
            'semestre',
            'curso',
            'professor',
            'prova',
            'trabalho',
            'atividade',
            'plano de ensino',
            'estudo',
            'estudar',
            'academ',
            'universidade',
            'ufam',
            'cra',
            'media',
            'reprov',
            'aprov'
        ];

        return academicTerms.some((term) => normalized.includes(term));
    }

    private hasAcademicContext(history: AiChatMessage[]): boolean {
        return history.some((message) => this.isAcademicScope(message.content));
    }

    private isClearlyOutOfScope(message: string): boolean {
        if (this.isAcademicScope(message)) {
            return false;
        }

        const normalized = message.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const outOfScopePatterns = [
            /\b(futebol|partida|campeonato|nba|ufc|formula 1|corrida)\b/,
            /\b(namoro|relacionamento|tinder|crush)\b/,
            /\b(receita|cozinhar|bolo|jantar|almoco)\b/,
            /\b(investimento|acao|bitcoin|criptomoeda|day trade)\b/,
            /\b(advogado|processo|crime|ilegal|fraude fiscal)\b/,
            /\b(doenca|diagnostico|remedio|dosagem|tratamento medico)\b/,
            /\b(prompt|system prompt|developer message|jailbreak|bypass)\b/
        ];

        return outOfScopePatterns.some((pattern) => pattern.test(normalized));
    }
}
