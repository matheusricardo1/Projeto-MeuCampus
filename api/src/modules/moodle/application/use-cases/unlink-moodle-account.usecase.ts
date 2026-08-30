import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

export class UnlinkMoodleAccountUseCase {
    constructor(private readonly accountLinks: MoodleAccountLinkRepository) {}

    async execute(cpf: string, instanceId: MoodleInstanceId): Promise<boolean> {
        return this.accountLinks.unlink(pseudonymousUserId(cpf), instanceId);
    }
}
