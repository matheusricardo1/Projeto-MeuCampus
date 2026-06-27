import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';

export abstract class AcademicSessionRegistry {
    abstract activate(credentials: AcademicCredentials): Promise<void>;
    abstract invalidate(cpf: string): Promise<void>;
    abstract isActive(credentials: AcademicCredentials): Promise<boolean>;
}
