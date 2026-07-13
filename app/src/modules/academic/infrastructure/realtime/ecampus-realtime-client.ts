import { io, type Socket } from 'socket.io-client';
import type { AuthSession } from '@/shared/auth/auth-session';
import type { AiChatReply } from '@/modules/academic/domain/entities/ai-chat-reply';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';
const RESOURCE_READY_EVENT = 'ecampus:resource-ready';
const RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';
const AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';
const BOOTSTRAP_READY_EVENT = 'ecampus:bootstrap-ready';
const BOOTSTRAP_FAILED_EVENT = 'ecampus:bootstrap-failed';
const LOGIN_READY_EVENT = 'ecampus:login-ready';
const LOGIN_FAILED_EVENT = 'ecampus:login-failed';
const AI_REPLY_EVENT = 'ecampus:ai-reply';
const AI_FAILED_EVENT = 'ecampus:ai-failed';
const AI_TOOL_EVENT = 'ecampus:ai-tool';
const LOGIN_TIMEOUT_MS = 35_000;
const AI_REPLY_TIMEOUT_MS = 60_000;

type RealtimeSubscriber = {
    onResourceReady: (event: EcampusResourceReadyEvent) => void;
    onConnected: () => void;
    onAuthRejected?: (event?: EcampusAuthRejectedEvent) => void;
    onResourceFailed?: (event: EcampusResourceFailedEvent) => void;
    onBootstrapReady?: (event: EcampusBootstrapEvent) => void;
    onBootstrapFailed?: (event: EcampusBootstrapEvent) => void;
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

export interface EcampusAuthRejectedEvent {
    message?: string;
}

export interface EcampusBootstrapEvent {
    requiredResources: EcampusResourceReadyEvent['resource'][];
    readyResources: EcampusResourceReadyEvent['resource'][];
    failedResources: EcampusResourceReadyEvent['resource'][];
}

let activeToken: string | null = null;
let activeSocket: Socket | null = null;
const subscribers = new Set<RealtimeSubscriber>();

export function connectEcampusRealtime(
    accessToken: string,
    onResourceReady: (event: EcampusResourceReadyEvent) => void,
    onConnected: () => void,
    onAuthRejected?: (event?: EcampusAuthRejectedEvent) => void,
    onResourceFailed?: (event: EcampusResourceFailedEvent) => void,
    onBootstrapReady?: (event: EcampusBootstrapEvent) => void,
    onBootstrapFailed?: (event: EcampusBootstrapEvent) => void
): () => void {
    if (!isJwtLike(accessToken)) {
        onAuthRejected?.();
        return () => undefined;
    }

    const subscriber = { onResourceReady, onConnected, onAuthRejected, onResourceFailed, onBootstrapReady, onBootstrapFailed };
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

    activeSocket.on(BOOTSTRAP_READY_EVENT, (event: EcampusBootstrapEvent) => {
        for (const subscriber of subscribers) {
            subscriber.onBootstrapReady?.(event);
        }
    });

    activeSocket.on(BOOTSTRAP_FAILED_EVENT, (event: EcampusBootstrapEvent) => {
        for (const subscriber of subscribers) {
            subscriber.onBootstrapFailed?.(event);
        }
    });

    activeSocket.on('connect', () => {
        for (const subscriber of subscribers) {
            subscriber.onConnected();
        }
    });

    activeSocket.on(AUTH_REJECTED_EVENT, (event?: EcampusAuthRejectedEvent) => {
        const snapshot = [...subscribers];
        disconnectSocket();
        for (const subscriber of snapshot) {
            subscriber.onAuthRejected?.(event);
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

export function waitForLoginResult(jobId: string): Promise<AuthSession> {
    return new Promise((resolve, reject) => {
        const socket = io(`${getApiOrigin()}/ecampus`, {
            auth: { loginJobId: jobId },
            transports: ['websocket'],
            reconnection: false
        });

        const cleanup = () => {
            socket.removeAllListeners();
            socket.disconnect();
        };

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('O serviço está temporariamente indisponível. Tente novamente em instantes.'));
        }, LOGIN_TIMEOUT_MS);

        socket.on(LOGIN_READY_EVENT, (event: { accessToken: string }) => {
            clearTimeout(timeout);
            cleanup();
            resolve({ accessToken: event.accessToken, tokenType: 'Bearer' });
        });

        socket.on(LOGIN_FAILED_EVENT, (event: { message: string }) => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error(event.message));
        });

        socket.on('connect_error', (error: Error) => {
            clearTimeout(timeout);
            cleanup();
            reject(error);
        });
    });
}

export function waitForAiReply(jobId: string, onToolCall?: (toolName: string) => void): Promise<AiChatReply> {
    return new Promise((resolve, reject) => {
        const socket = activeSocket;
        if (!socket) {
            reject(new Error('Sem conexão com o servidor. Tente novamente.'));
            return;
        }

        // Each tool-call status update pushes the deadline back — a
        // slow-but-alive generation shouldn't time out just because it's
        // taking a while overall; only genuine silence should.
        let timeout = setTimeout(onTimeout, AI_REPLY_TIMEOUT_MS);

        function onTimeout() {
            cleanup();
            reject(new Error('A IA demorou demais para responder. Tente novamente.'));
        }

        const cleanup = () => {
            clearTimeout(timeout);
            socket.off(AI_REPLY_EVENT, onReply);
            socket.off(AI_FAILED_EVENT, onFailed);
            socket.off(AI_TOOL_EVENT, onToolEvent);
        };

        const onReply = (event: { jobId: string; conversationId: string; message: AiChatReply['message'] }) => {
            if (event.jobId !== jobId) return;
            cleanup();
            resolve({ conversationId: event.conversationId, message: event.message });
        };

        const onFailed = (event: { jobId: string; message: string }) => {
            if (event.jobId !== jobId) return;
            cleanup();
            reject(new Error(event.message));
        };

        const onToolEvent = (event: { jobId: string; toolName: string }) => {
            if (event.jobId !== jobId) return;
            clearTimeout(timeout);
            timeout = setTimeout(onTimeout, AI_REPLY_TIMEOUT_MS);
            onToolCall?.(event.toolName);
        };

        socket.on(AI_REPLY_EVENT, onReply);
        socket.on(AI_FAILED_EVENT, onFailed);
        socket.on(AI_TOOL_EVENT, onToolEvent);
    });
}

function getApiOrigin(): string {
    const baseUrl = process.env.EXPO_PUBLIC_ECAMPUS_API_URL || DEFAULT_API_BASE_URL;
    return new URL(baseUrl).origin;
}
