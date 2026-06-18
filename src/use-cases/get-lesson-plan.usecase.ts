// src/use-cases/get-lesson-plan.usecase.ts
import { parse } from 'node-html-parser';
import { EcampusClient } from '../core/ecampus-client';
import { AuthenticationError, logger } from '../core/logger';

export class GetLessonPlanUseCase {
    constructor(private readonly client: EcampusClient) {}

    async execute(planId: string): Promise<Record<string, any>[]> {
        if (!this.client.isAuthenticated) {
            throw new AuthenticationError("Attempted to access protected route without auth.");
        }

        const params = new URLSearchParams();
        params.append('id', planId);
        params.append('version', '');
        params.append('form', 'true');
        params.append('formCreate', 'false');

        logger.info(`Fetching lesson plan for ID: ${planId}...`);
        
        try {
            const response = await this.client.session.post('/cienciaAlunoPE/getCronograma', params, { timeout: 15000 });
            const tree = parse(response.data);
            
            const lessonPlan: Record<string, any>[] = [];
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

        } catch (error: any) {
            logger.error(`Failed to load lesson plan: ${error.message}`);
            throw error;
        }
    }
}
