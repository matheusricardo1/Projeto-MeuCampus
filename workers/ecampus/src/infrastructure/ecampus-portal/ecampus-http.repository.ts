import { parse, type HTMLElement } from 'node-html-parser';
import { AxiosError } from 'axios';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/value-objects/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import { ResourceNotFoundError } from '@/domain/exceptions/resource-not-found.error';
import type { ScheduleClass } from '@/domain/value-objects/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import type { CurrentAcademicPeriod, EcampusRepository } from '@/domain/repositories/ecampus.repository';
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

            const response = await client.get<string>('/atualizarDadosAluno/index', { timeout: 15000 });
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

    async getCurrentPeriod(credentials: EcampusCredentials): Promise<CurrentAcademicPeriod> {
        return this.runExclusive(credentials.cpf, async () => {
            logger.info("Resolving the current academic period from eCampus...");

            const client = await this.authService.getAuthenticatedClient(credentials);
            const response = await client.get<string>('/notasEFrequencia/index', { timeout: 15000 });
            const tree = parse(response.data);
            const resolved = this.extractSelectedPeriod(tree);

            if (resolved) {
                logger.info(`Resolved current academic period: ${resolved.year}/${resolved.period}.`);
                return resolved;
            }

            // eCampus's session-scoped "selected year/period" can be unresolved
            // on this single hit (e.g. right after login). Fall back to a
            // calendar guess instead of retrying or hard-failing the whole
            // grades load — grades for a mis-guessed period simply won't be
            // cached yet, which the caller already handles as a normal
            // "needs scrape" state instead of a dead end.
            const guess = AcademicPeriod.guessCurrent();
            logger.error('Could not resolve the current academic period from eCampus; falling back to a calendar guess.', {
                yearInputHtml: tree.querySelector('input#ano')?.outerHTML ?? null,
                periodoSelectHtml: tree.querySelector('select[name="periodo"]')?.outerHTML ?? null,
                guessedYear: guess.year,
                guessedPeriod: guess.period
            });
            return { year: guess.year, period: guess.period };
        });
    }

    private extractSelectedPeriod(tree: HTMLElement): CurrentAcademicPeriod | null {
        const year = tree.querySelector('input#ano')?.getAttribute('value')?.trim();
        const options = tree.querySelectorAll('select[name="periodo"] option');
        // eCampus's server-rendered HTML doesn't always mark an option with
        // `selected="selected"` explicitly — a plain <select> then falls
        // back to whichever option is first, same as a real browser would.
        // Requiring an explicit `selected` attribute was throwing "unable to
        // determine the period" for accounts where eCampus omits it.
        const selectedOption = options.find((option) => option.getAttribute('selected') !== undefined)
            ?? options.find((option) => (option.getAttribute('value')?.trim() ?? '') !== '');
        const ecampusCode = selectedOption?.getAttribute('value')?.trim();

        if (!year || !ecampusCode) {
            return null;
        }

        return { year, period: AcademicPeriod.fromEcampusCode(ecampusCode) };
    }

    async getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            const params = new URLSearchParams();
            params.append('ano', year);
            params.append('periodo', AcademicPeriod.toEcampusCode(period));

            logger.info(`Fetching grades for year ${year}, period ${period}...`);

            const [html, workloadMap] = await Promise.all([
                this.fetchGradesHtml(client, params, year, period),
                this.getLessonPlanWorkloadMap(client).catch((error) => {
                    logger.warning("Unable to fetch lesson plan workload map. Attendance summaries will omit workload-based calculations.", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    return new Map<string, number>();
                })
            ]);
            const tree = parse(html);
            const tables = tree.querySelectorAll('table.grid-notas');

            if (tables.length < 2) {
                logger.warning("Grades tables were not found in the returned HTML.");
                return [];
            }

            const tableGrades = tables[0]!;
            const tableNames = tables[1]!;
            const subjectMap: Record<string, { subject: string; classIdentifier: string }> = {};

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
            let skippedRows = 0;
            for (const row of tableGrades.querySelectorAll('tbody tr')) {
                const columns = row.querySelectorAll('td');
                if (columns.length < 26) {
                    skippedRows += 1;
                    continue;
                }

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

            if (skippedRows > 0) {
                logger.warning(`Skipped ${skippedRows} grade row(s) with an unexpected column count.`);
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
        const response = await client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 });
        const subjects = this.extractLessonPlanSubjects(response.data);
        const workloadMap = new Map<string, number>();

        for (const subject of subjects) {
            if (subject.workloadHours) {
                workloadMap.set(subject.code, subject.workloadHours);
            }
        }

        return workloadMap;
    }

    private async fetchGradesHtml(client: Awaited<ReturnType<EcampusAuthService['getAuthenticatedClient']>>, params: URLSearchParams, year: string, period: string): Promise<string> {
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
                const fallbackTree = parse(fallbackResponse.data);
                const resolved = this.extractSelectedPeriod(fallbackTree);

                // The index page always reflects whatever period is currently
                // selected in-session, which may not be the one we asked for —
                // returning it unchecked would silently mislabel these grades
                // as belonging to `year`/`period` in the cache.
                //
                // extractSelectedPeriod (via AcademicPeriod.fromEcampusCode) can only
                // ever resolve to '1'/'2' — intersession periods (ferias1/ferias2/
                // especial) have no equivalent and collapse there by design. So for a
                // requested intersession period, resolved.period could never match it
                // even when eCampus genuinely is showing the right data — only the
                // year is checked in that case, trusting eCampus's in-session state.
                const periodMustMatch = period === '1' || period === '2';
                if (!resolved || resolved.year !== year || (periodMustMatch && resolved.period !== period)) {
                    throw new Error(
                        `Grades fallback page shows period ${resolved?.year ?? 'unknown'}/${resolved?.period ?? 'unknown'}, not the requested ${year}/${period}.`
                    );
                }

                return fallbackResponse.data;
            }

            throw error;
        }
    }

    async getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]> {
        return this.runExclusive(credentials.cpf, async () => {
            const client = await this.authService.getAuthenticatedClient(credentials);
            logger.info("Fetching the current schedule...");

            const response = await client.post<string>('/quadroHorarioGraduacaoRegular/getHorarios', {}, { timeout: 15000 });
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

            const pattern = /"start":\s*new Date\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)*\).*?"end":\s*new Date\(\d+,\s*\d+,\s*\d+,\s*(\d+),\s*(\d+)(?:,\s*\d+)*\).*?"title":\s*"(.*?)"/gs;
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

            const response = await client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 });
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

            const response = await client.post<string>('/cienciaAlunoPE/getCronograma', params, { timeout: 15000 });
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
                        workload: workload && !isNaN(Number(workload)) ? parseInt(workload, 10) : workload,
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

        return this.deduplicateLessonPlanSubjects(subjects);
    }

    // eCampus's plan table can list the same discipline more than once (e.g. a
    // leftover row from a past enrollment attempt) with an identical name but a
    // different code per row. Grouping by code alone (as the frontend does)
    // then renders one card per row instead of one per discipline, so collapse
    // same-named rows here, preferring the one with a usable plan id.
    private deduplicateLessonPlanSubjects(subjects: LessonPlanSubject[]): LessonPlanSubject[] {
        const bySubjectName = new Map<string, LessonPlanSubject>();

        for (const subject of subjects) {
            const key = subject.subject.trim().toLocaleLowerCase('pt-BR');
            const existing = bySubjectName.get(key);

            if (!existing || (!existing.planId && subject.planId)) {
                bySubjectName.set(key, subject);
            }
        }

        return Array.from(bySubjectName.values());
    }

    private async resolveLessonPlanId(client: Awaited<ReturnType<EcampusAuthService['getAuthenticatedClient']>>, planIdOrCode: string): Promise<string> {
        const value = planIdOrCode.trim();
        if (/^\d+$/.test(value)) {
            return value;
        }

        const response = await client.get<string>('/cienciaAlunoPE/index', { timeout: 15000 });
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

    private getInputValue(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`input[id="${elementId}"]`);
        return node?.getAttribute('value')?.trim() || "";
    }

}
