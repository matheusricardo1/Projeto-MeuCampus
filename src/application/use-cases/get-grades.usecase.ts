import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { Grade } from '@/domain/entities/grade';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetGradesUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(year: string, period: string): Promise<Grade[]> {
        const session = this.sessionStore.get();
        if (!session) throw new Error('Sessao expirada.');
        return this.repository.getGrades(session.accessToken, year, period);
    }
}
