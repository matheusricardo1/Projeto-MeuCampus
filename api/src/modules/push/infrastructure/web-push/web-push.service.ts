import { Injectable, type OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import { appLogger } from '@/shared/logging/app-logger';
import { PushSubscriptionRepository } from '@push/infrastructure/prisma/push-subscription.repository';

interface WebPushDeliveryError {
    statusCode?: number;
}

@Injectable()
export class WebPushService implements OnModuleInit {
    private isConfigured = false;

    constructor(private readonly subscriptions: PushSubscriptionRepository) {}

    onModuleInit(): void {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const subject = process.env.VAPID_SUBJECT;

        if (!publicKey || !privateKey || !subject) {
            appLogger.warning('Web Push is not configured (missing VAPID_* env vars) - owner push notifications are disabled.');
            return;
        }

        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.isConfigured = true;
    }

    /** Best-effort fan-out to every device/browser the owner has subscribed from. Never throws. */
    async notifyOwner(title: string, body: string): Promise<void> {
        if (!this.isConfigured) {
            return;
        }

        const subscriptions = await this.subscriptions.findAll();
        if (subscriptions.length === 0) {
            return;
        }

        const payload = JSON.stringify({ title, body });

        await Promise.all(subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification({
                    endpoint: subscription.endpoint,
                    keys: { p256dh: subscription.p256dh, auth: subscription.auth }
                }, payload);
            } catch (error) {
                const statusCode = (error as WebPushDeliveryError).statusCode;
                if (statusCode === 404 || statusCode === 410) {
                    // Browser unsubscribed or the subscription expired - stop targeting it.
                    await this.subscriptions.remove(subscription.endpoint);
                    return;
                }

                appLogger.warning('Failed to deliver a Web Push notification to the owner.', {
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : String(error),
                    statusCode
                });
            }
        }));
    }
}
