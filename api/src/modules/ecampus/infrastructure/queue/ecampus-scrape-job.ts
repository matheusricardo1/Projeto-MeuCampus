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
  | { credentials: import('@academic/domain/models/academic-credentials').AcademicCredentials }
  | { credentials: import('@academic/domain/models/academic-credentials').AcademicCredentials; year: string; period: string }
  | { credentials: import('@academic/domain/models/academic-credentials').AcademicCredentials; planId: string };
