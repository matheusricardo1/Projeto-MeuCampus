import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { AiUsageRepository } from '@billing/infrastructure/prisma/ai-usage.repository';
import { calculateTotalCostCents } from '@billing/domain/services/ai-token-pricing';
import { LiveUserCounter } from '@admin/application/ports/live-user-counter';

export interface AdminMetrics {
    liveUsers: number;
    paidUsers: number;
    revenueCents: {
        total: number;
        thisMonth: number;
    };
    aiUsage: {
        inputTokens: number;
        outputTokens: number;
        costCents: number;
    };
    profitCents: number;
}

export class GetAdminMetricsUseCase {
    constructor(
        private readonly userPlanRepository: UserPlanRepository,
        private readonly aiUsageRepository: AiUsageRepository,
        private readonly liveUserCounter: LiveUserCounter
    ) {}

    async execute(): Promise<AdminMetrics> {
        const [paidUsers, revenueTotalCents, revenueThisMonthCents, usageByModel] = await Promise.all([
            this.userPlanRepository.countActivePaidUsers(),
            this.userPlanRepository.sumRevenueCents(),
            this.userPlanRepository.sumRevenueCents(this.startOfMonth()),
            this.aiUsageRepository.sumTokensByModel()
        ]);

        const aiCostCents = calculateTotalCostCents(usageByModel);
        const inputTokens = usageByModel.reduce((sum, usage) => sum + usage.inputTokens, 0);
        const outputTokens = usageByModel.reduce((sum, usage) => sum + usage.outputTokens, 0);

        return {
            liveUsers: this.liveUserCounter.countLiveUsers(),
            paidUsers,
            revenueCents: {
                total: revenueTotalCents,
                thisMonth: revenueThisMonthCents
            },
            aiUsage: {
                inputTokens,
                outputTokens,
                costCents: aiCostCents
            },
            profitCents: revenueTotalCents - aiCostCents
        };
    }

    private startOfMonth(): Date {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
}
