// src/use-cases/get-schedule.usecase.ts
import { parse } from 'node-html-parser';
import { EcampusClient } from '../core/ecampus-client';
import { AuthenticationError, logger } from '../core/logger';

export class GetScheduleUseCase {
    constructor(private readonly client: EcampusClient) {}

    async execute(): Promise<Record<string, any>[]> {
        if (!this.client.isAuthenticated) {
            throw new AuthenticationError("Attempted to access protected route without auth.");
        }

        logger.info("Fetching the current schedule...");
        
        try {
            const response = await this.client.session.post('/quadroHorarioGraduacaoRegular/getHorarios', {}, { timeout: 15000 });
            const html = response.data as string;
            const tree = parse(html);
            
            const subjectMap: Record<string, string> = {};
            const tables = tree.querySelectorAll('table.grid-notas');
            if (tables.length > 0) {
                for (const row of tables[0]!.querySelectorAll('tbody tr')) {
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 3) {
                        const code = cols[0]!.textContent.trim();
                        const name = cols[1]!.textContent.trim();
                        subjectMap[code] = name;
                    }
                }
            }

            const pattern = /"start":\s*new Date\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\).*?"end":\s*new Date\(\d+,\s*\d+,\s*\d+,\s*(\d+),\s*(\d+)\).*?"title":\s*"(.*?)"/gs;
            
            const schedule: Record<string, any>[] = [];
            let match: RegExpExecArray | null;
            
            while ((match = pattern.exec(html)) !== null) {
                const [, year, jsMonth, day, startH, startM, endH, endM, title] = match;
                
                if (!year || !jsMonth || !day || !startH || !startM || !endH || !endM || !title) {
                    continue;
                }

                const month = parseInt(jsMonth);
                const dateObj = new Date(parseInt(year), month, parseInt(day));
                const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                
                const code = title.includes(' - ') ? title.split(' - ')[0]!.trim() : title;
                const subjectName = subjectMap[code] || "Unknown Subject";

                schedule.push({
                    weekday,
                    start_time: `${startH.padStart(2, '0')}:${startM.padStart(2, '0')}`,
                    end_time: `${endH.padStart(2, '0')}:${endM.padStart(2, '0')}`,
                    code,
                    subject: subjectName,
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

        } catch (error: any) {
            logger.error(`Failed to load schedule: ${error.message}`);
            throw error;
        }
    }
}
