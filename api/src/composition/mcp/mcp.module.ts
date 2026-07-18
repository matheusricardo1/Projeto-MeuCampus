import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';
import { CommunityModule } from '@community/community.module';
import { GlobalDataModule } from '@global-data/global-data.module';
import { AcademicDataRepository } from '@academic/domain/repositories/academic-data.repository';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { FindGradesAcrossPreviousPeriodsUseCase } from '@academic/application/use-cases/find-grades-across-previous-periods.usecase';
import { GetMatrizCurricularUseCase } from '@academic/application/use-cases/get-matriz-curricular.usecase';
import { MatrizCurricularCacheRepository } from '@academic/infrastructure/prisma/matriz-curricular-cache.repository';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { InternalSecretGuard } from '@/shared/mcp/internal-secret.guard';
import { McpController } from '@composition/mcp/mcp.controller';

@Module({
    imports: [EcampusModule, CommunityModule, GlobalDataModule],
    controllers: [McpController],
    providers: [
        InternalSecretGuard,
        PrismaService,
        MatrizCurricularCacheRepository,
        {
            provide: FindGradesAcrossPreviousPeriodsUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService) => new FindGradesAcrossPreviousPeriodsUseCase(cache, jobs),
            inject: [AcademicDataRepository, ScrapingJobService]
        },
        {
            provide: GetMatrizCurricularUseCase,
            useFactory: (cache: AcademicDataRepository, jobs: ScrapingJobService, dbCache: MatrizCurricularCacheRepository) => new GetMatrizCurricularUseCase(cache, jobs, dbCache),
            inject: [AcademicDataRepository, ScrapingJobService, MatrizCurricularCacheRepository]
        }
    ]
})
export class McpModule {}
