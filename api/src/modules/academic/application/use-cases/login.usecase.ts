import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';

export interface LoginInput {
  cpf: string;
  password: string;
}

export interface LoginOutput {
  jobId: string;
}

export class LoginUseCase {
  constructor(
    private readonly scrapingJobService: ScrapingJobService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const job = await this.scrapingJobService.enqueue('login', {
      cpf: input.cpf,
      password: input.password,
    });

    return { jobId: String(job.id) };
  }
}
