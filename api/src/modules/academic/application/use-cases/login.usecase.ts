import { Injectable, BadRequestException } from '@nestjs/common';
import { AccessTokenService } from '@academic/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@academic/application/ports/academic-session-registry';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import type { AcademicCredentials } from '@academic/domain/models/academic-credentials';

export interface LoginInput {
  cpf: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly scrapingJobService: ScrapingJobService,
    private readonly accessTokenService: AccessTokenService,
    private readonly sessionRegistry: AcademicSessionRegistry,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const job = await this.scrapingJobService.enqueue('login', {
      cpf: input.cpf,
      password: input.password,
    });

    const result = await job.waitUntilFinished(this.scrapingJobService.getQueueEvents());
    if (!result || typeof result !== 'object' || !('session' in result)) {
      throw new BadRequestException('Login failed');
    }

    const credentials: AcademicCredentials = {
      cpf: input.cpf,
      session: (result as { session: Record<string, unknown> }).session,
    };
    await this.sessionRegistry.activate(credentials);
    const token = this.accessTokenService.sign(credentials);

    return { accessToken: token, tokenType: 'Bearer' };
  }
}
