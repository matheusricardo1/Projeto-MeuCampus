import { io, type Socket } from 'socket.io-client';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';
const RESOURCE_READY_EVENT = 'ecampus:resource-ready';
const RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';
const AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';

type RealtimeSubscriber = {
    onResourceReady: (event: EcampusResourceReadyEvent) => void;
    onConnected: () => void;
    onAuthRejected?: () => void;
    onResourceFailed?: (event: EcampusResourceFailedEvent) => void;
};

export interface EcampusResourceReadyEvent {
    resource: 'profile' | 'schedule' | 'grades' | 'lesson-plan-subjects' | 'lesson-plan';
    year?: string;
    period?: string;
    planId?: string;
}

export interface EcampusResourceFailedEvent extends EcampusResourceReadyEvent {
    status: 'failed';
    errorName: string;
    message: string;
}

let activeToken: string | null = null;
let activeSocket: Socket | null = null;
const subscribers = new Set<RealtimeSubscriber>();

export function connectEcampusRealtime(
    accessToken: string,
    onResourceReady: (event: EcampusResourceReadyEvent) => void,
    onConnected: () => void,
    onAuthRejected?: () => void,
    onResourceFailed?: (event: EcampusResourceFailedEvent) => void
): () => void {
    if (!isJwtLike(accessToken)) {
        onAuthRejected?.();
        return () => undefined;
    }

    const subscriber = { onResourceReady, onConnected, onAuthRejected, onResourceFailed };
    subscribers.add(subscriber);
    ensureSocket(accessToken);

    if (activeSocket?.connected) {
        onConnected();
    }

    return () => {
        subscribers.delete(subscriber);

        if (subscribers.size === 0) {
            disconnectSocket();
        }
    };
}

function ensureSocket(accessToken: string): void {
    if (activeSocket && activeToken === accessToken) {
        return;
    }

    disconnectSocket();
    activeToken = accessToken;
    activeSocket = io(`${getApiOrigin()}/ecampus`, {
        auth: { token: accessToken },
        transports: ['websocket'],
        reconnection: true
    });

    activeSocket.on(RESOURCE_READY_EVENT, (event: EcampusResourceReadyEvent) => {
        for (const subscriber of subscribers) {
            subscriber.onResourceReady(event);
        }
    });

    activeSocket.on(RESOURCE_FAILED_EVENT, (event: EcampusResourceFailedEvent) => {
        for (const subscriber of subscribers) {
            subscriber.onResourceFailed?.(event);
        }
    });

    activeSocket.on('connect', () => {
        for (const subscriber of subscribers) {
            subscriber.onConnected();
        }
    });

    activeSocket.on(AUTH_REJECTED_EVENT, () => {
        for (const subscriber of subscribers) {
            subscriber.onAuthRejected?.();
        }
    });
}

function disconnectSocket(): void {
    activeSocket?.removeAllListeners();
    activeSocket?.disconnect();
    activeSocket = null;
    activeToken = null;
}

function isJwtLike(value: string): boolean {
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function getApiOrigin(): string {
    const baseUrl = process.env.EXPO_PUBLIC_ECAMPUS_API_URL || DEFAULT_API_BASE_URL;
    return new URL(baseUrl).origin;
}
