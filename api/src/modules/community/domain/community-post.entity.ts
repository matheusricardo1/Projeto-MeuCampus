export const COMMUNITY_CATEGORIES = ['BOLSA', 'ENERGIA', 'FILA_RU'] as const;
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
    BOLSA: 72,
    ENERGIA: 12,
    FILA_RU: 6
};
