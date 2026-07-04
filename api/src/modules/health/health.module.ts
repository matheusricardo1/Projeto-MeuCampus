import { Module } from '@nestjs/common';
import { HealthController } from '@health/presentation/http/health.controller';

@Module({
    controllers: [HealthController]
})
export class HealthModule {}
