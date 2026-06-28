import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { appLogger } from '@/shared/logging/app-logger';

export class AcademicSessionExpiredException extends Error {
  constructor(message = 'Sua sessao expirou. Entre novamente.') {
    super(message);
    this.name = 'AcademicSessionExpiredException';
  }
}

export class ValidateAcademicSessionUseCase {
  constructor(
    private readonly scrapingJobService: ScrapingJobService,
    private readonly academicDataRepository: AcademicDataRepository,
    private readonly sessionRegistry: AcademicSessionRegistry,
  ) {}

  async execute(credentials: AcademicCredentials): Promise<{ status: 'ok' }> {
    const job = await this.scrapingJobService.enqueue<{ status: 'ok' }>('session-check', { credentials }, {
      dedupeKey: `${credentials.cpf}-session-check`,
    });

    try {
      await job.waitUntilFinished(10000);
      return { status: 'ok' };
    } catch (error) {
      if (this.isUnsupportedSessionCheck(error)) {
        appLogger.warning('Skipping eCampus session validation because the running worker does not support session-check yet.', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        });
        return { status: 'ok' };
      }

      if (!this.isAuthenticationFailure(error)) {
        throw error;
      }

      const cacheDeletedKeys = await this.academicDataRepository.clearUserCache(credentials.cpf);
      await this.sessionRegistry.invalidate(credentials.cpf);
      appLogger.warning('Invalidated academic session after eCampus validation failure.', {
        cacheDeletedKeys,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });

      throw new AcademicSessionExpiredException();
    }
  }

  private isAuthenticationFailure(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.name === 'AuthenticationError'
      || error.message.toLowerCase().includes('sessao expirou')
      || error.message.toLowerCase().includes('entre novamente');
  }

  private isUnsupportedSessionCheck(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes('Unsupported eCampus scraping job: session-check');
  }
}
