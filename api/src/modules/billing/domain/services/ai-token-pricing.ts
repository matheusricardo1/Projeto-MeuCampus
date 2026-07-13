/**
 * USD price per 1M tokens for each provider/model the AI worker can pick
 * (see workers/ai/src/infrastructure/providers/ai-chat.provider.ts). Prices
 * are the providers' public list prices at the time this was written — they
 * drift over time, there's no live pricing API to pull from, so this needs a
 * manual bump if a provider changes rates or the worker's default model env
 * vars point at a different tier.
 */
const PRICE_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
    gemini: { input: 0.3, output: 2.5 },
    deepseek: { input: 0.27, output: 1.1 },
    openai: { input: 0.15, output: 0.6 }
};

const FALLBACK_PRICE = { input: 0.5, output: 1.5 };

// No live FX API wired up — a fixed rate kept in an env var is close enough
// for a cost/profit estimate and avoids adding an external dependency.
function usdToBrlRate(): number {
    const configured = Number(process.env.USD_BRL_RATE);
    return Number.isFinite(configured) && configured > 0 ? configured : 5.5;
}

export interface AiUsageForPricing {
    provider: string;
    inputTokens: number;
    outputTokens: number;
}

/** Cost in BRL cents for a single provider/model's aggregated token usage. */
export function calculateCostCents(usage: AiUsageForPricing): number {
    const price = PRICE_PER_MILLION_TOKENS_USD[usage.provider] ?? FALLBACK_PRICE;
    const usd = (usage.inputTokens / 1_000_000) * price.input + (usage.outputTokens / 1_000_000) * price.output;

    return Math.round(usd * usdToBrlRate() * 100);
}

/** Sums cost across multiple provider/model buckets (e.g. from a groupBy query). */
export function calculateTotalCostCents(usages: AiUsageForPricing[]): number {
    return usages.reduce((total, usage) => total + calculateCostCents(usage), 0);
}
