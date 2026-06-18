import { parse, type HTMLElement } from 'node-html-parser';
import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { Grade } from '@ecampus/domain/models/grade';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';
import { EcampusAuthService } from '@ecampus/infrastructure/ecampus/ecampus-auth-service';
import { logger } from '@ecampus/infrastructure/logging/console-logger';

export class EcampusHttpRepository implements EcampusRepository {
    constructor(private readonly authService: EcampusAuthService) {}

    async getStudentProfile(credentials: EcampusCredentials): Promise<StudentProfile> {
        const client = await this.authService.getAuthenticatedClient(credentials);
        logger.info("Fetching student profile data...");

        const response = await client.get<string>('/atualizarDadosAluno/index', { timeout: 15000 });
        const tree = parse(response.data);

        const profileData: StudentProfile = {
            academic: {
                admission_type: this.getInputValue(tree, "tipoIngresso"),
                admission_term: this.getInputValue(tree, "anoIngresso"),
                admission_date: this.getInputValue(tree, "dataIngresso"),
                course: this.getInputValue(tree, "nomeCurso"),
                shift: this.getInputValue(tree, "turno"),
                enrollment_number: this.getInputValue(tree, "matricula"),
            },
            personal: {
                full_name: this.getInputValue(tree, "nomePessoa"),
                birth_date: this.getInputValue(tree, "aluno.dtNascimento"),
                gender: this.getRadioValue(tree, "aluno.sexo"),
                marital_status: this.getSelectText(tree, "aluno.estadoCivilItem"),
                nationality: this.getSelectText(tree, "aluno.nacionalidadeItem"),
                ethnicity: this.getSelectText(tree, "aluno.etniaItem"),
                father_name: this.getInputValue(tree, "aluno.nomePai"),
                mother_name: this.getInputValue(tree, "aluno.nomeMae"),
            },
            contact: {
                email: this.getInputValue(tree, "endereco.descrMail"),
                cellphone: this.getInputValue(tree, "endereco.foneCelular"),
                home_phone: this.getInputValue(tree, "endereco.foneResidencial"),
            },
            address: {
                zip_code: this.getInputValue(tree, "endereco.descrCep"),
                street: this.getInputValue(tree, "endereco.descrRua"),
                number: this.getInputValue(tree, "endereco.descrNumero"),
                neighborhood: this.getInputValue(tree, "endereco.descrBairro"),
                state: this.getSelectText(tree, "endereco.uf.id"),
                city: this.getSelectText(tree, "endereco.cidade.id"),
            }
        };

        logger.info("Profile data extraction complete.");
        return profileData;
    }

    async getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]> {
        const client = await this.authService.getAuthenticatedClient(credentials);
        const params = new URLSearchParams();
        params.append('ano', year);
        params.append('periodo', period);

        logger.info(`Fetching grades for year ${year}, period ${period}...`);

        const response = await client.post<string>('/notasEFrequencia/getNotas', params, { timeout: 15000 });
        const tree = parse(response.data);
        const tables = tree.querySelectorAll('table.grid-notas');

        if (tables.length < 2) {
            logger.warning("Grades tables were not found in the returned HTML.");
            return [];
        }

        const tableGrades = tables[0]!;
        const tableNames = tables[1]!;
        const subjectMap: Record<string, string> = {};

        for (const row of tableNames.querySelectorAll('tbody tr')) {
            const columns = row.querySelectorAll('td');
            if (columns.length >= 2) {
                subjectMap[columns[0]!.textContent.trim()] = columns[1]!.textContent.trim();
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
                subject: subjectMap[code] || 'Unknown Subject',
                final_grade: columns[23]!.textContent.trim(),
                absences: columns[24]!.textContent.trim(),
                status: columns[25]!.textContent.trim()
            });
        }

        logger.info(`Extraction complete: ${reportCard.length} subjects processed.`);
        return reportCard;
    }

    async getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]> {
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
    }

    async getLessonPlan(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]> {
        const client = await this.authService.getAuthenticatedClient(credentials);
        const params = new URLSearchParams();
        params.append('id', planId);
        params.append('version', '');
        params.append('form', 'true');
        params.append('formCreate', 'false');

        logger.info(`Fetching lesson plan for ID: ${planId}...`);

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
                    workload: isNaN(Number(workload)) ? workload : parseInt(workload),
                    type: columns[2]!.textContent.trim(),
                    content: columns[3]!.textContent.trim(),
                    professor: columns[4]!.textContent.trim()
                });
            }
        }

        logger.info(`Extraction complete: ${lessonPlan.length} lessons mapped.`);
        return lessonPlan;
    }

    private getInputValue(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`input[id="${elementId}"]`);
        return node?.getAttribute('value')?.trim() || "";
    }

    private getSelectText(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`select[id="${elementId}"] option[selected="selected"]`);
        return node?.textContent?.trim() || "";
    }

    private getRadioValue(tree: HTMLElement, elementName: string): string {
        const node = tree.querySelector(`input[type="radio"][name="${elementName}"][checked="checked"]`);
        return node?.getAttribute('value')?.trim() || "";
    }
}
