import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { ResolveMoodleSessionForAiUseCase, NOT_LINKED } from '@moodle/application/use-cases/resolve-moodle-session-for-ai.usecase';
import type { TimelineEvent } from '@moodle/domain/entities/timeline-event.entity';
import type { MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

const FETCH_TIMEOUT_MS = 25000;

/** Blocking path for the AI/MCP tool — see GetMatrizCurricularUseCase for the same pattern on eCampus. */
export class GetMoodleTimelineForAiUseCase {
    constructor(
        private readonly resolveSession: ResolveMoodleSessionForAiUseCase,
        private readonly scrapingJobService: ScrapingJobService
    ) {}

    async execute(cpf: string, instanceId?: MoodleInstanceId): Promise<TimelineEvent[] | typeof NOT_LINKED> {
        const credentials = await this.resolveSession.execute(cpf, instanceId);
        if (credentials === NOT_LINKED) {
            return NOT_LINKED;
        }

        const job = await this.scrapingJobService.enqueue<TimelineEvent[]>('timeline', { credentials });
        return job.waitUntilFinished(FETCH_TIMEOUT_MS);
    }
}
