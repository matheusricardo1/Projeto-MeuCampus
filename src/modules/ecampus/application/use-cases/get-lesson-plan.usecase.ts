import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { LessonPlanItem } from '@ecampus/domain/models/lesson-plan-item';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class GetLessonPlanUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]> {
        return this.ecampusRepository.getLessonPlan(credentials, planId);
    }
}
