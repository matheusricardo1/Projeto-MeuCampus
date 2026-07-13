import { Module } from '@nestjs/common';
import { BillingModule } from '@billing/billing.module';
import { RealtimeModule } from '@composition/realtime/realtime.module';
import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { AiUsageRepository } from '@billing/infrastructure/prisma/ai-usage.repository';
import { LiveUserCounter } from '@admin/application/ports/live-user-counter';
import { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';
import { AdminLoginUseCase } from '@admin/application/use-cases/admin-login.usecase';
import { GetAdminMetricsUseCase } from '@admin/application/use-cases/get-admin-metrics.usecase';
import { GetAiUsageTodayUseCase } from '@admin/application/use-cases/get-ai-usage-today.usecase';
import { AdminAuthGuard } from '@admin/presentation/http/guards/admin-auth.guard';
import { AdminController } from '@admin/presentation/http/admin.controller';

@Module({
    imports: [BillingModule, RealtimeModule],
    controllers: [AdminController],
    providers: [
        AdminJwtService,
        AdminAuthGuard,
        {
            provide: AdminLoginUseCase,
            useFactory: (adminJwtService: AdminJwtService) => new AdminLoginUseCase(adminJwtService),
            inject: [AdminJwtService]
        },
        {
            provide: GetAdminMetricsUseCase,
            useFactory: (userPlanRepository: UserPlanRepository, aiUsageRepository: AiUsageRepository, liveUserCounter: LiveUserCounter) =>
                new GetAdminMetricsUseCase(userPlanRepository, aiUsageRepository, liveUserCounter),
            inject: [UserPlanRepository, AiUsageRepository, LiveUserCounter]
        },
        {
            provide: GetAiUsageTodayUseCase,
            useFactory: (aiUsageRepository: AiUsageRepository) => new GetAiUsageTodayUseCase(aiUsageRepository),
            inject: [AiUsageRepository]
        }
    ]
})
export class AdminModule {}
