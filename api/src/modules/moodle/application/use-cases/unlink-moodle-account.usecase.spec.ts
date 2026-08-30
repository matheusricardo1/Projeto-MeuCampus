import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UnlinkMoodleAccountUseCase } from '@moodle/application/use-cases/unlink-moodle-account.usecase';
import type { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';

describe('UnlinkMoodleAccountUseCase', () => {
    beforeAll(() => {
        process.env.ECAMPUS_JWT_SECRET = process.env.ECAMPUS_JWT_SECRET || 'unit-test-secret-do-not-use-in-prod';
    });

    it('unlinks by the pseudonymous id derived from the cpf, not the raw cpf', async () => {
        const accountLinks = { link: vi.fn(), unlink: vi.fn().mockResolvedValue(true), listByUser: vi.fn(), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;

        const useCase = new UnlinkMoodleAccountUseCase(accountLinks);
        const result = await useCase.execute('12345678900', 'icomp-colab');

        expect(result).toBe(true);
        expect(accountLinks.unlink).toHaveBeenCalledWith(expect.any(String), 'icomp-colab');
        expect((accountLinks.unlink as any).mock.calls[0][0]).not.toBe('12345678900');
    });

    it('returns false when nothing was linked', async () => {
        const accountLinks = { link: vi.fn(), unlink: vi.fn().mockResolvedValue(false), listByUser: vi.fn(), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;

        const useCase = new UnlinkMoodleAccountUseCase(accountLinks);

        expect(await useCase.execute('12345678900', 'colabweb')).toBe(false);
    });
});
