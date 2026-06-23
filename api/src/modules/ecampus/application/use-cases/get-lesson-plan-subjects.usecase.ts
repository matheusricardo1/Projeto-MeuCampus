import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { LessonPlanSubject } from '@ecampus/domain/models/lesson-plan-subject';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class GetLessonPlanSubjectsUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials): Promise<LessonPlanSubject[]> {
        return this.ecampusRepository.getLessonPlanSubjects(credentials);
    }
}
