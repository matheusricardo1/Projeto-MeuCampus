import { Module } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { PushSubscriptionRepository } from '@push/infrastructure/prisma/push-subscription.repository';
import { WebPushService } from '@push/infrastructure/web-push/web-push.service';

@Module({
    providers: [PrismaService, PushSubscriptionRepository, WebPushService],
    exports: [PushSubscriptionRepository, WebPushService]
})
export class PushModule {}
