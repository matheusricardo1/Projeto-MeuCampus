import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';

export interface PushSubscriptionInput {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export interface StoredPushSubscription extends PushSubscriptionInput {
    id: string;
}

@Injectable()
export class PushSubscriptionRepository {
    constructor(private readonly prisma: PrismaService) {}

    async save(input: PushSubscriptionInput): Promise<void> {
        await this.prisma.pushSubscription.upsert({
            where: { endpoint: input.endpoint },
            create: input,
            update: { p256dh: input.p256dh, auth: input.auth }
        });
    }

    async remove(endpoint: string): Promise<void> {
        await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }

    async findAll(): Promise<StoredPushSubscription[]> {
        return this.prisma.pushSubscription.findMany();
    }
}
