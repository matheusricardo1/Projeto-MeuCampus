export const COMMUNITY_CATEGORIES = ['BOLSA', 'ENERGIA', 'FILA_RU'] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export type RuLevel = 'empty' | 'moderate' | 'full';

export interface CommunityPost {
    id: string;
    authorName: string;
    category: CommunityCategory;
    body: string;
    payload: Record<string, unknown> | null;
    confirmCount: number;
    createdAt: string;
}

export interface CreateCommunityPostInput {
    category: CommunityCategory;
    body: string;
    authorName: string;
    payload?: Record<string, unknown> | null;
}
