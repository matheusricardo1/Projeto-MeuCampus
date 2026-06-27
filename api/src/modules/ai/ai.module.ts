import { Module } from '@nestjs/common';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { AiJobService } from '@ai/application/ports/ai-job-service';
import { AiChatJobService } from '@ai/application/services/ai-chat-job.service';
import { AiController } from '@ai/presentation/http/ai.controller';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { AcademicSessionRegistry } from '@academic/application/ports/academic-session-registry';
import { EcampusSessionRegistry } from '@ecampus/infrastructure/redis/ecampus-session-registry';

@Module({
    controllers: [AiController],
    providers: [
        JwtAccessTokenService,
        EcampusSessionRegistry,
        AiAuthGuard,
        AiChatJobService,
        { provide: AcademicSessionRegistry, useExisting: EcampusSessionRegistry },
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
