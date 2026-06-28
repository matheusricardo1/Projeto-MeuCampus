import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

export abstract class AcademicSessionRegistry {
    abstract activate(credentials: AcademicCredentials): Promise<void>;
    abstract invalidate(cpf: string): Promise<void>;
    abstract isActive(credentials: AcademicCredentials): Promise<boolean>;
}
