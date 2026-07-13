import type { AuthSessionStore } from '@/shared/auth/auth-session-store';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import type { EcampusRepository } from '@/modules/academic/domain/repositories/ecampus-repository';

export class GetBillingPlanUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessionStore: AuthSessionStore
    ) {}

    async execute() {
        const session = await this.sessionStore.get();
        if (!session) throw new AuthSessionExpiredError();

        return this.repository.getBillingPlan(session.accessToken);
    }
}
