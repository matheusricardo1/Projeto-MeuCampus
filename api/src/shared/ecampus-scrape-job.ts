export const ECAMPUS_SCRAPE_QUEUE_NAME = process.env.ECAMPUS_SCRAPE_QUEUE || 'ecampus-scrape';

export type EcampusScrapeJobName =
  | 'login'
  | 'logout'
  | 'profile'
  | 'schedule'
  | 'grades'
  | 'lesson-plan-subjects'
  | 'lesson-plan';

export type EcampusScrapeJobData =
  // login job – receives CPF and password, returns session data
  | { cpf: string; password: string }
  // generic jobs – always carry already‑authenticated credentials
  | { credentials: import('@ecampus/domain/models/ecampus-credentials').EcampusCredentials }
  | { credentials: import('@ecampus/domain/models/ecampus-credentials').EcampusCredentials; year: string; period: string }
  | { credentials: import('@ecampus/domain/models/ecampus-credentials').EcampusCredentials; planId: string };
