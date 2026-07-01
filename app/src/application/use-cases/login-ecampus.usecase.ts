import type { AuthSession } from '@/domain/entities/auth-session';
import type { AuthSessionStore } from '@/application/ports/auth-session-store';
import type { EcampusRepository, LoginCredentials } from '@/domain/repositories/ecampus-repository';
import { waitForLoginResult } from '@/infrastructure/realtime/ecampus-realtime-client';

export class LoginEcampusUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute(credentials: LoginCredentials): Promise<AuthSession> {
        const { jobId } = await this.repository.login(credentials);
        const session = await waitForLoginResult(jobId);
        await this.sessionStore.save(session);
        return session;
    }
}
