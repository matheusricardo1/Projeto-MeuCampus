export const COMMUNITY_CATEGORIES = [
    'BOLSA', 'ENERGIA', 'FILA_RU',
    'COMIDAS', 'ALUGUEIS', 'TROCAS_VENDAS',
    'EVENTOS', 'PALESTRAS', 'FORMATURAS', 'ACHADOS_PERDIDOS',
    'EMPREGOS', 'ESTAGIO', 'PESQUISA'
] as const;
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
