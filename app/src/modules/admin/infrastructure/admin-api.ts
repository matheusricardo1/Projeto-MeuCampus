import { Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';

export interface AdminMetrics {
    liveUsers: number;
    paidUsers: number;
    revenueCents: {
        total: number;
        thisMonth: number;
    };
    aiUsage: {
        inputTokens: number;
        outputTokens: number;
        costCents: number;
    };
    profitCents: number;
}

export interface HourlyAiUsagePoint {
    hour: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
}

export interface AiUsageToday {
    hourly: HourlyAiUsagePoint[];
    totals: {
        requests: number;
        inputTokens: number;
        outputTokens: number;
    };
    freeTierLimits: {
        rpm: number;
        tpm: number;
        rpd: number;
    };
}

export class AdminUnauthorizedError extends Error {
    constructor() {
        super('Sessao de admin invalida ou expirada.');
        this.name = 'AdminUnauthorizedError';
    }
}

function getApiBaseUrl(): string {
    const configured = process.env.EXPO_PUBLIC_ECAMPUS_API_URL;
    try {
        return configured ? new URL(configured).toString().replace(/\/+$/, '') : DEFAULT_API_BASE_URL;
    } catch {
        return DEFAULT_API_BASE_URL;
    }
}

export async function adminLogin(email: string, password: string): Promise<string> {
    const response = await fetch(`${getApiBaseUrl()}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (response.status === 401) {
        throw new AdminUnauthorizedError();
    }
    if (!response.ok) {
        throw new Error('Nao foi possivel entrar agora. Tente novamente.');
    }

    const data = await response.json() as { accessToken: string };
    return data.accessToken;
}

export async function fetchAdminMetrics(token: string): Promise<AdminMetrics> {
    const response = await fetch(`${getApiBaseUrl()}/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
        throw new AdminUnauthorizedError();
    }
    if (!response.ok) {
        throw new Error('Nao foi possivel carregar as metricas agora.');
    }

    return response.json() as Promise<AdminMetrics>;
}

export async function fetchAiUsageToday(token: string): Promise<AiUsageToday> {
    const response = await fetch(`${getApiBaseUrl()}/admin/ai-usage/today`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
        throw new AdminUnauthorizedError();
    }
    if (!response.ok) {
        throw new Error('Nao foi possivel carregar o uso de IA agora.');
    }

    return response.json() as Promise<AiUsageToday>;
}

export async function fetchPushPublicKey(token: string): Promise<string | null> {
    const response = await fetch(`${getApiBaseUrl()}/admin/push/public-key`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
        throw new AdminUnauthorizedError();
    }
    if (!response.ok) {
        return null;
    }

    const data = await response.json() as { publicKey: string | null };
    return data.publicKey;
}

export async function subscribeToPush(token: string, subscription: PushSubscriptionJSON): Promise<void> {
    const response = await fetch(`${getApiBaseUrl()}/admin/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(subscription)
    });

    if (response.status === 401) {
        throw new AdminUnauthorizedError();
    }
}

export async function unsubscribeFromPush(token: string, endpoint: string): Promise<void> {
    await fetch(`${getApiBaseUrl()}/admin/push/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint })
    });
}

export function connectAdminLiveUsers(token: string, onCount: (count: number) => void): () => void {
    const socket: Socket = io(`${new URL(getApiBaseUrl()).origin}/admin`, {
        auth: { token },
        transports: ['websocket']
    });

    socket.on('live-users', (payload: { count: number }) => onCount(payload.count));

    return () => socket.disconnect();
}
