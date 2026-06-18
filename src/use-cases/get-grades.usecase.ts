// src/use-cases/get-grades.usecase.ts
import { parse } from 'node-html-parser';
import { EcampusClient } from '../core/ecampus-client';
import { AuthenticationError, logger } from '../core/logger';

export class GetGradesUseCase {
    constructor(private readonly client: EcampusClient) {}

    async execute(year: string, period: string): Promise<Record<string, any>[]> {
        if (!this.client.isAuthenticated) {
            throw new AuthenticationError("Attempted to access protected route without auth.");
        }

        const params = new URLSearchParams();
        params.append('ano', year);
        params.append('periodo', period);

        logger.info(`Fetching grades for year ${year}, period ${period}...`);
        
        try {
            const response = await this.client.session.post('/notasEFrequencia/getNotas', params, { timeout: 15000 });
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
                    const code = columns[0]!.textContent.trim();
                    const name = columns[1]!.textContent.trim();
                    subjectMap[code] = name;
                }
            }

            const reportCard: Record<string, any>[] = [];
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

        } catch (error: any) {
            logger.error(`Failed to load grades: ${error.message}`);
            throw error;
        }
    }
}
