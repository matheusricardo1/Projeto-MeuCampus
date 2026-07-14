import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';
import { UFAM_ACADEMIC_RULES } from '@academic/domain/knowledge/ufam-academic-rules';
import type { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';

const NOT_AVAILABLE = 'Dados não disponíveis. Oriente o usuário a abrir o app para sincronizar.';

export function createAcademicMcpServer(
    userId: string,
    repository: AcademicDataRepository,
    findGradesAcrossPreviousPeriods: FindGradesAcrossPreviousPeriodsUseCase
): McpServer {
    const server = new McpServer({
        name: 'academic-data',
        version: '1.0.0'
    });

    server.registerResource(
        'ufam_academic_rules',
        'academic://rules/ufam',
        {
            title: 'Regras academicas da UFAM',
            description: 'Regras oficiais (Resolucao 023/2017) de media final, frequencia e trancamento, com exemplos de calculo.',
            mimeType: 'text/plain'
        },
        async (uri) => ({
            contents: [{ uri: uri.href, text: UFAM_ACADEMIC_RULES, mimeType: 'text/plain' }]
        })
    );

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
            period: z.string().optional().describe('Período letivo: 1, 2, ferias1, ferias2 ou especial. Omita para usar o atual.')
        },
        async ({ year, period }) => {
            try {
                const resolved = year && period
                    ? { year, period }
                    : await resolveCurrentGradesPeriod(repository, userId);

                if (!resolved.year || !resolved.period) {
                    return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
                }

                const grades = await repository.getGrades(userId, resolved.year, resolved.period);
                return { content: [{ type: 'text' as const, text: JSON.stringify(grades) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'find_subject_in_previous_periods',
        'Busca uma disciplina em períodos letivos ANTERIORES ao atual, quando ela não aparece nas notas/disciplinas do período atual. Percorre os períodos de trás para frente (do mais recente ao período de ingresso do aluno), primeiro no cache e, se precisar, disparando uma raspagem nova no eCampus — por isso pode demorar mais que as outras tools, avise o aluno que vai levar alguns segundos a mais. Para no primeiro período em que encontrar uma disciplina de nome parecido: trate esse resultado como a disciplina mais recente com esse nome e converse sobre ele, só continue buscando um período ainda mais antigo (usando beforeYear/beforePeriod) se o aluno disser explicitamente que quer uma ocorrência anterior a essa. Só use esta tool depois de já ter checado o período atual (get_current_grades / get_lesson_plan_subjects) e não ter achado a disciplina.',
        {
            subjectQuery: z.string().describe('Nome ou parte do nome da disciplina que o aluno mencionou.'),
            beforeYear: z.string().optional().describe('Ano a partir do qual continuar buscando para trás (exclusive). Use só quando o aluno disser que quer um período ainda mais antigo que o já encontrado.'),
            beforePeriod: z.string().optional().describe('Período (1 ou 2) a partir do qual continuar buscando para trás (exclusive). Sempre em conjunto com beforeYear.')
        },
        async ({ subjectQuery, beforeYear, beforePeriod }) => {
            try {
                const result = await findGradesAcrossPreviousPeriods.execute({
                    credentials: { cpf: userId },
                    subjectQuery,
                    ...(beforeYear && beforePeriod ? { beforeYear, beforePeriod } : {})
                });
                return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
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
