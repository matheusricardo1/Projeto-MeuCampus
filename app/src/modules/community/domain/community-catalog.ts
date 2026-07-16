import { Briefcase, HeartHandshake, Megaphone, ShoppingBag, type LucideIcon } from 'lucide-react-native';
import type { CommunityCategory, RuLevel } from '@/modules/community/domain/community-post';

export type FieldType = 'text' | 'multiline' | 'number' | 'url' | 'select';

export interface FieldSpec {
    key: string;
    label: string;
    placeholder?: string;
    type: FieldType;
    required?: boolean;
    options?: string[];
    maxLength?: number;
}

/** Crowdsourcing quick action (BOLSA / ENERGIA / FILA_RU). */
export interface QuickOption {
    label: string;
    tone?: 'positive' | 'negative' | 'neutral';
    body: string;
    payload: Record<string, unknown>;
}

export interface CategorySpec {
    id: CommunityCategory;
    label: string;
    kind: 'quick' | 'form';
    /** Field whose value becomes the post body (a readable summary). */
    primaryKey?: string;
    fields?: FieldSpec[];
    quick?: {
        prompt: string;
        needsFieldKey?: string; // free-text field that quick options depend on
        needsFieldLabel?: string;
        options: (value: string) => QuickOption[];
    };
}

export interface SectionSpec {
    id: string;
    label: string;
    icon: LucideIcon;
    categories: CategorySpec[];
}

const RU_OPTIONS: Array<{ level: RuLevel; label: string; body: string }> = [
    { level: 'empty', label: 'Vazio', body: 'RU está vazio agora' },
    { level: 'moderate', label: 'Moderado', body: 'RU com movimento moderado' },
    { level: 'full', label: 'Lotado', body: 'RU está lotado agora' }
];

export const RU_LEVEL_LABEL: Record<RuLevel, string> = {
    empty: 'Vazio',
    moderate: 'Moderado',
    full: 'Lotado'
};

// Common field builders to keep the catalog terse.
const descricao: FieldSpec = { key: 'descricao', label: 'Detalhes', placeholder: 'Detalhes (opcional)', type: 'multiline', maxLength: 400 };
const contato: FieldSpec = { key: 'contato', label: 'Contato', placeholder: 'WhatsApp, @ ou e-mail', type: 'text', maxLength: 80 };
const link = (placeholder: string, required = false): FieldSpec => ({ key: 'link', label: 'Link', placeholder, type: 'url', required, maxLength: 200 });
const data: FieldSpec = { key: 'data', label: 'Quando', placeholder: 'Quando? (ex.: 20/08 às 19h)', type: 'text', maxLength: 60 };
const local: FieldSpec = { key: 'local', label: 'Local', placeholder: 'Local', type: 'text', maxLength: 80 };
const preco = (placeholder: string): FieldSpec => ({ key: 'preco', label: 'Preço', placeholder, type: 'text', maxLength: 40 });
const titulo = (placeholder: string): FieldSpec => ({ key: 'titulo', label: 'Título', placeholder, type: 'text', required: true, maxLength: 100 });

export const COMMUNITY_SECTIONS: SectionSpec[] = [
    {
        id: 'ajuda',
        label: 'Ajudar a comunidade',
        icon: HeartHandshake,
        categories: [
            {
                id: 'FILA_RU',
                label: 'Fila do RU',
                kind: 'quick',
                quick: {
                    prompt: 'Como está a fila do RU agora?',
                    options: () => RU_OPTIONS.map((o) => ({ label: o.label, body: o.body, payload: { level: o.level } }))
                }
            },
            {
                id: 'BOLSA',
                label: 'Bolsa',
                kind: 'quick',
                quick: {
                    prompt: 'Alguma bolsa caiu?',
                    needsFieldKey: 'scholarship',
                    needsFieldLabel: 'Qual auxílio/bolsa? (ex.: PNAES, monitoria)',
                    options: (value) => [
                        { label: 'Caiu ✓', tone: 'positive', body: `Bolsa "${value}" caiu`, payload: { scholarship: value, dropped: true } },
                        { label: 'Não caiu', tone: 'neutral', body: `Bolsa "${value}" ainda não caiu`, payload: { scholarship: value, dropped: false } }
                    ]
                }
            },
            {
                id: 'ENERGIA',
                label: 'Energia',
                kind: 'quick',
                quick: {
                    prompt: 'Queda de energia no campus?',
                    needsFieldKey: 'location',
                    needsFieldLabel: 'Onde? (ex.: Bloco M, ICE, setor sul)',
                    options: (value) => [
                        { label: 'Sem luz', tone: 'negative', body: `Sem energia em ${value}`, payload: { location: value, hasPower: false } },
                        { label: 'Voltou', tone: 'positive', body: `Energia voltou em ${value}`, payload: { location: value, hasPower: true } }
                    ]
                }
            }
        ]
    },
    {
        id: 'mercado',
        label: 'Mercado',
        icon: ShoppingBag,
        categories: [
            {
                id: 'COMIDAS',
                label: 'Comidas',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('O que você está vendendo?'), preco('Preço (ex.: R$ 8)'), local, contato, descricao]
            },
            {
                id: 'ALUGUEIS',
                label: 'Aluguéis',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Ex.: Quarto perto da UFAM'), preco('Preço / mês'), { key: 'bairro', label: 'Bairro', placeholder: 'Bairro', type: 'text', maxLength: 60 }, { key: 'quartos', label: 'Quartos', placeholder: 'Nº de quartos', type: 'number', maxLength: 3 }, contato, descricao]
            },
            {
                id: 'TROCAS_VENDAS',
                label: 'Trocas/Vendas',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Item'), preco("Preço (ou 'troca por...')"), contato, descricao]
            }
        ]
    },
    {
        id: 'divulgacao',
        label: 'Divulgação',
        icon: Megaphone,
        categories: [
            {
                id: 'EVENTOS',
                label: 'Eventos',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Nome do evento'), data, local, link('Link (inscrição/info)'), descricao]
            },
            {
                id: 'PALESTRAS',
                label: 'Palestras',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Título da palestra/apresentação'), data, local, link('Link (opcional)'), descricao]
            },
            {
                id: 'FORMATURAS',
                label: 'Formaturas',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Curso / turma'), data, local, link('Link (opcional)'), descricao]
            },
            {
                id: 'ACHADOS_PERDIDOS',
                label: 'Achados e perdidos',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [
                    { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Achei', 'Perdi'] },
                    titulo('O que? (ex.: carteira preta)'),
                    { key: 'local', label: 'Onde', placeholder: 'Onde foi?', type: 'text', maxLength: 80 },
                    contato,
                    descricao
                ]
            }
        ]
    },
    {
        id: 'oportunidades',
        label: 'Oportunidades',
        icon: Briefcase,
        categories: [
            {
                id: 'EMPREGOS',
                label: 'Empregos',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Cargo / vaga'), { key: 'salario', label: 'Salário', placeholder: 'Salário / faixa', type: 'text', maxLength: 40 }, link('Link para candidatura'), descricao]
            },
            {
                id: 'ESTAGIO',
                label: 'Estágio',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Vaga de estágio'), { key: 'bolsa', label: 'Bolsa', placeholder: 'Bolsa / auxílio', type: 'text', maxLength: 40 }, link('Link para candidatura'), descricao]
            },
            {
                id: 'PESQUISA',
                label: 'Pesquisa (Gform)',
                kind: 'form',
                primaryKey: 'titulo',
                fields: [titulo('Título da pesquisa'), link('Link do Google Forms', true), descricao]
            }
        ]
    }
];

const CATEGORY_INDEX: Record<string, CategorySpec> = Object.fromEntries(
    COMMUNITY_SECTIONS.flatMap((section) => section.categories.map((cat) => [cat.id, cat]))
);

export function getCategorySpec(id: CommunityCategory): CategorySpec {
    return CATEGORY_INDEX[id] ?? COMMUNITY_SECTIONS[0]!.categories[0]!;
}

export function getSectionOf(id: CommunityCategory): SectionSpec {
    return COMMUNITY_SECTIONS.find((section) => section.categories.some((cat) => cat.id === id)) ?? COMMUNITY_SECTIONS[0]!;
}

/** Human labels for payload keys, used when rendering a post card's detail lines. */
export const FIELD_LABELS: Record<string, string> = {
    preco: 'Preço',
    local: 'Local',
    bairro: 'Bairro',
    quartos: 'Quartos',
    contato: 'Contato',
    data: 'Quando',
    link: 'Link',
    salario: 'Salário',
    bolsa: 'Bolsa',
    tipo: 'Tipo',
    descricao: ''
};
