import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@/modules/academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import type { MatrizCurricular } from '@academic/domain/entities/matriz-curricular.entity';
import { scrapingJobDedupeKey } from '@academic/application/services/scraping-job-dedupe-key';

/**
 * Returns the student's curriculum matrix (matriz curricular). Reads the cache
 * first (instant); on a miss, dispatches a live eCampus scrape (the worker
 * resolves the student's course + current version, downloads the report PDF
 * and parses it) and waits for it before reading the cache again. Since the
 * matrix rarely changes, once cached it serves for a long time.
 */
export class GetMatrizCurricularUseCase {
    private static readonly LIVE_SCRAPE_TIMEOUT_MS = 25000;

    constructor(
        private readonly cache: AcademicDataRepository,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(credentials: AcademicCredentials): Promise<MatrizCurricular | null> {
        try {
            return await this.cache.getMatrizCurricular(credentials.cpf);
        } catch (error) {
            if (!(error instanceof AcademicResourceNotFoundException)) {
                throw error;
            }
        }

        try {
            const job = await this.scrapingJobService.enqueue('matriz-curricular', { credentials }, {
                dedupeKey: scrapingJobDedupeKey(credentials, 'matriz')
            });
            await job.waitUntilFinished(GetMatrizCurricularUseCase.LIVE_SCRAPE_TIMEOUT_MS);
            return await this.cache.getMatrizCurricular(credentials.cpf);
        } catch {
            return null;
        }
    }
}
