import { afterEach, describe, expect, it } from 'vitest';
import { calculateCostCents, calculateTotalCostCents } from '@billing/domain/services/ai-token-pricing';

describe('calculateCostCents', () => {
    const ORIGINAL_RATE = process.env.USD_BRL_RATE;

    afterEach(() => {
        if (ORIGINAL_RATE === undefined) {
            delete process.env.USD_BRL_RATE;
        } else {
            process.env.USD_BRL_RATE = ORIGINAL_RATE;
        }
    });

    it('computes cost using the known gemini price table at a fixed USD/BRL rate', () => {
        process.env.USD_BRL_RATE = '5';
        // 1,000,000 input tokens @ $0.30/1M + 1,000,000 output tokens @ $2.50/1M = $2.80 -> R$14.00 -> 1400 cents
        const cost = calculateCostCents({ provider: 'gemini', inputTokens: 1_000_000, outputTokens: 1_000_000 });
        expect(cost).toBe(1400);
    });

    it('returns 0 for zero token usage', () => {
        expect(calculateCostCents({ provider: 'gemini', inputTokens: 0, outputTokens: 0 })).toBe(0);
    });

    it('scales linearly with token count (at a scale large enough to avoid cent-rounding noise)', () => {
        process.env.USD_BRL_RATE = '5';
        const small = calculateCostCents({ provider: 'openai', inputTokens: 1_000_000, outputTokens: 0 });
        const large = calculateCostCents({ provider: 'openai', inputTokens: 10_000_000, outputTokens: 0 });
        expect(large).toBe(small * 10);
    });

    it('uses a fallback price for an unknown provider instead of throwing', () => {
        expect(() => calculateCostCents({ provider: 'some-future-provider', inputTokens: 1000, outputTokens: 1000 })).not.toThrow();
        expect(calculateCostCents({ provider: 'some-future-provider', inputTokens: 1000, outputTokens: 1000 })).toBeGreaterThan(0);
    });

    it('falls back to a default USD/BRL rate when the env var is missing or invalid', () => {
        delete process.env.USD_BRL_RATE;
        const withDefault = calculateCostCents({ provider: 'gemini', inputTokens: 1_000_000, outputTokens: 0 });

        process.env.USD_BRL_RATE = 'not-a-number';
        const withInvalid = calculateCostCents({ provider: 'gemini', inputTokens: 1_000_000, outputTokens: 0 });

        expect(withDefault).toBeGreaterThan(0);
        expect(withInvalid).toBe(withDefault);
    });
});

describe('calculateTotalCostCents', () => {
    it('sums cost across multiple provider buckets', () => {
        process.env.USD_BRL_RATE = '5';
        const geminiOnly = calculateCostCents({ provider: 'gemini', inputTokens: 1_000_000, outputTokens: 0 });
        const openaiOnly = calculateCostCents({ provider: 'openai', inputTokens: 1_000_000, outputTokens: 0 });

        const total = calculateTotalCostCents([
            { provider: 'gemini', inputTokens: 1_000_000, outputTokens: 0 },
            { provider: 'openai', inputTokens: 1_000_000, outputTokens: 0 }
        ]);

        expect(total).toBe(geminiOnly + openaiOnly);
    });

    it('returns 0 for an empty usage list', () => {
        expect(calculateTotalCostCents([])).toBe(0);
    });
});
