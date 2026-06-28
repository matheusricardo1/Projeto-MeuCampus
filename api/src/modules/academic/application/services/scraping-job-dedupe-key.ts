import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

export function scrapingJobDedupeKey(credentials: AcademicCredentials, resource: string, suffix?: string): string {
  return [credentials.cpf, resource, suffix].filter(Boolean).join('-');
}
