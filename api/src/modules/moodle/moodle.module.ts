import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { MoodleDataRepository } from '@moodle/domain/repositories/moodle-data.repository';
import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import { MoodleAccessTokenService } from '@moodle/application/ports/moodle-access-token-service';
import { MoodleSessionRegistry } from '@moodle/application/ports/moodle-session-registry';
import { MoodleScrapingJobService } from '@moodle/infrastructure/queue/moodle-job.service';
import { MoodleRedisRepository } from '@moodle/infrastructure/redis/moodle-redis.repository';
import { RedisMoodleSessionRegistry } from '@moodle/infrastructure/redis/redis-moodle-session-registry';
import { JwtMoodleAccessTokenService } from '@moodle/infrastructure/security/jwt-moodle-access-token-service';
import { PrismaMoodleAccountLinkRepository } from '@moodle/infrastructure/prisma/moodle-account-link.repository';
import { MoodleAuthGuard } from '@moodle/presentation/http/guards/moodle-auth.guard';
import { MoodleController } from '@moodle/presentation/http/moodle.controller';
import { LoginMoodleUseCase } from '@moodle/application/use-cases/login-moodle.usecase';
import { LogoutMoodleUseCase } from '@moodle/application/use-cases/logout-moodle.usecase';
import { AuthenticateMoodleRequestUseCase } from '@moodle/application/use-cases/authenticate-moodle-request.usecase';
import { GetCoursesUseCase } from '@moodle/application/use-cases/get-courses.usecase';
import { GetTimelineUseCase } from '@moodle/application/use-cases/get-timeline.usecase';
import { LinkMoodleAccountUseCase } from '@moodle/application/use-cases/link-moodle-account.usecase';
import { UnlinkMoodleAccountUseCase } from '@moodle/application/use-cases/unlink-moodle-account.usecase';
import { ListLinkedMoodleAccountsUseCase } from '@moodle/application/use-cases/list-linked-moodle-accounts.usecase';
import { ResolveMoodleSessionForAiUseCase } from '@moodle/application/use-cases/resolve-moodle-session-for-ai.usecase';
import { GetMoodleCoursesForAiUseCase } from '@moodle/application/use-cases/get-moodle-courses-for-ai.usecase';
import { GetMoodleTimelineForAiUseCase } from '@moodle/application/use-cases/get-moodle-timeline-for-ai.usecase';

@Module({
    imports: [AuthModule],
    controllers: [MoodleController],
    providers: [
        PrismaService,
        MoodleScrapingJobService,
        MoodleRedisRepository,
        PrismaMoodleAccountLinkRepository,
        RedisMoodleSessionRegistry,
        JwtMoodleAccessTokenService,
        MoodleAuthGuard,
        { provide: ScrapingJobService, useExisting: MoodleScrapingJobService },
        { provide: MoodleDataRepository, useExisting: MoodleRedisRepository },
        { provide: MoodleAccountLinkRepository, useExisting: PrismaMoodleAccountLinkRepository },
        { provide: MoodleSessionRegistry, useExisting: RedisMoodleSessionRegistry },
        { provide: MoodleAccessTokenService, useExisting: JwtMoodleAccessTokenService },
        {
            provide: AuthenticateMoodleRequestUseCase,
            useFactory: (tokens: MoodleAccessTokenService, sessions: MoodleSessionRegistry) =>
                new AuthenticateMoodleRequestUseCase(tokens, sessions),
            inject: [MoodleAccessTokenService, MoodleSessionRegistry]
        },
        {
            provide: LoginMoodleUseCase,
            useFactory: (jobs: ScrapingJobService, tokens: MoodleAccessTokenService, sessions: MoodleSessionRegistry) =>
                new LoginMoodleUseCase(jobs, tokens, sessions),
            inject: [ScrapingJobService, MoodleAccessTokenService, MoodleSessionRegistry]
        },
        {
            provide: LogoutMoodleUseCase,
            useFactory: (jobs: ScrapingJobService, cache: MoodleDataRepository, sessions: MoodleSessionRegistry) =>
                new LogoutMoodleUseCase(jobs, cache, sessions),
            inject: [ScrapingJobService, MoodleDataRepository, MoodleSessionRegistry]
        },
        {
            provide: GetCoursesUseCase,
            useFactory: (cache: MoodleDataRepository, jobs: ScrapingJobService) => new GetCoursesUseCase(cache, jobs),
            inject: [MoodleDataRepository, ScrapingJobService]
        },
        {
            provide: GetTimelineUseCase,
            useFactory: (cache: MoodleDataRepository, jobs: ScrapingJobService) => new GetTimelineUseCase(cache, jobs),
            inject: [MoodleDataRepository, ScrapingJobService]
        },
        {
            provide: LinkMoodleAccountUseCase,
            useFactory: (jobs: ScrapingJobService, links: MoodleAccountLinkRepository) => new LinkMoodleAccountUseCase(jobs, links),
            inject: [ScrapingJobService, MoodleAccountLinkRepository]
        },
        {
            provide: UnlinkMoodleAccountUseCase,
            useFactory: (links: MoodleAccountLinkRepository) => new UnlinkMoodleAccountUseCase(links),
            inject: [MoodleAccountLinkRepository]
        },
        {
            provide: ListLinkedMoodleAccountsUseCase,
            useFactory: (links: MoodleAccountLinkRepository) => new ListLinkedMoodleAccountsUseCase(links),
            inject: [MoodleAccountLinkRepository]
        },
        {
            provide: ResolveMoodleSessionForAiUseCase,
            useFactory: (links: MoodleAccountLinkRepository, jobs: ScrapingJobService, sessions: MoodleSessionRegistry) =>
                new ResolveMoodleSessionForAiUseCase(links, jobs, sessions),
            inject: [MoodleAccountLinkRepository, ScrapingJobService, MoodleSessionRegistry]
        },
        {
            provide: GetMoodleCoursesForAiUseCase,
            useFactory: (resolveSession: ResolveMoodleSessionForAiUseCase, jobs: ScrapingJobService) =>
                new GetMoodleCoursesForAiUseCase(resolveSession, jobs),
            inject: [ResolveMoodleSessionForAiUseCase, ScrapingJobService]
        },
        {
            provide: GetMoodleTimelineForAiUseCase,
            useFactory: (resolveSession: ResolveMoodleSessionForAiUseCase, jobs: ScrapingJobService) =>
                new GetMoodleTimelineForAiUseCase(resolveSession, jobs),
            inject: [ResolveMoodleSessionForAiUseCase, ScrapingJobService]
        }
    ],
    exports: [GetMoodleCoursesForAiUseCase, GetMoodleTimelineForAiUseCase]
})
export class MoodleModule {}
