import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';
import { waitForAiReply } from '@/modules/academic/infrastructure/realtime/ecampus-realtime-client';

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
