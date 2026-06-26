import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { JobService } from '@/modules/ecampus/application/ports/job-service';
// Removed incorrect import; using JobService port instead
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

export interface LoginInput {
  cpf: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
}

/**
 * Orquestra o login usando um job (worker). O use‑case aguarda a conclusão
 * do job para gerar o JWT.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly jobService: JobService,
    private readonly jwtService: JwtAccessTokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // Enfileira job de login
    const job = await this.jobService.enqueue('login', {
      cpf: input.cpf,
      password: input.password,
    });

    // Espera o worker terminar (bolteia apenas aqui)
    const result = await job.waitUntilFinished(this.jobService.getQueue());
    if (!result || typeof result !== 'object' || !('session' in result)) {
      throw new BadRequestException('Login failed');
    }
    const credentials: EcampusCredentials = {
      cpf: input.cpf,
      session: (result as any).session,
    };
    const token = this.jwtService.sign(credentials);

    // Opcional: pré‑carrega dados básicos
    void this.jobService.enqueue('profile', { credentials });
    void this.jobService.enqueue('schedule', { credentials });
    // Enfileira também os jobs que não precisam de parâmetros adicionais
    void this.jobService.enqueue('lesson-plan-subjects', { credentials });

    return { accessToken: token, tokenType: 'Bearer' };
  }
}
