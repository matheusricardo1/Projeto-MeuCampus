import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { EcampusRepository, LoginCredentials } from '@/domain/repositories/ecampus-repository';

export class LoginEcampusUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(credentials: LoginCredentials): Promise<AuthSession> {
        const session = await this.repository.login(credentials);
        this.sessionStore.save(session);
        return session;
    }
}
