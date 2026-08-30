import { describe, expect, it, vi } from 'vitest';
import { GetStudentUseCase } from '@ru-digital/application/use-cases/get-student.usecase';
import { RuDigitalResourceNotFoundException } from '@ru-digital/domain/exceptions/ru-digital-resource-not-found.exception';
import type { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import type { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

const CREDENTIALS = { cpf: '06124555212' };

function buildDeps() {
    const cache = { getStudent: vi.fn() } as unknown as RuDigitalDataRepository;
    const scrapingJobService = { enqueue: vi.fn().mockResolvedValue({ id: 'job-1', waitUntilFinished: vi.fn() }) } as unknown as ScrapingJobService;
    return { cache, scrapingJobService };
}

describe('GetStudentUseCase', () => {
    it('returns the cached student when present', async () => {
        const { cache, scrapingJobService } = buildDeps();
        const student = { studentId: 171988, courseEnrollmentId: 193808, cpf: '061.245.552-12', fullName: 'MATHEUS', enrollmentNumber: '22551205', courseCode: 'IE17', courseName: 'Engenharia de Software' };
        (cache.getStudent as any).mockResolvedValue(student);

        const useCase = new GetStudentUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toBe(student);
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a student scrape and returns a pending job when the cache misses', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getStudent as any).mockRejectedValue(new RuDigitalResourceNotFoundException('student'));

        const useCase = new GetStudentUseCase(cache, scrapingJobService);
        const result = await useCase.execute(CREDENTIALS);

        expect(result).toEqual({ status: 'pending', resource: 'student' });
        expect(scrapingJobService.enqueue).toHaveBeenCalledWith(
            'student',
            { credentials: CREDENTIALS },
            { dedupeKey: 'ru-digital-06124555212-ru-digital-student' }
        );
    });

    it('propagates unexpected errors without enqueueing a scrape', async () => {
        const { cache, scrapingJobService } = buildDeps();
        (cache.getStudent as any).mockRejectedValue(new Error('redis down'));

        const useCase = new GetStudentUseCase(cache, scrapingJobService);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('redis down');
        expect(scrapingJobService.enqueue).not.toHaveBeenCalled();
    });
});
