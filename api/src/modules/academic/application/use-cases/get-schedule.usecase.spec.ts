import { describe, expect, it, vi } from 'vitest';
import { GetScheduleUseCase } from '@academic/application/use-cases/get-schedule.usecase';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '12345678900' };

function buildDeps() {
    const cache = { getSchedule: vi.fn() } as unknown as AcademicDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetScheduleUseCase', () => {
    it('returns the cached schedule when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const schedule = [{ weekday: 'Monday', start_time: '08:00', end_time: '10:00', code: 'MAT101', subject: 'Calculo I', class_identifier: 'T01' }];
        (cache.getSchedule as any).mockResolvedValue(schedule);

        const useCase = new GetScheduleUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(schedule);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a schedule scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getSchedule as any).mockRejectedValue(new AcademicResourceNotFoundException('schedule'));

        const useCase = new GetScheduleUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'schedule' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'schedule',
            { credentials: CREDENTIALS },
            { dedupeKey: '12345678900-schedule' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getSchedule as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetScheduleUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});
