import type { GlobalDataType } from '@/modules/admin/infrastructure/admin-api';

export interface GlobalDataField {
    key: string;
    label: string;
    placeholder?: string;
    multiline?: boolean;
    required?: boolean;
}

export interface GlobalDataTypeSpec {
    type: GlobalDataType;
    label: string;
    emoji: string;
    /** Label for the required title field, which differs per type. */
    titleLabel: string;
    titlePlaceholder: string;
    /** Extra structured fields specific to this type (stored in payload). */
    fields: GlobalDataField[];
}

export const GLOBAL_DATA_TYPE_SPECS: GlobalDataTypeSpec[] = [
    {
        type: 'ACADEMIC_CALENDAR',
        label: 'Calendário acadêmico',
        emoji: '📅',
        titleLabel: 'Evento',
        titlePlaceholder: 'Ex.: Início do semestre 2026/2',
        fields: [
            { key: 'startDate', label: 'Data / início', placeholder: 'Ex.: 03/08/2026', required: true },
            { key: 'endDate', label: 'Fim (opcional)', placeholder: 'Ex.: 12/12/2026' },
            { key: 'notes', label: 'Observações', placeholder: 'Detalhes (opcional)', multiline: true }
        ]
    },
    {
        type: 'INSTITUTIONAL_INFO',
        label: 'Info institucional',
        emoji: 'ℹ️',
        titleLabel: 'Assunto',
        titlePlaceholder: 'Ex.: Horário da Biblioteca Central',
        fields: [
            { key: 'content', label: 'Informação', placeholder: 'Ex.: Seg a Sex, 8h às 21h. Sáb 8h às 12h.', multiline: true, required: true },
            { key: 'location', label: 'Local (opcional)', placeholder: 'Ex.: Setor Norte' },
            { key: 'contact', label: 'Contato (opcional)', placeholder: 'Telefone, e-mail ou site' }
        ]
    },
    {
        type: 'RU_MENU',
        label: 'Cardápio / RU',
        emoji: '🍽️',
        titleLabel: 'Refeição / dia',
        titlePlaceholder: 'Ex.: Almoço — Segunda 18/08',
        fields: [
            { key: 'items', label: 'Cardápio', placeholder: 'Ex.: Arroz, feijão, frango, salada, suco', multiline: true, required: true },
            { key: 'price', label: 'Preço (opcional)', placeholder: 'Ex.: R$ 2,00' },
            { key: 'schedule', label: 'Horário (opcional)', placeholder: 'Ex.: 11h às 14h' }
        ]
    },
    {
        type: 'OFFICIAL_NOTICE',
        label: 'Aviso oficial',
        emoji: '📢',
        titleLabel: 'Título do aviso',
        titlePlaceholder: 'Ex.: Suspensão de aulas dia 20/08',
        fields: [
            { key: 'content', label: 'Conteúdo', placeholder: 'Texto do comunicado oficial', multiline: true, required: true },
            { key: 'validUntil', label: 'Válido até (opcional)', placeholder: 'Ex.: 30/08/2026' }
        ]
    }
];

export function getGlobalDataSpec(type: GlobalDataType): GlobalDataTypeSpec {
    return GLOBAL_DATA_TYPE_SPECS.find((spec) => spec.type === type) ?? GLOBAL_DATA_TYPE_SPECS[0]!;
}
