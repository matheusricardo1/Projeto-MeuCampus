import type { AuthSession } from '@/shared/auth/auth-session';
import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import type { EcampusRepository, LoginCredentials } from '@/modules/academic/domain/repositories/ecampus-repository';
import { waitForLoginResult } from '@/modules/academic/infrastructure/realtime/ecampus-realtime-client';

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
