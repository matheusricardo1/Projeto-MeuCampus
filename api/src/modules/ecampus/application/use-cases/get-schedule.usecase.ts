import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { ScheduleClass } from '@ecampus/domain/models/schedule-class';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class GetScheduleUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials): Promise<ScheduleClass[]> {
        return this.ecampusRepository.getSchedule(credentials);
    }
}
