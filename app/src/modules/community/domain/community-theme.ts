import type { CommunityCategory } from '@/modules/community/domain/community-post';

export interface CategoryTheme {
    /** Rich, saturated gradient — dark enough for white text to pop. */
    gradient: readonly [string, string];
    emoji: string;
    /** Bright accent for meters/badges/glow on top of the gradient. */
    accent: string;
    /** Short tagline shown under the category badge. */
    tagline: string;
}

export const CATEGORY_THEME: Record<CommunityCategory, CategoryTheme> = {
    FILA_RU: { gradient: ['#F97316', '#C2410C'], emoji: '🍽️', accent: '#FDBA74', tagline: 'Fila do RU agora' },
    BOLSA: { gradient: ['#059669', '#065F46'], emoji: '💰', accent: '#6EE7B7', tagline: 'Bolsas e auxílios' },
    ENERGIA: { gradient: ['#D97706', '#92400E'], emoji: '⚡', accent: '#FCD34D', tagline: 'Energia no campus' },
    COMIDAS: { gradient: ['#EC4899', '#9D174D'], emoji: '🍔', accent: '#FBCFE8', tagline: 'Comidas à venda' },
    ALUGUEIS: { gradient: ['#4F46E5', '#3730A3'], emoji: '🏠', accent: '#A5B4FC', tagline: 'Aluguéis e moradia' },
    TROCAS_VENDAS: { gradient: ['#7C3AED', '#5B21B6'], emoji: '🔁', accent: '#C4B5FD', tagline: 'Trocas e vendas' },
    EVENTOS: { gradient: ['#DB2777', '#9D174D'], emoji: '🎉', accent: '#FBCFE8', tagline: 'Eventos' },
    PALESTRAS: { gradient: ['#0891B2', '#155E75'], emoji: '🎤', accent: '#67E8F9', tagline: 'Palestras' },
    FORMATURAS: { gradient: ['#7C3AED', '#4C1D95'], emoji: '🎓', accent: '#C4B5FD', tagline: 'Formaturas' },
    ACHADOS_PERDIDOS: { gradient: ['#0D9488', '#115E59'], emoji: '🔎', accent: '#5EEAD4', tagline: 'Achados e perdidos' },
    EMPREGOS: { gradient: ['#2563EB', '#1E40AF'], emoji: '💼', accent: '#93C5FD', tagline: 'Vagas de emprego' },
    ESTAGIO: { gradient: ['#0891B2', '#075985'], emoji: '🚀', accent: '#7DD3FC', tagline: 'Estágios' },
    PESQUISA: { gradient: ['#059669', '#0F766E'], emoji: '📋', accent: '#6EE7B7', tagline: 'Pesquisas' }
};

export function themeOf(category: CommunityCategory): CategoryTheme {
    return CATEGORY_THEME[category];
}
