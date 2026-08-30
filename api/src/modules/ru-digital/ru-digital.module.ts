import { Module } from '@nestjs/common';
import { ScrapingJobService } from '@academic/application/ports/scraping-job-service';
import { RuDigitalDataRepository } from '@ru-digital/domain/repositories/ru-digital-data.repository';
import { RuDigitalAccessTokenService } from '@ru-digital/application/ports/ru-digital-access-token-service';
import { RuDigitalSessionRegistry } from '@ru-digital/application/ports/ru-digital-session-registry';
import { RuDigitalScrapingJobService } from '@ru-digital/infrastructure/queue/ru-digital-job.service';
import { RuDigitalRedisRepository } from '@ru-digital/infrastructure/redis/ru-digital-redis.repository';
import { RedisRuDigitalSessionRegistry } from '@ru-digital/infrastructure/redis/redis-ru-digital-session-registry';
import { JwtRuDigitalAccessTokenService } from '@ru-digital/infrastructure/security/jwt-ru-digital-access-token-service';
import { RuDigitalAuthGuard } from '@ru-digital/presentation/http/guards/ru-digital-auth.guard';
import { RuDigitalController } from '@ru-digital/presentation/http/ru-digital.controller';
import { LoginRuDigitalUseCase } from '@ru-digital/application/use-cases/login-ru-digital.usecase';
import { LogoutRuDigitalUseCase } from '@ru-digital/application/use-cases/logout-ru-digital.usecase';
import { AuthenticateRuDigitalRequestUseCase } from '@ru-digital/application/use-cases/authenticate-ru-digital-request.usecase';
import { GetStudentUseCase } from '@ru-digital/application/use-cases/get-student.usecase';
import { GetBalanceUseCase } from '@ru-digital/application/use-cases/get-balance.usecase';
import { GetDailyMenuUseCase } from '@ru-digital/application/use-cases/get-daily-menu.usecase';
import { GetDefaultRestaurantUseCase } from '@ru-digital/application/use-cases/get-default-restaurant.usecase';
import { GetLastConsumptionUseCase } from '@ru-digital/application/use-cases/get-last-consumption.usecase';
import { ListRestaurantsUseCase } from '@ru-digital/application/use-cases/list-restaurants.usecase';
import { SelectRestaurantUseCase } from '@ru-digital/application/use-cases/select-restaurant.usecase';

@Module({
    controllers: [RuDigitalController],
    providers: [
        RuDigitalScrapingJobService,
        RuDigitalRedisRepository,
        RedisRuDigitalSessionRegistry,
        JwtRuDigitalAccessTokenService,
        RuDigitalAuthGuard,
        { provide: ScrapingJobService, useExisting: RuDigitalScrapingJobService },
        { provide: RuDigitalDataRepository, useExisting: RuDigitalRedisRepository },
        { provide: RuDigitalSessionRegistry, useExisting: RedisRuDigitalSessionRegistry },
        { provide: RuDigitalAccessTokenService, useExisting: JwtRuDigitalAccessTokenService },
        {
            provide: AuthenticateRuDigitalRequestUseCase,
            useFactory: (tokens: RuDigitalAccessTokenService, sessions: RuDigitalSessionRegistry) =>
                new AuthenticateRuDigitalRequestUseCase(tokens, sessions),
            inject: [RuDigitalAccessTokenService, RuDigitalSessionRegistry]
        },
        {
            provide: LoginRuDigitalUseCase,
            useFactory: (jobs: ScrapingJobService, tokens: RuDigitalAccessTokenService, sessions: RuDigitalSessionRegistry) =>
                new LoginRuDigitalUseCase(jobs, tokens, sessions),
            inject: [ScrapingJobService, RuDigitalAccessTokenService, RuDigitalSessionRegistry]
        },
        {
            provide: LogoutRuDigitalUseCase,
            useFactory: (jobs: ScrapingJobService, cache: RuDigitalDataRepository, sessions: RuDigitalSessionRegistry) =>
                new LogoutRuDigitalUseCase(jobs, cache, sessions),
            inject: [ScrapingJobService, RuDigitalDataRepository, RuDigitalSessionRegistry]
        },
        {
            provide: GetStudentUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new GetStudentUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: GetBalanceUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new GetBalanceUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: GetDailyMenuUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new GetDailyMenuUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: GetDefaultRestaurantUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new GetDefaultRestaurantUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: GetLastConsumptionUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new GetLastConsumptionUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: ListRestaurantsUseCase,
            useFactory: (cache: RuDigitalDataRepository, jobs: ScrapingJobService) => new ListRestaurantsUseCase(cache, jobs),
            inject: [RuDigitalDataRepository, ScrapingJobService]
        },
        {
            provide: SelectRestaurantUseCase,
            useFactory: (jobs: ScrapingJobService, tokens: RuDigitalAccessTokenService, sessions: RuDigitalSessionRegistry) =>
                new SelectRestaurantUseCase(jobs, tokens, sessions),
            inject: [ScrapingJobService, RuDigitalAccessTokenService, RuDigitalSessionRegistry]
        }
    ],
    exports: [RuDigitalDataRepository]
})
export class RuDigitalModule {}
