import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { EcampusRepository } from '@/domain/repositories/ecampus-repository';

export class LogoutUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(): Promise<void> {
        const session = this.sessionStore.get();

        try {
            if (session) {
                await this.repository.logout(session.accessToken);
            }
        } finally {
            this.sessionStore.clear();
        }
    }
}
