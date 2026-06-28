import { Module } from '@nestjs/common';
import { AcademicModule } from '@academic/academic.module';
import { AiModule } from '@ai/ai.module';
import { AuthModule } from '@auth/auth.module';
import { EcampusModule } from '@ecampus/ecampus.module';
import { HealthModule } from '@health/health.module';
import { RealtimeModule } from '@realtime/realtime.module';

@Module({
    imports: [
        HealthModule,
        AuthModule,
        RealtimeModule,
        EcampusModule,
        AcademicModule,
        AiModule
    ]
})
export class AppModule {}
