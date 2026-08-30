import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

export function scrapingJobDedupeKey(credentials: RuDigitalCredentials, resource: string, suffix?: string): string {
    return ['ru-digital', credentials.cpf, resource, suffix].filter(Boolean).join('-');
}
