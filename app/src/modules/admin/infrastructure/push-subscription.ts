import { Platform } from 'react-native';
import { fetchPushPublicKey, subscribeToPush, unsubscribeFromPush } from '@/modules/admin/infrastructure/admin-api';

export type PushSubscriptionState = 'unsupported' | 'unsubscribed' | 'subscribed';

const SERVICE_WORKER_URL = '/sw.js';

function isWebPushSupported(): boolean {
    return Platform.OS === 'web'
        && typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        && typeof window !== 'undefined' && 'PushManager' in window
        && typeof Notification !== 'undefined';
}

// applicationServerKey must be a Uint8Array, but the backend hands us the
// VAPID public key as the URL-safe base64 string the `web-push` package
// generates - this is the standard conversion between the two.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
        output[i] = rawData.charCodeAt(i);
    }
    return output;
}

export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
    if (!isWebPushSupported()) {
        return 'unsupported';
    }

    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
}

export async function enableOwnerPushNotifications(token: string): Promise<PushSubscriptionState> {
    if (!isWebPushSupported()) {
        return 'unsupported';
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return 'unsubscribed';
    }

    const publicKey = await fetchPushPublicKey(token);
    if (!publicKey) {
        return 'unsubscribed';
    }

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await subscribeToPush(token, subscription.toJSON());
    return 'subscribed';
}

export async function disableOwnerPushNotifications(token: string): Promise<PushSubscriptionState> {
    if (!isWebPushSupported()) {
        return 'unsupported';
    }

    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
        await unsubscribeFromPush(token, subscription.endpoint);
        await subscription.unsubscribe();
    }

    return 'unsubscribed';
}
