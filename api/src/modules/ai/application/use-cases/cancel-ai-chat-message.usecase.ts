import { InvalidAiMessageException } from '@ai/domain/exceptions/invalid-ai-message.exception';
import { AiJobService } from '@ai/application/ports/ai-job-service';

export class CancelAiChatMessageUseCase {
    constructor(private readonly aiJobService: AiJobService) {}

    async execute(jobId: string): Promise<void> {
        if (!jobId?.trim()) {
            throw new InvalidAiMessageException('Informe o jobId da mensagem a cancelar.');
        }

        await this.aiJobService.cancel(jobId.trim());
    }
}
