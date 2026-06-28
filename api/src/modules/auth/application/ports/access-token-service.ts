import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';

export abstract class AccessTokenService {
    abstract sign(credentials: AcademicCredentials): string;
    abstract verify(token: string): AcademicCredentials;
}
