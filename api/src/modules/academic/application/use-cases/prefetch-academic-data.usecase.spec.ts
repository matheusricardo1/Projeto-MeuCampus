import { describe, expect, it, vi } from 'vitest';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';
import type { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

describe('PrefetchAcademicDataUseCase', () => {
    it('starts bootstrap tracking for the fixed set of resources before enqueueing anything', async () => {
        const bootstrapTracker = { start: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicBootstrapTracker;
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job' }) } as unknown as ScrapingJobService;

        const useCase = new PrefetchAcademicDataUseCase(scrapingJobService, bootstrapTracker);
        await useCase.execute(CREDENTIALS);

        expect(bootstrapTracker.start).toHaveBeenCalledWith('12345678900', ['profile', 'schedule', 'grades', 'lesson-plan-subjects']);
    });

    it('enqueues profile, schedule, grades and lesson-plan-subjects jobs, each with its own dedupe key', async () => {
        const bootstrapTracker = { start: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicBootstrapTracker;
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job' }) } as unknown as ScrapingJobService;

        const useCase = new PrefetchAcademicDataUseCase(scrapingJobService, bootstrapTracker);
        await useCase.execute(CREDENTIALS);

        expect(scrapingJobService.enqueue).toHaveBeenCalledTimes(4);
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('profile', { credentials: CREDENTIALS }, { dedupeKey: '12345678900-profile' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('schedule', { credentials: CREDENTIALS }, { dedupeKey: '12345678900-schedule' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('grades', { credentials: CREDENTIALS }, { dedupeKey: '12345678900-grades' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('lesson-plan-subjects', { credentials: CREDENTIALS }, { dedupeKey: '12345678900-lesson-plan-subjects' });
    });

    it('does not pass a year/period to the grades job — the worker resolves the current period itself', async () => {
        const bootstrapTracker = { start: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicBootstrapTracker;
        const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job' }) } as unknown as ScrapingJobService;

        const useCase = new PrefetchAcademicDataUseCase(scrapingJobService, bootstrapTracker);
        await useCase.execute(CREDENTIALS);

        const gradesCall = (scrapingJobService.enqueue as any).mock.calls.find((call: unknown[]) => call[0] === 'grades');
        expect(gradesCall[1]).toEqual({ credentials: CREDENTIALS });
    });

    it('propagates an error from any of the enqueue calls', async () => {
        const bootstrapTracker = { start: vi.fn().mockResolvedValue(undefined) } as unknown as AcademicBootstrapTracker;
        const scrapingJobService = { enqueue: vi.fn().mockRejectedValue(new Error('queue unavailable')) } as unknown as ScrapingJobService;

        const useCase = new PrefetchAcademicDataUseCase(scrapingJobService, bootstrapTracker);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('queue unavailable');
    });
});
