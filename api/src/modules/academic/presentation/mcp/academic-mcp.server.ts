import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';

const NOT_AVAILABLE = 'Dados não disponíveis. Oriente o usuário a abrir o app para sincronizar.';

export function createAcademicMcpServer(
    userId: string,
    repository: AcademicDataRepository
): McpServer {
    const server = new McpServer({
        name: 'academic-data',
        version: '1.0.0'
    });

    server.tool(
        'get_student_profile',
        'Retorna o perfil do estudante: nome completo, curso, matrícula e período atual.',
        {},
        async () => {
            try {
                const profile = await repository.getProfile(userId);
                return { content: [{ type: 'text' as const, text: JSON.stringify(profile) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_current_grades',
        'Retorna as notas do estudante por disciplina no período informado. Se year e period não forem informados, usa o período letivo atual.',
        {
            year: z.string().optional().describe('Ano letivo (ex: 2025). Omita para usar o atual.'),
            period: z.string().optional().describe('Período letivo: 1 ou 2. Omita para usar o atual.')
        },
        async ({ year, period }) => {
            try {
                const resolved = year && period
                    ? { year, period }
                    : await resolveCurrentGradesPeriod(repository, userId);
                const grades = await repository.getGrades(userId, resolved.year, resolved.period);
                return { content: [{ type: 'text' as const, text: JSON.stringify(grades) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_schedule',
        'Retorna a grade de horários semanal do estudante com dias, horários e disciplinas.',
        {},
        async () => {
            try {
                const schedule = await repository.getSchedule(userId);
                return { content: [{ type: 'text' as const, text: JSON.stringify(schedule) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_lesson_plan_subjects',
        'Lista as disciplinas disponíveis com seus planos de ensino e o planId de cada uma. Use antes de chamar get_lesson_plan.',
        {},
        async () => {
            try {
                const subjects = await repository.getLessonPlanSubjects(userId);
                return { content: [{ type: 'text' as const, text: JSON.stringify(subjects) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_lesson_plan',
        'Retorna o plano de ensino completo de uma disciplina: ementa, objetivos, conteúdo e bibliografia.',
        {
            planId: z.string().describe('O planId da disciplina. Obtenha via get_lesson_plan_subjects.')
        },
        async ({ planId }) => {
            try {
                const plan = await repository.getLessonPlan(userId, planId);
                return { content: [{ type: 'text' as const, text: JSON.stringify(plan) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    return server;
}
