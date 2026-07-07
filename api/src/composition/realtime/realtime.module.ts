import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AcademicNotificationService } from '@academic/application/ports/academic-notification-service';
import { AiNotificationService } from '@ai/application/ports/ai-notification-service';
import { AcademicGateway } from '@composition/realtime/academic.gateway';

@Module({
    imports: [AuthModule],
    providers: [
        AcademicGateway,
        { provide: AcademicNotificationService, useExisting: AcademicGateway },
        { provide: AiNotificationService, useExisting: AcademicGateway }
    ],
    exports: [AcademicNotificationService, AiNotificationService]
})
export class RealtimeModule {}
