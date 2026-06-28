import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { appLogger } from '@/shared/logging/app-logger';

export class AcademicSessionExpiredException extends Error {
  constructor(message = 'Sua sessao expirou. Entre novamente.') {
    super(message);
    this.name = 'AcademicSessionExpiredException';
  }
}

export class ValidateAcademicSessionUseCase {
  constructor(
    private readonly academicDataRepository: AcademicDataRepository,
    private readonly sessionRegistry: AcademicSessionRegistry,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<{ status: 'ok' }> {
    if (await this.sessionRegistry.isActive(credentials)) {
      return { status: 'ok' };
    }

    const cacheDeletedKeys = await this.academicDataRepository.clearUserCache(credentials.cpf);
    await this.sessionRegistry.invalidate(credentials.cpf);
    appLogger.warning('Rejected academic session restore because local session state is inactive.', {
      cacheDeletedKeys,
    });

    throw new AcademicSessionExpiredException();
  }
}
