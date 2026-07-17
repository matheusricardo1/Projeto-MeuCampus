import { Module } from '@nestjs/common';
import { AcademicModule } from '@academic/academic.module';
import { AdminModule } from '@admin/admin.module';
import { AiModule } from '@ai/ai.module';
import { AuthModule } from '@auth/auth.module';
import { BillingModule } from '@billing/billing.module';
import { CommunityModule } from '@community/community.module';
import { EcampusModule } from '@ecampus/ecampus.module';
import { GlobalDataModule } from '@global-data/global-data.module';
import { HealthModule } from '@health/health.module';
import { McpModule } from '@composition/mcp/mcp.module';
import { RealtimeModule } from '@composition/realtime/realtime.module';

@Module({
    imports: [
        HealthModule,
        AuthModule,
        RealtimeModule,
        EcampusModule,
        AcademicModule,
        AiModule,
        BillingModule,
        CommunityModule,
        GlobalDataModule,
        AdminModule,
        McpModule
    ]
})
export class AppModule {}
