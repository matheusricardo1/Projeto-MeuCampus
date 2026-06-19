import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import type { StudentProfile } from '@/domain/entities/student-profile';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class GetStudentProfileUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<StudentProfile> {
        const session = this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getProfile(session.accessToken);
    }
}
