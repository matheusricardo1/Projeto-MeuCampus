import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AcademicController } from '@academic/presentation/http/academic.controller';
import { AcademicSessionExpiredException } from '@academic/application/use-cases/validate-academic-session.usecase';

const CREDENTIALS = { cpf: '12345678900' };

function buildResponse(): Response {
    return {
        locals: {},
        status: vi.fn().mockReturnThis()
    } as unknown as Response;
}

function buildController(overrides: Partial<Record<string, any>> = {}) {
    const useCases = {
        loginUseCase: { execute: vi.fn() },
        logoutUseCase: { execute: vi.fn() },
        getAcademicSubjectsUseCase: { execute: vi.fn() },
        getProfileUseCase: { execute: vi.fn() },
        getScheduleUseCase: { execute: vi.fn() },
        getGradesUseCase: { execute: vi.fn() },
        getLessonPlanUseCase: { execute: vi.fn() },
        getLessonPlanSubjectsUseCase: { execute: vi.fn() },
        getMatrizCurricularUseCase: { execute: vi.fn(), requestCachedOrPending: vi.fn() },
        validateAcademicSessionUseCase: { execute: vi.fn() },
        scrapingJobService: { enqueue: vi.fn() },
        ...overrides
    };

    const controller = new AcademicController(
        useCases.loginUseCase as any,
        useCases.logoutUseCase as any,
        useCases.getAcademicSubjectsUseCase as any,
        useCases.getProfileUseCase as any,
        useCases.getScheduleUseCase as any,
        useCases.getGradesUseCase as any,
        useCases.getLessonPlanUseCase as any,
        useCases.getLessonPlanSubjectsUseCase as any,
        useCases.getMatrizCurricularUseCase as any,
        useCases.validateAcademicSessionUseCase as any,
        useCases.scrapingJobService as any
    );

    return { controller, ...useCases };
}

describe('AcademicController.health', () => {
    it('returns a static ok status', () => {
        const { controller } = buildController();
        expect(controller.health()).toEqual({ status: 'ok', module: 'academic' });
    });
});

describe('AcademicController.login', () => {
    it('delegates to LoginUseCase and tags the response locals', async () => {
        const { controller, loginUseCase } = buildController();
        (loginUseCase.execute as any).mockResolvedValue({ jobId: 'job-1' });
        const response = buildResponse();

        const result = await controller.login({ user: '52998224725', password: 'secret' } as any, response);

        expect(loginUseCase.execute).toHaveBeenCalledWith({ cpf: '52998224725', password: 'secret' });
        expect(result).toEqual({ jobId: 'job-1' });
        expect(response.locals).toMatchObject({ academicDataSource: 'worker', academicResource: 'login' });
    });

    it('rejects a request missing user or password before calling the use case', async () => {
        const { controller, loginUseCase } = buildController();
        const response = buildResponse();

        await expect(controller.login({ user: '', password: 'secret' } as any, response)).rejects.toThrow(BadRequestException);
        expect(loginUseCase.execute).not.toHaveBeenCalled();
    });
});

describe('AcademicController.logout', () => {
    it('calls LogoutAcademicSessionUseCase and returns ok', async () => {
        const { controller, logoutUseCase } = buildController();
        (logoutUseCase.execute as any).mockResolvedValue(undefined);
        const response = buildResponse();

        const result = await controller.logout(CREDENTIALS, response);

        expect(logoutUseCase.execute).toHaveBeenCalledWith(CREDENTIALS);
        expect(result).toEqual({ status: 'ok' });
        expect(response.locals).toMatchObject({ academicDataSource: 'worker', academicResource: 'logout' });
    });
});

describe('AcademicController.validateSession', () => {
    it('returns the use case result when the session is valid', async () => {
        const { controller, validateAcademicSessionUseCase } = buildController();
        (validateAcademicSessionUseCase.execute as any).mockResolvedValue({ status: 'ok' });

        const result = await controller.validateSession(CREDENTIALS);
        expect(result).toEqual({ status: 'ok' });
    });

    it('maps an expired session into a 401 UnauthorizedException', async () => {
        const { controller, validateAcademicSessionUseCase } = buildController();
        (validateAcademicSessionUseCase.execute as any).mockRejectedValue(new AcademicSessionExpiredException());

        await expect(controller.validateSession(CREDENTIALS)).rejects.toThrow(UnauthorizedException);
    });

    it('rethrows unrelated errors as-is', async () => {
        const { controller, validateAcademicSessionUseCase } = buildController();
        const error = new Error('boom');
        (validateAcademicSessionUseCase.execute as any).mockRejectedValue(error);

        await expect(controller.validateSession(CREDENTIALS)).rejects.toBe(error);
    });
});

describe('AcademicController resource endpoints (cache-aside vs pending-scrape tagging)', () => {
    it('getStudentProfile tags the response as cache-aside when data is returned', async () => {
        const { controller, getProfileUseCase } = buildController();
        const profile = { personal: {} };
        (getProfileUseCase.execute as any).mockResolvedValue(profile);
        const response = buildResponse();

        const result = await controller.getStudentProfile(CREDENTIALS, response);

        expect(result).toBe(profile);
        expect(response.locals).toMatchObject({ academicDataSource: 'cache-aside', academicResource: 'profile' });
        expect(response.status).not.toHaveBeenCalled();
    });

    it('getStudentProfile tags the response as worker/pending and sets 202 when a scrape is pending', async () => {
        const { controller, getProfileUseCase } = buildController();
        (getProfileUseCase.execute as any).mockResolvedValue({ status: 'pending', resource: 'profile' });
        const response = buildResponse();

        const result = await controller.getStudentProfile(CREDENTIALS, response);

        expect(result).toEqual({ status: 'pending', resource: 'profile' });
        expect(response.status).toHaveBeenCalledWith(202);
        expect(response.locals).toMatchObject({ academicDataSource: 'worker', academicResource: 'profile' });
    });

    it('getSchedule delegates to GetScheduleUseCase', async () => {
        const { controller, getScheduleUseCase } = buildController();
        (getScheduleUseCase.execute as any).mockResolvedValue([]);
        const response = buildResponse();

        await controller.getSchedule(CREDENTIALS, response);
        expect(getScheduleUseCase.execute).toHaveBeenCalledWith(CREDENTIALS);
    });

    it('getGrades parses query params and forwards them to GetGradesUseCase', async () => {
        const { controller, getGradesUseCase } = buildController();
        (getGradesUseCase.execute as any).mockResolvedValue([]);
        const response = buildResponse();

        await controller.getGrades(CREDENTIALS, response, '2024', '1');

        expect(getGradesUseCase.execute).toHaveBeenCalledWith({ credentials: CREDENTIALS, year: '2024', period: '1' });
    });

    it('getGrades rejects an invalid year query param', async () => {
        const { controller } = buildController();
        const response = buildResponse();

        await expect(controller.getGrades(CREDENTIALS, response, 'not-a-year', '1')).rejects.toThrow();
    });

    it('getLessonPlan forwards the planId to GetLessonPlanUseCase', async () => {
        const { controller, getLessonPlanUseCase } = buildController();
        (getLessonPlanUseCase.execute as any).mockResolvedValue([]);
        const response = buildResponse();

        await controller.getLessonPlan(CREDENTIALS, 'PLAN-1', response);
        expect(getLessonPlanUseCase.execute).toHaveBeenCalledWith(CREDENTIALS, 'PLAN-1');
    });

    it('getAcademicSubjects tags pending results with the "academic-subjects" resource name', async () => {
        const { controller, getAcademicSubjectsUseCase } = buildController();
        (getAcademicSubjectsUseCase.execute as any).mockResolvedValue({ status: 'pending', resource: 'grades' });
        const response = buildResponse();

        const result = await controller.getAcademicSubjects(CREDENTIALS, response, '2024', '1');

        expect(result).toEqual({ status: 'pending', resource: 'grades' });
        expect(response.locals).toMatchObject({ academicDataSource: 'worker', academicResource: 'academic-subjects' });
        expect(response.status).toHaveBeenCalledWith(202);
    });

    it('getLessonPlanSubjects delegates to GetLessonPlanSubjectsUseCase', async () => {
        const { controller, getLessonPlanSubjectsUseCase } = buildController();
        (getLessonPlanSubjectsUseCase.execute as any).mockResolvedValue([]);
        const response = buildResponse();

        await controller.getLessonPlanSubjects(CREDENTIALS, response);
        expect(getLessonPlanSubjectsUseCase.execute).toHaveBeenCalledWith(CREDENTIALS);
    });
});

describe('AcademicController.enqueueJob', () => {
    it('rejects an unknown job type', async () => {
        const { controller } = buildController();
        const response = buildResponse();

        await expect(controller.enqueueJob('not-a-real-job', CREDENTIALS, {}, response)).rejects.toThrow(BadRequestException);
    });

    it('enqueues a profile job as-is', async () => {
        const { controller, scrapingJobService } = buildController();
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1' });
        const response = buildResponse();

        const result = await controller.enqueueJob('profile', CREDENTIALS, {}, response);

        expect(scrapingJobService.enqueue).toHaveBeenCalledWith('profile', { credentials: CREDENTIALS });
        expect(result).toEqual({ jobId: 'job-1' });
        expect(response.locals).toMatchObject({ academicDataSource: 'worker', academicResource: 'profile' });
    });

    it('fills in a default year/period for a grades job when the body omits them', async () => {
        const { controller, scrapingJobService } = buildController();
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1' });
        const response = buildResponse();

        await controller.enqueueJob('grades', CREDENTIALS, {}, response);

        const [, data] = (scrapingJobService.enqueue as any).mock.calls[0];
        expect(data.credentials).toBe(CREDENTIALS);
        expect(typeof data.year).toBe('string');
        expect(typeof data.period).toBe('string');
    });

    it('uses the body-provided year/period for a grades job when given', async () => {
        const { controller, scrapingJobService } = buildController();
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1' });
        const response = buildResponse();

        await controller.enqueueJob('grades', CREDENTIALS, { year: '2022', period: '2' }, response);

        const [, data] = (scrapingJobService.enqueue as any).mock.calls[0];
        expect(data.year).toBe('2022');
        expect(data.period).toBe('2');
    });

    it('requires a planId for a lesson-plan job', async () => {
        const { controller } = buildController();
        const response = buildResponse();

        await expect(controller.enqueueJob('lesson-plan', CREDENTIALS, {}, response)).rejects.toThrow(BadRequestException);
    });

    it('enqueues a lesson-plan job with the given planId', async () => {
        const { controller, scrapingJobService } = buildController();
        (scrapingJobService.enqueue as any).mockResolvedValue({ id: 'job-1' });
        const response = buildResponse();

        await controller.enqueueJob('lesson-plan', CREDENTIALS, { planId: 'PLAN-1' }, response);

        const [, data] = (scrapingJobService.enqueue as any).mock.calls[0];
        expect(data.planId).toBe('PLAN-1');
    });
});
