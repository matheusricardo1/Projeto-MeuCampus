import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { StudentProfile } from '@ecampus/domain/models/student-profile';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class GetStudentProfileUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials): Promise<StudentProfile> {
        return this.ecampusRepository.getStudentProfile(credentials);
    }
}
