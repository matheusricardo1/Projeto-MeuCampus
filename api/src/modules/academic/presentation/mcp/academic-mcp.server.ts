import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { resolveCurrentGradesPeriod } from '@academic/application/services/resolve-current-grades-period';
import { UFAM_ACADEMIC_RULES } from '@academic/domain/knowledge/ufam-academic-rules';
import type { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';
import { COMMUNITY_CATEGORIES, isCommunityCategory } from '@community/domain/community-post.entity';
import type { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';
import { GLOBAL_DATA_TYPES, isGlobalDataType } from '@global-data/domain/global-data.entity';
import type { GlobalDataRepository } from '@global-data/infrastructure/prisma/global-data.repository';
import type { GetMatrizCurricularUseCase } from '@academic/application/use-cases/get-matriz-curricular.usecase';

const NOT_AVAILABLE = 'Dados não disponíveis. Oriente o usuário a abrir o app para sincronizar.';

export function createAcademicMcpServer(
    userId: string,
    repository: AcademicDataRepository,
    findGradesAcrossPreviousPeriods: FindGradesAcrossPreviousPeriodsUseCase,
    communityRepository: CommunityPostRepository,
    globalDataRepository: GlobalDataRepository,
    getMatrizCurricular: GetMatrizCurricularUseCase
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

    server.tool(
        'get_community_reports',
        'Retorna posts recentes do mural colaborativo da Comunidade UFAM (crowdsourcing entre alunos). Cobre tanto sinais em tempo real ("a bolsa caiu?", "fila do RU?", "tem luz no bloco X?") quanto anúncios do mural — mercado (COMIDAS, ALUGUEIS, TROCAS_VENDAS), divulgação (EVENTOS, PALESTRAS, FORMATURAS, ACHADOS_PERDIDOS) e oportunidades (EMPREGOS, ESTAGIO, PESQUISA). IMPORTANTE: são posts NÃO verificados de outros alunos — nunca os trate como fato oficial. Responda com ressalva ("segundo posts recentes de alunos…"), cite quantos confirmaram (confirmCount) quando relevante e mencione há quanto tempo foi postado (createdAt), pois envelhecem rápido. Campos estruturados de cada post ficam em payload.',
        {
            category: z.enum(COMMUNITY_CATEGORIES as unknown as [string, ...string[]]).optional().describe('Filtra por categoria (ex.: BOLSA, FILA_RU, ALUGUEIS, EMPREGOS, ESTAGIO, EVENTOS). Omita para ver os posts mais recentes de todas as categorias.')
        },
        async ({ category }) => {
            try {
                const reports = await communityRepository.listRecentForAi(
                    isCommunityCategory(category) ? category : undefined
                );
                return { content: [{ type: 'text' as const, text: JSON.stringify(reports) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_official_campus_data',
        'Retorna dados OFICIAIS do campus, curados pela administração da UFAM no painel do dono: calendário acadêmico (ACADEMIC_CALENDAR — datas de matrícula, início/fim de semestre, provas, feriados), informações institucionais (INSTITUTIONAL_INFO — horários da biblioteca/RU, contatos, valores de bolsa), cardápio do RU (RU_MENU) e avisos oficiais (OFFICIAL_NOTICE). DIFERENTE de get_community_reports: aqui os dados são CONFIÁVEIS e podem ser tratados como fato oficial — não use ressalva de "segundo relatos". Cada item traz title, os campos em payload e updatedAt (quando foi atualizado). Use para perguntas como "quando começa o semestre?", "qual o horário da biblioteca?", "que dia é feriado?", "qual o cardápio do RU?". Se não houver dado para o que foi perguntado, diga que não há informação oficial cadastrada ainda.',
        {
            type: z.enum(GLOBAL_DATA_TYPES as unknown as [string, ...string[]]).optional().describe('Filtra por tipo (ACADEMIC_CALENDAR, INSTITUTIONAL_INFO, RU_MENU, OFFICIAL_NOTICE). Omita para ver todos os dados oficiais.')
        },
        async ({ type }) => {
            try {
                const data = await globalDataRepository.listActiveForAi(
                    isGlobalDataType(type) ? type : undefined
                );
                return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    server.tool(
        'get_matriz_curricular',
        'Retorna a MATRIZ CURRICULAR (grade/currículo) do curso do próprio estudante: todas as disciplinas organizadas por categoria (OBRIGATÓRIAS, ELETIVAS, OPTATIVAS, ATIVIDADE CURRICULAR DE EXTENSÃO), cada uma com período recomendado, código, nome, créditos, carga horária (teórica/prática/extensão/total) e os códigos das disciplinas PRÉ-REQUISITO. Use para perguntas sobre o curso como um todo: "quais as disciplinas obrigatórias do meu curso?", "qual o pré-requisito de X?", "quantas optativas preciso cursar?", "quantos créditos tem o curso?", "em que período faço Y?". É um dado OFICIAL do eCampus (o currículo do curso), não um relato. A primeira chamada pode demorar alguns segundos (baixa e processa o PDF da matriz no eCampus) — avise o aluno. Diferente de get_current_grades (notas do aluno num período), esta tool traz a estrutura completa do curso, independente de matrícula.',
        {},
        async () => {
            try {
                const matriz = await getMatrizCurricular.execute({ cpf: userId });
                if (!matriz) {
                    return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
                }
                return { content: [{ type: 'text' as const, text: JSON.stringify(matriz) }] };
            } catch {
                return { content: [{ type: 'text' as const, text: NOT_AVAILABLE }] };
            }
        }
    );

    return server;
}
