import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';

export interface RecordAiUsageInput {
    userId: string;
    jobId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}

export interface AiUsageTotals {
    inputTokens: number;
    outputTokens: number;
}

export interface HourlyAiUsageBucket {
    hour: Date;
    requests: number;
    inputTokens: number;
    outputTokens: number;
}

interface HourlyAiUsageRow {
    hour: Date;
    requests: bigint;
    inputTokens: bigint;
    outputTokens: bigint;
}

@Injectable()
export class AiUsageRepository {
    constructor(private readonly prisma: PrismaService) {}

    async record(input: RecordAiUsageInput): Promise<void> {
        await this.prisma.aiUsage.create({ data: input });
    }

    async sumTokens(since?: Date): Promise<AiUsageTotals> {
        const result = await this.prisma.aiUsage.aggregate({
            ...(since ? { where: { createdAt: { gte: since } } } : {}),
            _sum: { inputTokens: true, outputTokens: true }
        });

        return {
            inputTokens: result._sum?.inputTokens ?? 0,
            outputTokens: result._sum?.outputTokens ?? 0
        };
    }

    /** Grouped by provider+model so cost can be computed per pricing tier. */
    async sumTokensByModel(since?: Date): Promise<Array<{ provider: string; model: string; inputTokens: number; outputTokens: number }>> {
        const rows = await this.prisma.aiUsage.groupBy({
            by: ['provider', 'model'],
            ...(since ? { where: { createdAt: { gte: since } } } : {}),
            _sum: { inputTokens: true, outputTokens: true }
        });

        return rows.map((row) => ({
            provider: row.provider,
            model: row.model,
            inputTokens: row._sum?.inputTokens ?? 0,
            outputTokens: row._sum?.outputTokens ?? 0
        }));
    }

    /**
     * One bucket per hour of the current UTC day, including empty hours (0
     * requests) up to the current hour — the chart needs the gaps to read
     * correctly, not just the hours that happen to have data.
     */
    async listHourlyUsageToday(): Promise<HourlyAiUsageBucket[]> {
        const startOfDay = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

        const rows = await this.prisma.$queryRaw<HourlyAiUsageRow[]>`
            SELECT
                date_trunc('hour', "createdAt") AS hour,
                COUNT(*) AS requests,
                COALESCE(SUM("inputTokens"), 0) AS "inputTokens",
                COALESCE(SUM("outputTokens"), 0) AS "outputTokens"
            FROM "AiUsage"
            WHERE "createdAt" >= ${startOfDay}
            GROUP BY 1
            ORDER BY 1
        `;

        const byHour = new Map(rows.map((row) => [row.hour.getUTCHours(), row]));
        const currentHour = new Date().getUTCHours();

        return Array.from({ length: currentHour + 1 }, (_, hourOfDay) => {
            const row = byHour.get(hourOfDay);
            return {
                hour: new Date(startOfDay.getTime() + hourOfDay * 60 * 60 * 1000),
                requests: row ? Number(row.requests) : 0,
                inputTokens: row ? Number(row.inputTokens) : 0,
                outputTokens: row ? Number(row.outputTokens) : 0
            };
        });
    }
}
