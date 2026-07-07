import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { RealtimeModule } from '@composition/realtime/realtime.module';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { AiJobService } from '@ai/application/ports/ai-job-service';
import { AiChatJobService } from '@ai/infrastructure/queue/ai-chat-job.service';
import { AiChatEventsSubscriber } from '@ai/infrastructure/redis/ai-chat-events.subscriber';
import { AiController } from '@ai/presentation/http/ai.controller';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';

@Module({
    imports: [AuthModule, RealtimeModule],
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
        },
        {
            provide: AiChatEventsSubscriber,
            useFactory: (notifier: AiNotificationService) => {
                return new AiChatEventsSubscriber(notifier);
            },
            inject: [AiNotificationService]
        }
    ]
})
export class AiModule {}
