import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import type { MoodleAccountLink } from '@moodle/domain/entities/moodle-account-link.entity';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

export class ListLinkedMoodleAccountsUseCase {
    constructor(private readonly accountLinks: MoodleAccountLinkRepository) {}

    async execute(cpf: string): Promise<MoodleAccountLink[]> {
        return this.accountLinks.listByUser(pseudonymousUserId(cpf));
    }
}
