import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

export abstract class RuDigitalSessionRegistry {
    abstract activate(credentials: RuDigitalCredentials): Promise<void>;
    abstract invalidate(cpf: string): Promise<void>;
    abstract isActive(credentials: RuDigitalCredentials): Promise<boolean>;
}
