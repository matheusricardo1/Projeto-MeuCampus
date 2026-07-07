import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { Grade } from '@/modules/academic/domain/entities/grade';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class GetGradesUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(year?: string, period?: string): Promise<Grade[]> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getGrades(session.accessToken, year, period);
    }
}
