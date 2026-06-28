import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AcademicNotificationService } from '@realtime/application/ports/academic-notification-service';
import { AcademicGateway } from '@realtime/infrastructure/socket-io/academic.gateway';

@Module({
    imports: [AuthModule],
    providers: [
        AcademicGateway,
        { provide: AcademicNotificationService, useExisting: AcademicGateway }
    ],
    exports: [AcademicNotificationService]
})
export class RealtimeModule {}
