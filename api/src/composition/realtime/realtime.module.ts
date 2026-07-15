import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';
import { LiveUserCounter } from '@admin/application/ports/live-user-counter';
import { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';
import { PushModule } from '@push/push.module';
import { AcademicGateway } from '@composition/realtime/academic.gateway';
import { AdminGateway } from '@composition/realtime/admin.gateway';
import { EcampusBootstrapTracker } from '@ecampus/infrastructure/redis/ecampus-bootstrap-tracker';

@Module({
    imports: [AuthModule, PushModule],
    providers: [
        // AdminJwtService is duplicated here (also provided by AdminModule)
        // rather than importing AdminModule, which would create a module
        // cycle since AdminModule itself imports RealtimeModule for
        // LiveUserCounter. It's a stateless wrapper around env-derived
        // secrets, so a second instance costs nothing.
        AdminJwtService,
        // Same story for the bootstrap tracker: EcampusModule already imports
        // RealtimeModule (to emit through the gateway), so importing
        // EcampusModule back here to inject the tracker would be a cycle.
        // The tracker's state lives entirely in Redis keyed by CPF, so a
        // second instance here (a second read-only Redis client) sees exactly
        // the same data — it just lets the gateway replay bootstrap state on
        // connect. Provided both concretely and behind its port so the
        // gateway can inject the abstract AcademicBootstrapTracker.
        EcampusBootstrapTracker,
        { provide: AcademicBootstrapTracker, useExisting: EcampusBootstrapTracker },
        AdminGateway,
        AcademicGateway,
        { provide: AcademicNotificationService, useExisting: AcademicGateway },
        { provide: AiNotificationService, useExisting: AcademicGateway },
        { provide: LiveUserCounter, useExisting: AcademicGateway }
    ],
    exports: [AcademicNotificationService, AiNotificationService, LiveUserCounter]
})
export class RealtimeModule {}
