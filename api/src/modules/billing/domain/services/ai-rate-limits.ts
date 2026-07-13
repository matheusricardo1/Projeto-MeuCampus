/**
 * Gemini 2.5 Flash's free-tier quota (the model the AI worker defaults to —
 * see workers/ai/src/infrastructure/providers/ai-chat.provider.ts). These
 * come from the actual project's quota page (Google AI Studio / Firebase),
 * not the generically published defaults — a Firebase-linked project can
 * have a lower shared quota than a bare API-key project. Override via env if
 * the quota changes (e.g. after requesting a bump).
 */
export const GEMINI_FLASH_FREE_TIER_LIMITS = {
    rpm: Number(process.env.GEMINI_FREE_TIER_RPM) || 5,
    tpm: Number(process.env.GEMINI_FREE_TIER_TPM) || 250_000,
    rpd: Number(process.env.GEMINI_FREE_TIER_RPD) || 20
};
