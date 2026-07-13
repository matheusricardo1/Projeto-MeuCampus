import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { RealtimeModule } from '@composition/realtime/realtime.module';
import { BillingModule } from '@billing/billing.module';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { CancelAiChatMessageUseCase } from '@ai/application/use-cases/cancel-ai-chat-message.usecase';
import { AiJobService } from '@ai/application/ports/ai-job-service';
import { AiChatJobService } from '@ai/infrastructure/queue/ai-chat-job.service';
import { AiChatCancelPublisher } from '@ai/infrastructure/redis/ai-chat-cancel.publisher';
import { AiChatEventsSubscriber } from '@ai/infrastructure/redis/ai-chat-events.subscriber';
import { AiQuotaService } from '@ai/infrastructure/redis/ai-quota.service';
import { AiController } from '@ai/presentation/http/ai.controller';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';
import { AiQuotaGuard } from '@ai/presentation/http/guards/ai-quota.guard';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';
import { AiUsageRepository } from '@billing/infrastructure/prisma/ai-usage.repository';

@Module({
    imports: [AuthModule, RealtimeModule, BillingModule],
    controllers: [AiController],
    providers: [
        AiAuthGuard,
        AiQuotaGuard,
        AiQuotaService,
        AiChatCancelPublisher,
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
            provide: CancelAiChatMessageUseCase,
            useFactory: (aiJobService: AiJobService) => {
                return new CancelAiChatMessageUseCase(aiJobService);
            },
            inject: [AiJobService]
        },
        {
            provide: AiChatEventsSubscriber,
            useFactory: (notifier: AiNotificationService, aiUsageRepository: AiUsageRepository) => {
                return new AiChatEventsSubscriber(notifier, aiUsageRepository);
            },
            inject: [AiNotificationService, AiUsageRepository]
        }
    ]
})
export class AiModule {}
