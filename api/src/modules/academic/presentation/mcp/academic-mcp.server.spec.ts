import { describe, expect, it, vi } from 'vitest';
import { createAcademicMcpServer } from '@academic/presentation/mcp/academic-mcp.server';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { UFAM_ACADEMIC_RULES } from '@academic/domain/knowledge/ufam-academic-rules';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import type { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';
import type { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';

function buildFindGradesAcrossPreviousPeriods(overrides: Partial<FindGradesAcrossPreviousPeriodsUseCase> = {}): FindGradesAcrossPreviousPeriodsUseCase {
    return {
        execute: vi.fn(),
        ...overrides
    } as unknown as FindGradesAcrossPreviousPeriodsUseCase;
}

function buildCommunityRepository(overrides: Partial<CommunityPostRepository> = {}): CommunityPostRepository {
    return {
        listRecentForAi: vi.fn().mockResolvedValue([]),
        listByCategory: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        confirm: vi.fn(),
        deleteOwnedBy: vi.fn(),
        ...overrides
    } as unknown as CommunityPostRepository;
}

const findGradesAcrossPreviousPeriods = buildFindGradesAcrossPreviousPeriods();
const communityRepository = buildCommunityRepository();

// The MCP SDK doesn't expose a public way to invoke a registered tool/resource
// handler without wiring up a full transport, so these tests reach into the
// server's internal registries (`_registeredTools[name].handler` and
// `_registeredResources[uri].readCallback`) — the same properties the SDK's
// own request router calls. This is an implementation detail of
// @modelcontextprotocol/sdk and could shift on an SDK upgrade.
function getToolHandler(server: ReturnType<typeof createAcademicMcpServer>, name: string) {
    return (server as any)._registeredTools[name].handler as (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

function getResourceReadCallback(server: ReturnType<typeof createAcademicMcpServer>, uri: string) {
    return (server as any)._registeredResources[uri].readCallback as (uri: URL) => Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }>;
}

function buildRepository(overrides: Partial<AcademicDataRepository> = {}): AcademicDataRepository {
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

const NOT_AVAILABLE = 'Dados não disponíveis. Oriente o usuário a abrir o app para sincronizar.';

describe('createAcademicMcpServer resource: ufam_academic_rules', () => {
    it('serves the static UFAM academic rules text', async () => {
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGradesAcrossPreviousPeriods, communityRepository);
        const readCallback = getResourceReadCallback(server, 'academic://rules/ufam');

        const result = await readCallback(new URL('academic://rules/ufam'));

        expect(result.contents).toEqual([{ uri: 'academic://rules/ufam', text: UFAM_ACADEMIC_RULES, mimeType: 'text/plain' }]);
    });
});

describe('createAcademicMcpServer tool: get_student_profile', () => {
    it('returns the profile as JSON text', async () => {
        const repository = buildRepository({ getProfile: vi.fn().mockResolvedValue({ personal: { full_name: 'Fulano' } }) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_student_profile')({});

        expect(repository.getProfile).toHaveBeenCalledWith('12345678900');
        expect(result.content[0]!.text).toBe(JSON.stringify({ personal: { full_name: 'Fulano' } }));
    });

    it('falls back to a friendly not-available message when the repository throws', async () => {
        const repository = buildRepository({ getProfile: vi.fn().mockRejectedValue(new AcademicResourceNotFoundException('profile')) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_student_profile')({});

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: get_current_grades', () => {
    it('uses the explicitly given year/period without resolving the current one', async () => {
        const repository = buildRepository({ getGrades: vi.fn().mockResolvedValue([{ code: 'MAT101' }]) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_current_grades')({ year: '2024', period: '1' });

        expect(repository.getCurrentPeriodHint).not.toHaveBeenCalled();
        expect(repository.getGrades).toHaveBeenCalledWith('12345678900', '2024', '1');
        expect(result.content[0]!.text).toBe(JSON.stringify([{ code: 'MAT101' }]));
    });

    it('resolves the current period via the cached hint when year/period are omitted', async () => {
        const repository = buildRepository({
            getCurrentPeriodHint: vi.fn().mockResolvedValue({ year: '2024', period: '2' }),
            getGrades: vi.fn().mockResolvedValue([])
        });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        await getToolHandler(server, 'get_current_grades')({});

        expect(repository.getGrades).toHaveBeenCalledWith('12345678900', '2024', '2');
    });

    it('returns the not-available message when no period can be resolved', async () => {
        const repository = buildRepository({ getCurrentPeriodHint: vi.fn().mockResolvedValue(null) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_current_grades')({});

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
        expect(repository.getGrades).not.toHaveBeenCalled();
    });

    it('returns the not-available message when the repository throws', async () => {
        const repository = buildRepository({ getGrades: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_current_grades')({ year: '2024', period: '1' });

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: find_subject_in_previous_periods', () => {
    it('forwards subjectQuery and the before* filters, returning the use case result as JSON text', async () => {
        const findGrades = buildFindGradesAcrossPreviousPeriods({
            execute: vi.fn().mockResolvedValue({ found: true, year: '2023', period: '1', matches: [{ code: 'MAT101' }], periodsChecked: [] })
        });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGrades, communityRepository);

        const result = await getToolHandler(server, 'find_subject_in_previous_periods')({
            subjectQuery: 'calculo 2',
            beforeYear: '2024',
            beforePeriod: '1'
        });

        expect(findGrades.execute).toHaveBeenCalledWith({
            credentials: { cpf: '12345678900' },
            subjectQuery: 'calculo 2',
            beforeYear: '2024',
            beforePeriod: '1'
        });
        expect(result.content[0]!.text).toBe(JSON.stringify({ found: true, year: '2023', period: '1', matches: [{ code: 'MAT101' }], periodsChecked: [] }));
    });

    it('omits the before* filters when not provided', async () => {
        const findGrades = buildFindGradesAcrossPreviousPeriods({ execute: vi.fn().mockResolvedValue({ found: false, periodsChecked: [], searchedBackToYear: '2020' }) });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGrades, communityRepository);

        await getToolHandler(server, 'find_subject_in_previous_periods')({ subjectQuery: 'calculo 2' });

        expect(findGrades.execute).toHaveBeenCalledWith({ credentials: { cpf: '12345678900' }, subjectQuery: 'calculo 2' });
    });

    it('falls back to the not-available message when the use case throws', async () => {
        const findGrades = buildFindGradesAcrossPreviousPeriods({ execute: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGrades, communityRepository);

        const result = await getToolHandler(server, 'find_subject_in_previous_periods')({ subjectQuery: 'calculo 2' });

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: get_schedule', () => {
    it('returns the schedule as JSON text', async () => {
        const repository = buildRepository({ getSchedule: vi.fn().mockResolvedValue([{ weekday: 'Monday' }]) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_schedule')({});

        expect(result.content[0]!.text).toBe(JSON.stringify([{ weekday: 'Monday' }]));
    });

    it('falls back to the not-available message on error', async () => {
        const repository = buildRepository({ getSchedule: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_schedule')({});

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: get_lesson_plan_subjects', () => {
    it('returns the subjects as JSON text', async () => {
        const repository = buildRepository({ getLessonPlanSubjects: vi.fn().mockResolvedValue([{ code: 'MAT101' }]) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_lesson_plan_subjects')({});

        expect(result.content[0]!.text).toBe(JSON.stringify([{ code: 'MAT101' }]));
    });

    it('falls back to the not-available message on error', async () => {
        const repository = buildRepository({ getLessonPlanSubjects: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_lesson_plan_subjects')({});

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: get_lesson_plan', () => {
    it('forwards the planId and returns the plan as JSON text', async () => {
        const repository = buildRepository({ getLessonPlan: vi.fn().mockResolvedValue([{ content: 'Intro' }]) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_lesson_plan')({ planId: 'PLAN-1' });

        expect(repository.getLessonPlan).toHaveBeenCalledWith('12345678900', 'PLAN-1');
        expect(result.content[0]!.text).toBe(JSON.stringify([{ content: 'Intro' }]));
    });

    it('falls back to the not-available message on error', async () => {
        const repository = buildRepository({ getLessonPlan: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', repository, findGradesAcrossPreviousPeriods, communityRepository);

        const result = await getToolHandler(server, 'get_lesson_plan')({ planId: 'PLAN-1' });

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});

describe('createAcademicMcpServer tool: get_community_reports', () => {
    it('returns recent community reports as JSON text, filtered by category', async () => {
        const reports = [{ id: 'p1', authorName: 'Aluno', category: 'FILA_RU', body: 'RU vazio', confirmCount: 2 }];
        const community = buildCommunityRepository({ listRecentForAi: vi.fn().mockResolvedValue(reports) });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGradesAcrossPreviousPeriods, community);

        const result = await getToolHandler(server, 'get_community_reports')({ category: 'FILA_RU' });

        expect(community.listRecentForAi).toHaveBeenCalledWith('FILA_RU');
        expect(result.content[0]!.text).toBe(JSON.stringify(reports));
    });

    it('passes undefined when no category is given', async () => {
        const community = buildCommunityRepository({ listRecentForAi: vi.fn().mockResolvedValue([]) });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGradesAcrossPreviousPeriods, community);

        await getToolHandler(server, 'get_community_reports')({});

        expect(community.listRecentForAi).toHaveBeenCalledWith(undefined);
    });

    it('falls back to the not-available message on error', async () => {
        const community = buildCommunityRepository({ listRecentForAi: vi.fn().mockRejectedValue(new Error('boom')) });
        const server = createAcademicMcpServer('12345678900', buildRepository(), findGradesAcrossPreviousPeriods, community);

        const result = await getToolHandler(server, 'get_community_reports')({});

        expect(result.content[0]!.text).toBe(NOT_AVAILABLE);
    });
});
