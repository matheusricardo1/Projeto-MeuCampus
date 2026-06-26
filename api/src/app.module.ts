import { Module } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { EcampusModule } from '@ecampus/ecampus.module';
import { HealthController } from '@/health.controller';

@Module({
    controllers: [HealthController],
    imports: [AiModule, EcampusModule]
})
export class AppModule {}
