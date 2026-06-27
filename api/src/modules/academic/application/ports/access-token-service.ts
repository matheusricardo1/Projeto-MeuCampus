import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';

export abstract class AccessTokenService {
    abstract sign(credentials: AcademicCredentials): string;
    abstract verify(token: string): AcademicCredentials;
}
