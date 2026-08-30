import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';

export const RUDIGITAL_SCRAPE_QUEUE_NAME = process.env.RUDIGITAL_SCRAPE_QUEUE || 'rudigital-scrape';

export type RuDigitalScrapeJobName =
    | 'login'
    | 'logout'
    | 'student'
    | 'balance'
    | 'daily-menu'
    | 'default-restaurant'
    | 'last-consumption'
    | 'restaurant-list'
    | 'select-restaurant';

export type RuDigitalScrapeJobData =
    | {
        cpf: string;
        password: string;
      }
    | {
        credentials: RuDigitalCredentials;
      }
    | {
        credentials: RuDigitalCredentials;
        date: string;
      }
    | {
        credentials: RuDigitalCredentials;
        restaurantId: string;
      };

/**
 * Wire shape actually stored in BullMQ. Job data always carries a CPF/password
 * or a session token — both sensitive — so the API encrypts it before
 * enqueueing and the worker decrypts it back into RuDigitalScrapeJobData.
 */
export interface EncryptedRuDigitalScrapeJobData {
    __enc: string;
}
