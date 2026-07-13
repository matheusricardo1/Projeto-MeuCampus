import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';
import { LiveUserCounter } from '@admin/application/ports/live-user-counter';
import { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';
import { AcademicGateway } from '@composition/realtime/academic.gateway';
import { AdminGateway } from '@composition/realtime/admin.gateway';

@Module({
    imports: [AuthModule],
    providers: [
        // AdminJwtService is duplicated here (also provided by AdminModule)
        // rather than importing AdminModule, which would create a module
        // cycle since AdminModule itself imports RealtimeModule for
        // LiveUserCounter. It's a stateless wrapper around env-derived
        // secrets, so a second instance costs nothing.
        AdminJwtService,
        AdminGateway,
        AcademicGateway,
        { provide: AcademicNotificationService, useExisting: AcademicGateway },
        { provide: AiNotificationService, useExisting: AcademicGateway },
        { provide: LiveUserCounter, useExisting: AcademicGateway }
    ],
    exports: [AcademicNotificationService, AiNotificationService, LiveUserCounter]
})
export class RealtimeModule {}
