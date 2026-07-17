export const GLOBAL_DATA_TYPES = [
    'ACADEMIC_CALENDAR',
    'INSTITUTIONAL_INFO',
    'RU_MENU',
    'OFFICIAL_NOTICE'
] as const;
export type GlobalDataType = (typeof GLOBAL_DATA_TYPES)[number];

export function isGlobalDataType(value: unknown): value is GlobalDataType {
    return typeof value === 'string' && (GLOBAL_DATA_TYPES as readonly string[]).includes(value);
}

/** Type-specific structured fields, persisted as JSON alongside the title. */
export type GlobalDataPayload = Record<string, unknown>;

export interface GlobalData {
    id: string;
    type: GlobalDataType;
    title: string;
    payload: GlobalDataPayload | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateGlobalDataInput {
    type: GlobalDataType;
    title: string;
    payload?: GlobalDataPayload | null;
}
