import { describe, expect, it, vi } from 'vitest';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';

function buildCache(overrides: Partial<AcademicDataRepository> = {}): AcademicDataRepository {
    return {
        getProfile: vi.fn(),
        getSchedule: vi.fn(),
        getGrades: vi.fn(),
        getLessonPlanSubjects: vi.fn(),
        getLessonPlan: vi.fn(),
        getAcademicSubjects: vi.fn(),
        getCurrentPeriodHint: vi.fn(),
        clearUserCache: vi.fn(),
        ...overrides
    } as unknown as AcademicDataRepository;
}

describe('resolveCurrentGradesPeriod', () => {
    it('requests a scrape with no year/period when there is no cached hint yet', async () => {
        const cache = buildCache({ getCurrentPeriodHint: vi.fn().mockResolvedValue(null) });

        const result = await resolveCurrentGradesPeriod(cache, '12345678900');

        expect(result).toEqual({ needsScrape: true });
        expect(cache.getGrades).not.toHaveBeenCalled();
    });

    it('returns the hinted period with needsScrape=false when grades are already cached for it', async () => {
        const cache = buildCache({
            getCurrentPeriodHint: vi.fn().mockResolvedValue({ year: '2024', period: '1' }),
            getGrades: vi.fn().mockResolvedValue([])
        });

        const result = await resolveCurrentGradesPeriod(cache, '12345678900');

        expect(result).toEqual({ year: '2024', period: '1', needsScrape: false });
        expect(cache.getGrades).toHaveBeenCalledWith('12345678900', '2024', '1');
    });

    it('returns the hinted period with needsScrape=true when grades for it are not cached', async () => {
        const cache = buildCache({
            getCurrentPeriodHint: vi.fn().mockResolvedValue({ year: '2024', period: '1' }),
            getGrades: vi.fn().mockRejectedValue(new AcademicResourceNotFoundException('grades'))
        });

        const result = await resolveCurrentGradesPeriod(cache, '12345678900');

        expect(result).toEqual({ year: '2024', period: '1', needsScrape: true });
    });

    it('propagates unexpected errors instead of treating them as a cache miss', async () => {
        const cache = buildCache({
            getCurrentPeriodHint: vi.fn().mockResolvedValue({ year: '2024', period: '1' }),
            getGrades: vi.fn().mockRejectedValue(new Error('redis is down'))
        });

        await expect(resolveCurrentGradesPeriod(cache, '12345678900')).rejects.toThrow('redis is down');
    });
});
