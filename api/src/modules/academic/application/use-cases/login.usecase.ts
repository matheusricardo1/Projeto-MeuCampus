import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { AcademicLoginFailedException } from '@academic/domain/exceptions/academic-login-failed.exception';
import { AcademicWorkerUnavailableException } from '@academic/domain/exceptions/academic-worker-unavailable.exception';
import { PrefetchAcademicDataUseCase } from '@academic/application/use-cases/prefetch-academic-data.usecase';

export interface LoginInput {
  cpf: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
}

export class LoginUseCase {
  constructor(
    private readonly scrapingJobService: ScrapingJobService,
    private readonly accessTokenService: AccessTokenService,
    private readonly sessionRegistry: AcademicSessionRegistry,
    private readonly prefetchAcademicDataUseCase: PrefetchAcademicDataUseCase,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const job = await this.scrapingJobService.enqueue<{ session: Record<string, unknown> }>('login', {
      cpf: input.cpf,
      password: input.password,
    });

    let result: { session: Record<string, unknown> } | null;
    try {
      result = await job.waitUntilFinished(30_000) as { session: Record<string, unknown> } | null;
    } catch {
      throw new AcademicWorkerUnavailableException();
    }

    if (!result || typeof result !== 'object' || !('session' in result)) {
      throw new AcademicLoginFailedException();
    }

    const credentials: AcademicCredentials = {
      cpf: input.cpf,
      session: result.session,
    };
    await this.sessionRegistry.activate(credentials);
    await this.prefetchAcademicDataUseCase.execute(credentials);
    const token = this.accessTokenService.sign(credentials);

    return { accessToken: token, tokenType: 'Bearer' };
  }
}
