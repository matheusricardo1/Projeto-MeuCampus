import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

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
    | {
        cpf: string;
        password: string;
      }
    | {
        credentials: EcampusCredentials;
      }
    | {
        credentials: EcampusCredentials;
        year: string;
        period: string;
      }
    | {
        credentials: EcampusCredentials;
        planId: string;
      };
