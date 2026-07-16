import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';
import { CommunityModule } from '@community/community.module';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';
import { InternalSecretGuard } from '@/shared/mcp/internal-secret.guard';
import { McpController } from '@composition/mcp/mcp.controller';

@Module({
    imports: [EcampusModule, CommunityModule],
    controllers: [McpController],
    providers: [
        InternalSecretGuard,
        {
            provide: FindGradesAcrossPreviousPeriodsUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new FindGradesAcrossPreviousPeriodsUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        }
    ]
})
export class McpModule {}
