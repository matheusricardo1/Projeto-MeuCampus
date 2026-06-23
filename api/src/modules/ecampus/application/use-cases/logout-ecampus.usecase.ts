import type { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';
import type { EcampusRepository } from '@ecampus/domain/repositories/ecampus.repository';

export class LogoutEcampusUseCase {
    constructor(private readonly ecampusRepository: EcampusRepository) {}

    execute(credentials: EcampusCredentials): Promise<void> {
        return this.ecampusRepository.logout(credentials);
    }
}
