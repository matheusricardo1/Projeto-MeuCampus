import { describe, expect, it, vi } from 'vitest';
import { GetStudentUseCase } from '@/application/use-cases/get-student.usecase';
import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };

describe('GetStudentUseCase', () => {
    it('asserts the session is active, then runs the fetch through cache-and-publish for the "discente" resource', async () => {
        const student = { studentId: 1, courseEnrollmentId: 1, cpf: '061.245.552-12', fullName: 'MATHEUS', enrollmentNumber: '22551205', courseCode: 'IE17', courseName: 'Engenharia de Software' };
        const repository = { getStudent: vi.fn().mockResolvedValue(student) } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn(), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn().mockImplementation((_resource, _cpf, promise) => promise) } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetStudentUseCase(repository, sessions, cacheAndPublish);
        const result = await useCase.execute(CREDENTIALS);

        expect(sessions.assertActive).toHaveBeenCalledWith(CREDENTIALS.cpf);
        expect(cacheAndPublish.run).toHaveBeenCalledWith('discente', CREDENTIALS.cpf, expect.any(Promise));
        expect(repository.getStudent).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toBe(student);
    });

    it('propagates a session-invalidated error without calling the repository', async () => {
        const repository = { getStudent: vi.fn() } as unknown as RuDigitalRepository;
        const sessions = { assertActive: vi.fn().mockRejectedValue(new Error('expired')), markActive: vi.fn(), markInvalid: vi.fn() } as unknown as RuDigitalSessionStore;
        const cacheAndPublish = { run: vi.fn() } as unknown as CacheAndPublishScrapedResource;

        const useCase = new GetStudentUseCase(repository, sessions, cacheAndPublish);

        await expect(useCase.execute(CREDENTIALS)).rejects.toThrow('expired');
        expect(repository.getStudent).not.toHaveBeenCalled();
    });
});
