import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LinkMoodleAccountUseCase } from '@moodle/application/use-cases/link-moodle-account.usecase';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';

const INPUT = { cpf: '12345678900', instanceId: 'icomp-colab' as const, username: 'matheusricardo1', password: 'secret' };

describe('LinkMoodleAccountUseCase', () => {
    beforeAll(() => {
        process.env.ECAMPUS_JWT_SECRET = process.env.ECAMPUS_JWT_SECRET || 'unit-test-secret-do-not-use-in-prod';
    });

    it('verifies the credential via a real login job before persisting it', async () => {
        const waitUntilFinished = vi.fn().mockResolvedValue({ session: { token: 'wstoken-abc' } });
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accountLinks = { link: vi.fn(), unlink: vi.fn(), listByUser: vi.fn(), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;

        const useCase = new LinkMoodleAccountUseCase(scrapingJobService, accountLinks);
        await useCase.execute(INPUT);

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('login', { instanceId: 'icomp-colab', username: 'matheusricardo1', password: 'secret' });
        expect(accountLinks.link).toHaveBeenCalledWith(expect.any(String), 'icomp-colab', 'matheusricardo1', 'secret');
        // Never the raw cpf as the storage key — it's the one-way pseudonymous id.
        expect((accountLinks.link as any).mock.calls[0][0]).not.toBe(INPUT.cpf);
    });

    it('does not persist anything when the login verification fails', async () => {
        const waitUntilFinished = vi.fn().mockRejectedValue(new Error('Identificacao ou senha invalidas.'));
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished }) } as unknown as ScrapingJobService;
        const accountLinks = { link: vi.fn(), unlink: vi.fn(), listByUser: vi.fn(), findCredentials: vi.fn(), findFirstCredentials: vi.fn() } as unknown as MoodleAccountLinkRepository;

        const useCase = new LinkMoodleAccountUseCase(scrapingJobService, accountLinks);

        await expect(useCase.execute(INPUT)).rejects.toThrow('Identificacao ou senha invalidas.');
        expect(accountLinks.link).not.toHaveBeenCalled();
    });
});
