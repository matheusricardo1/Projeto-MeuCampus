import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { AiChatMessage } from '@/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/domain/entities/ai-chat-reply';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';
import { waitForAiReply } from '@/infrastructure/realtime/ecampus-realtime-client';

export interface SendAiChatMessageInput {
    conversationId?: string;
    message: string;
    history?: AiChatMessage[];
}

export class SendAiChatMessageUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(input: SendAiChatMessageInput): Promise<AiChatReply> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();

        const { jobId } = await this.repository.sendAiChatMessage(session.accessToken, input);
        return waitForAiReply(jobId);
    }
}
