import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ListLinkedMoodleAccountsUseCase } from '@moodle/application/use-cases/list-linked-moodle-accounts.usecase';
import type { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';

describe('ListLinkedMoodleAccountsUseCase', () => {
    beforeAll(() => {
        process.env.ECAMPUS_JWT_SECRET = process.env.ECAMPUS_JWT_SECRET || 'unit-test-secret-do-not-use-in-prod';
    });

    it('lists the linked accounts by the pseudonymous id derived from the cpf', async () => {
        const links = [{ instanceId: 'icomp-colab' as const, username: 'matheusricardo1', linkedAt: new Date(), lastSyncAt: null }];
        const accountLinks = { link: vi.fn(), unlink: vi.fn(), listByUser: vi.fn().mockResolvedValue(links), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;

        const useCase = new ListLinkedMoodleAccountsUseCase(accountLinks);
        const result = await useCase.execute('12345678900');

        expect(result).toBe(links);
        expect(accountLinks.listByUser).toHaveBeenCalledWith(expect.any(String));
        expect((accountLinks.listByUser as any).mock.calls[0][0]).not.toBe('12345678900');
    });
});
