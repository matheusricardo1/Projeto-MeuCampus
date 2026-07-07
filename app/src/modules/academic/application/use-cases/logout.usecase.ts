import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class LogoutUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<void> {
        const session = await this.sessionStore.get();

        try {
            if (session) {
                await this.repository.logout(session.accessToken);
            }
        } finally {
            await this.sessionStore.clear();
        }
    }
}
