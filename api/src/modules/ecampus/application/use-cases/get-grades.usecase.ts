import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { Grade } from '@ecampus/domain/models/grade';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class GetGradesUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]> {
        return this.ecampusRepository.getGrades(credentials, year, period);
    }
}
