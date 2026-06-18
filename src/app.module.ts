import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';
import { HealthController } from '@/health.controller';

@Module({
    controllers: [HealthController],
    imports: [EcampusModule]
})
export class AppModule {}
