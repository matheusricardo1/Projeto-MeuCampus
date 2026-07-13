import { AiUsageRepository } from '@billing/infrastructure/prisma/ai-usage.repository';
import { GEMINI_FLASH_FREE_TIER_LIMITS } from '@billing/domain/services/ai-rate-limits';

export interface HourlyAiUsagePoint {
    hour: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
}

export interface AiUsageTodayResult {
    hourly: HourlyAiUsagePoint[];
    totals: {
        requests: number;
        inputTokens: number;
        outputTokens: number;
    };
    freeTierLimits: {
        rpm: number;
        tpm: number;
        rpd: number;
    };
}

export class GetAiUsageTodayUseCase {
    constructor(private readonly aiUsageRepository: AiUsageRepository) {}

    async execute(): Promise<AiUsageTodayResult> {
        const buckets = await this.aiUsageRepository.listHourlyUsageToday();

        const totals = buckets.reduce(
            (acc, bucket) => ({
                requests: acc.requests + bucket.requests,
                inputTokens: acc.inputTokens + bucket.inputTokens,
                outputTokens: acc.outputTokens + bucket.outputTokens
            }),
            { requests: 0, inputTokens: 0, outputTokens: 0 }
        );

        return {
            hourly: buckets.map((bucket) => ({
                hour: bucket.hour.toISOString(),
                requests: bucket.requests,
                inputTokens: bucket.inputTokens,
                outputTokens: bucket.outputTokens
            })),
            totals,
            freeTierLimits: GEMINI_FLASH_FREE_TIER_LIMITS
        };
    }
}
