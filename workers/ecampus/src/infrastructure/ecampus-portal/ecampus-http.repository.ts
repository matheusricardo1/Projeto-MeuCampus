import { parse, type HTMLElement } from 'node-html-parser';
import { AxiosError } from 'axios';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/value-objects/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import { ResourceNotFoundError } from '@/domain/exceptions/resource-not-found.error';
import type { ScheduleClass } from '@/domain/value-objects/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import { AcademicPeriod } from '@/domain/value-objects/academic-period.value-object';
import { EcampusAuthService } from '@/infrastructure/ecampus-portal/ecampus-auth-service';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';

export class EcampusHttpRepository implements EcampusRepository {
    constructor(private readonly authService: EcampusAuthService) {}

    async logout(credentials: EcampusCredentials): Promise<void> {
        return this.runExclusive(credentials.cpf, async () => {
            logger.info("Logging out from eCampus.");
            await this.authService.logout(credentials);
        });
    }

    async getStudentProfile(credentials: EcampusCredentials): Promise<StudentProfile> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            logger.info("Fetching student profile data...");

            const response = await this.withExternalRetry(
                'student profile',
                () => client.get<string>('/atualizarDadosAluno/index', { timeout: 15000 })
            );
            const tree = parse(response.data);

            const profileData: StudentProfile = {
                academic: {
                    admission_term: this.getInputValue(tree, "anoIngresso"),
                    course: this.getInputValue(tree, "nomeCurso"),
                    shift: this.getInputValue(tree, "turno"),
                    enrollment_number: this.getInputValue(tree, "matricula"),
                },
                personal: {
                    full_name: this.getInputValue(tree, "nomePessoa"),
                },
                contact: {
                    email: this.getInputValue(tree, "endereco.descrMail"),
                    cellphone: this.getInputValue(tree, "endereco.foneCelular"),
                    home_phone: this.getInputValue(tree, "endereco.foneResidencial"),
                }
            };

            logger.info("Profile data extraction complete.");
            return profileData;
        });
    }

    async getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            const params = new URLSearchParams();
            params.append('ano', year);
            params.append('periodo', AcademicPeriod.toEcampusCode(period));

            logger.info(`Fetching grades for year ${year}, period ${period}...`);

            const html = await this.fetchGradesHtml(client, params);
            const tree = parse(html);
            const tables = tree.querySelectorAll('table.grid-notas');

            if (tables.length < 2) {
                logger.warning("Grades tables were not found in the returned HTML.");
                return [];
            }

            const tableGrades = tables[0]!;
            const tableNames = tables[1]!;
            const subjectMap: Record<string, { subject: string; classIdentifier: string }> = {};
            const workloadMap = await this.getLessonPlanWorkloadMap(client).catch((error) => {
                logger.warning("Unable to fetch lesson plan workload map. Attendance summaries will omit workload-based calculations.", {
                    error: error instanceof Error ? error.message : String(error)
                });
                return new Map<string, number>();
            });

            for (const row of tableNames.querySelectorAll('tbody tr')) {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 2) {
                    const code = columns[0]!.textContent.trim();
                    subjectMap[code] = {
                        subject: columns[1]!.textContent.trim(),
                        classIdentifier: columns[2]?.textContent.trim() || ''
                    };
                }
            }

            const reportCard: Grade[] = [];
            for (const row of tableGrades.querySelectorAll('tbody tr')) {
                const columns = row.querySelectorAll('td');
                if (columns.length < 26) continue;

                const code = columns[0]!.textContent.trim();
                if (!code) continue;

                reportCard.push({
                    code,
                    subject: subjectMap[code]?.subject || 'Unknown Subject',
                    class_identifier: subjectMap[code]?.classIdentifier || '',
                    evaluations: this.extractGradeEvaluations(columns),
                    exercise_average: columns[21]?.textContent.trim() || '',
                    final_exam: columns[22]?.textContent.trim() || '',
                    final_grade: columns[23]!.textContent.trim(),
                    absences: columns[24]!.textContent.trim(),
                    attendance: this.calculateAttendanceSummary(workloadMap.get(code) ?? null, columns[24]!.textContent.trim()),
                    status: columns[25]!.textContent.trim()
                });
            }

            logger.info(`Extraction complete: ${reportCard.length} subjects processed.`);
            return reportCard;
        });
    }

    private extractGradeEvaluations(columns: HTMLElement[]): Grade['evaluations'] {
        const evaluations: Grade['evaluations'] = [];

        for (let index = 1; index <= 19; index += 2) {
            const evaluationNumber = Math.floor((index + 1) / 2);
            const weight = columns[index]?.textContent.trim() || '';
            const score = columns[index + 1]?.textContent.trim() || '';

            if (!weight && !score) {
                continue;
            }

            evaluations.push({
                weight,
                score
            });
        }

        return evaluations;
    }

    private calculateAttendanceSummary(workloadHours: number | null, absences: string): Grade['attendance'] {
        const absencesHours = this.parseHours(absences);

        if (!workloadHours || workloadHours <= 0) {
            return {
                workload_hours: null,
                absences_hours: absencesHours,
                max_absences_allowed: null,
                minimum_presence_hours: null,
                presence_hours: null,
                presence_percent: null,
                is_absence_risk: null,
                source: 'missing_workload'
            };
        }

        const maxAbsencesAllowed = Math.floor(workloadHours * 0.25);
        const minimumPresenceHours = workloadHours - maxAbsencesAllowed;
        const presenceHours = Math.max(workloadHours - absencesHours, 0);

        return {
            workload_hours: workloadHours,
            absences_hours: absencesHours,
            max_absences_allowed: maxAbsencesAllowed,
            minimum_presence_hours: minimumPresenceHours,
            presence_hours: presenceHours,
            presence_percent: Math.max(0, Math.min(100, Math.round((presenceHours / workloadHours) * 100))),
            is_absence_risk: absencesHours > maxAbsencesAllowed,
            source: 'computed'
        };
    }

    private parseHours(value: string): number {
        const match = value.match(/\d+/);
        return match ? Number(match[0]) : 0;
    }

    private parseOptionalHours(value: string): number | null {
        const match = value.match(/\d+/);
        return match ? Number(match[0]) : null;
    }

    private toTitleName(value: string): string {
        return value
            .toLocaleLowerCase('pt-BR')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/(^|[\s'-])([\p{L}])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`);
    }

    private async getLessonPlanWorkloadMap(client: Awaited<ReturnType<EcampusAuthService['getAuthenticatedClient']>>): Promise<Map<string, number>> {
        const response = await this.withExternalRetry(
            'lesson plan workload map',
            () => client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 })
        );
        const subjects = this.extractLessonPlanSubjects(response.data);
        const workloadMap = new Map<string, number>();

        for (const subject of subjects) {
            if (subject.workloadHours) {
                workloadMap.set(subject.code, subject.workloadHours);
            }
        }

        return workloadMap;
    }

    private async fetchGradesHtml(client: Awaited<ReturnType<EcampusAuthService['getAuthenticatedClient']>>, params: URLSearchParams): Promise<string> {
        try {
            const response = await client.post<string>('/notasEFrequencia/getNotas', params, { timeout: 15000 });
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError && error.response?.status === 500) {
                logger.warning("Grades AJAX endpoint returned 500. Falling back to grades index page.", {
                    url: '/notasEFrequencia/getNotas',
                    externalStatus: error.response.status
                });

                const fallbackResponse = await client.get<string>('/notasEFrequencia/index', { timeout: 15000 });
                return fallbackResponse.data;
            }

            throw error;
        }
    }

    async getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            logger.info("Fetching the current schedule...");

            const response = await this.withExternalRetry(
                'schedule',
                () => client.post<string>('/quadroHorarioGraduacaoRegular/getHorarios', {}, { timeout: 15000 })
            );
            const html = response.data;
            const tree = parse(html);
            const subjectMap: Record<string, string> = {};
            const tables = tree.querySelectorAll('table.grid-notas');

            if (tables.length > 0) {
                for (const row of tables[0]!.querySelectorAll('tbody tr')) {
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 3) {
                        subjectMap[cols[0]!.textContent.trim()] = cols[1]!.textContent.trim();
                    }
                }
            }

            const pattern = /"start":\s*new Date\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\).*?"end":\s*new Date\(\d+,\s*\d+,\s*\d+,\s*(\d+),\s*(\d+)\).*?"title":\s*"(.*?)"/gs;
            const schedule: ScheduleClass[] = [];
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(html)) !== null) {
                const [, year, jsMonth, day, startH, startM, endH, endM, title] = match;

                if (!year || !jsMonth || !day || !startH || !startM || !endH || !endM || !title) {
                    continue;
                }

                const dateObj = new Date(parseInt(year), parseInt(jsMonth), parseInt(day));
                const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                const code = title.includes(' - ') ? title.split(' - ')[0]!.trim() : title;

                schedule.push({
                    weekday,
                    start_time: `${startH.padStart(2, '0')}:${startM.padStart(2, '0')}`,
                    end_time: `${endH.padStart(2, '0')}:${endM.padStart(2, '0')}`,
                    code,
                    subject: subjectMap[code] || "Unknown Subject",
                    class_identifier: title
                });
            }

            const daysOrder: Record<string, number> = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
            schedule.sort((a, b) => {
                const dayDiff = (daysOrder[a.weekday] || 8) - (daysOrder[b.weekday] || 8);
                if (dayDiff !== 0) return dayDiff;
                return a.start_time.localeCompare(b.start_time);
            });

            logger.info(`Extraction complete: ${schedule.length} classes mapped.`);
            return schedule;
        });
    }

    async getLessonPlanSubjects(credentials: EcampusCredentials): Promise<LessonPlanSubject[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            logger.info("Fetching lesson plan subjects...");

            const response = await this.withExternalRetry(
                'lesson plan subjects',
                () => client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 })
            );
            const subjects = this.extractLessonPlanSubjects(response.data);

            logger.info(`Extraction complete: ${subjects.length} lesson plan subjects mapped.`);
            return subjects;
        });
    }

    async getLessonPlan(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            const resolvedPlanId = await this.resolveLessonPlanId(client, planId);
            const params = new URLSearchParams();
            params.append('id', resolvedPlanId);
            params.append('version', '');
            params.append('form', 'true');
            params.append('formCreate', 'false');

            logger.info(`Fetching lesson plan for ID: ${resolvedPlanId}...`);

            const response = await this.withExternalRetry(
                'lesson plan',
                () => client.post<string>('/cienciaAlunoPE/getCronograma', params, { timeout: 15000 })
            );
            const tree = parse(response.data);
            const lessonPlan: LessonPlanItem[] = [];

            for (const row of tree.querySelectorAll('tbody tr')) {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 5) {
                    const date = columns[0]!.textContent.trim();
                    if (!date) continue;

                    const workload = columns[1]!.textContent.trim();
                    lessonPlan.push({
                        date,
                        workload: isNaN(Number(workload)) ? workload : parseInt(workload),
                        type: columns[2]!.textContent.trim(),
                        content: columns[3]!.textContent.trim(),
                        professor: columns[4]!.textContent.trim()
                    });
                }
            }

            logger.info(`Extraction complete: ${lessonPlan.length} lessons mapped.`);
            return lessonPlan;
        });
    }

    private extractLessonPlanSubjects(html: string): LessonPlanSubject[] {
        const tree = parse(html);
        const candidateTables = tree.querySelectorAll('table');
        const subjectTable = candidateTables.find((table) => {
            return Boolean(table.querySelector('input[name="idPlano"]')) && table.querySelectorAll('tr').some((row) => row.querySelectorAll('td').length >= 7);
        });

        if (!subjectTable) {
            logger.warning("Lesson plan subject table was not found in the returned HTML.");
            return [];
        }

        const subjects: LessonPlanSubject[] = [];
        for (const row of subjectTable.querySelectorAll('tr')) {
            const columns = row.querySelectorAll('td');
            if (columns.length < 7) continue;

            const planInput = columns[0]!.querySelector('input[name="idPlano"]');
            if (!planInput) continue;

            const rawPlanId = planInput.getAttribute('value')?.trim() || null;
            const planId = rawPlanId && rawPlanId !== 'null' ? rawPlanId : null;
            const code = columns[1]!.textContent.trim();

            if (!code) continue;

            subjects.push({
                planId,
                code,
                subject: this.toTitleName(columns[2]!.textContent.trim()),
                classIdentifier: columns[3]!.textContent.trim(),
                credits: this.parseOptionalHours(columns[4]?.textContent.trim() || ''),
                professor: this.toTitleName(columns[6]!.textContent.trim()),
                workloadHours: this.parseOptionalHours(columns[5]?.textContent.trim() || ''),
                available: Boolean(planId)
            });
        }

        return subjects;
    }

    private async resolveLessonPlanId(client: Awaited<ReturnType<EcampusAuthService['getAuthenticatedClient']>>, planIdOrCode: string): Promise<string> {
        const value = planIdOrCode.trim();
        if (/^\d+$/.test(value)) {
            return value;
        }

        const response = await this.withExternalRetry(
            'lesson plan subject resolution',
            () => client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 })
        );
        const subjects = this.extractLessonPlanSubjects(response.data);
        const subject = subjects.find((item) => item.code.toLowerCase() === value.toLowerCase());

        if (!subject) {
            throw new ResourceNotFoundError(`Materia ${value} nao encontrada nos seus planos de ensino.`);
        }

        if (!subject.planId) {
            throw new ResourceNotFoundError(`Plano de ensino ainda nao disponivel para ${subject.code} - ${subject.subject}.`);
        }

        return subject.planId;
    }

    private runExclusive<T>(_key: string, operation: () => Promise<T>): Promise<T> {
        // Each job owns an HTTP client and imported cookie jar, so requests for the
        // same user can safely run concurrently in separate worker slots.
        return operation();
    }

    private async withExternalRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                const shouldRetry = error instanceof AxiosError && (error.response?.status || 0) >= 500 && attempt < maxAttempts;

                if (!shouldRetry) {
                    throw error;
                }

                logger.warning(`eCampus returned ${error.response?.status} while fetching ${label}. Retrying once...`, {
                    externalStatus: error.response?.status,
                    externalStatusText: error.response?.statusText,
                    url: error.config?.url
                });

                await this.delay(700);
            }
        }

        throw new Error(`Unable to fetch ${label}.`);
    }

    private delay(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    private getInputValue(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`input[id="${elementId}"]`);
        return node?.getAttribute('value')?.trim() || "";
    }

}
