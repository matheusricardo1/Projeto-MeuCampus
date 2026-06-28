import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { AiJobService } from '@ai/application/ports/ai-job-service';
import { AiChatJobService } from '@ai/infrastructure/queue/ai-chat-job.service';
import { AiController } from '@ai/presentation/http/ai.controller';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';

@Module({
    imports: [AuthModule],
    controllers: [AiController],
    providers: [
        AiAuthGuard,
        AiChatJobService,
        { provide: AiJobService, useExisting: AiChatJobService },
        {
            provide: SendAiChatMessageUseCase,
            useFactory: (aiJobService: AiJobService) => {
                return new SendAiChatMessageUseCase(aiJobService);
            },
            inject: [AiJobService]
        }
    ]
})
export class AiModule {}
