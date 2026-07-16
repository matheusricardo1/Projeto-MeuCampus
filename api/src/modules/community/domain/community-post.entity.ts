export const COMMUNITY_CATEGORIES = [
    // Ajudar a comunidade (crowdsourcing em tempo real)
    'BOLSA', 'ENERGIA', 'FILA_RU',
    // Mercado
    'COMIDAS', 'ALUGUEIS', 'TROCAS_VENDAS',
    // Divulgação
    'EVENTOS', 'PALESTRAS', 'FORMATURAS', 'ACHADOS_PERDIDOS',
    // Oportunidades
    'EMPREGOS', 'ESTAGIO', 'PESQUISA'
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export function isCommunityCategory(value: unknown): value is CommunityCategory {
    return typeof value === 'string' && (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

/** Category-specific structured fields, persisted as JSON alongside the free-text body. */
export type CommunityPayload = Record<string, unknown>;

export interface CommunityPost {
    id: string;
    authorId: string;
    authorName: string;
    category: CommunityCategory;
    body: string;
    payload: CommunityPayload | null;
    confirmCount: number;
    createdAt: Date;
}

export interface CreateCommunityPostInput {
    authorId: string;
    authorName: string;
    category: CommunityCategory;
    body: string;
    payload?: CommunityPayload | null;
}

/**
 * How far back each category's feed reaches. Real-time signals (fila do RU,
 * energia) go stale fast, so they use a short window; "a bolsa caiu?" stays
 * relevant for a few days.
 */
export const COMMUNITY_FEED_WINDOW_HOURS: Record<CommunityCategory, number> = {
    // Real-time signals go stale fast.
    BOLSA: 72,
    ENERGIA: 12,
    FILA_RU: 6,
    // Marketplace / listings stay relevant for days to weeks.
    COMIDAS: 48,
    ALUGUEIS: 24 * 30,
    TROCAS_VENDAS: 24 * 21,
    EVENTOS: 24 * 30,
    PALESTRAS: 24 * 30,
    FORMATURAS: 24 * 60,
    ACHADOS_PERDIDOS: 24 * 14,
    EMPREGOS: 24 * 30,
    ESTAGIO: 24 * 30,
    PESQUISA: 24 * 30
};
