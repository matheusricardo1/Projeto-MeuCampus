import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';

export const ECAMPUS_SCRAPE_QUEUE_NAME = process.env.ECAMPUS_SCRAPE_QUEUE || 'ecampus-scrape';

export type EcampusScrapeJobName =
    | 'login'
    | 'logout'
    | 'profile'
    | 'schedule'
    | 'grades'
    | 'lesson-plan-subjects'
    | 'lesson-plan'
    | 'matriz-curricular';

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
        year?: string;
        period?: string;
      }
    | {
        credentials: EcampusCredentials;
        planId: string;
      };

/**
 * Wire shape actually stored in BullMQ. Job data always carries a CPF/password
 * or a session cookie jar — both sensitive — so the API encrypts it before
 * enqueueing and the worker decrypts it back into EcampusScrapeJobData.
 */
export interface EncryptedEcampusScrapeJobData {
    __enc: string;
}
