import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { StudentProfile } from '@/modules/academic/domain/entities/student-profile';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class GetStudentProfileUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<StudentProfile> {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();
        return this.repository.getProfile(session.accessToken);
    }
}
