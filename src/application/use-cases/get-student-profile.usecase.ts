import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { StudentProfile } from '@/domain/entities/student-profile';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetStudentProfileUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<StudentProfile> {
        const session = this.sessionStore.get();
        if (!session) throw new Error('Sessao expirada.');
        return this.repository.getProfile(session.accessToken);
    }
}
