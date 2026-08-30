import axios, { type AxiosInstance } from 'axios';
import type { RuDigitalActionMapStore } from '@/application/ports/ru-digital-action-map-store';
import { ActionNotResolvedError } from '@/domain/exceptions/action-not-resolved.error';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';
import { extractActionsFromChunk, extractAppChunkUrls } from '@/infrastructure/ru-digital-portal/extract-server-actions';

/**
 * Resolves a Server Action's opaque per-build hash from its stable semantic
 * name, by discovering it from the route's own JS chunks. Self-heals: a
 * stale cached hash is invalidated by the caller (RuDigitalClient) on a
 * failed call, which triggers re-discovery on the next resolve — no manual
 * hash maintenance across RU Digital deploys.
 */
export class RuDigitalActionResolver {
    private readonly memoryCache = new Map<string, Record<string, string>>();
    private readonly http: AxiosInstance;

    constructor(
        private readonly baseUrl: string,
        private readonly store: RuDigitalActionMapStore
    ) {
        this.http = axios.create({ baseURL: baseUrl, timeout: 15000, family: 4 });
    }

    /**
     * `authCookie` (e.g. `session_token=...`) is only used if discovery
     * actually has to run — some protected routes (like
     * `/restaurante/select`) only reference their own page chunk in the
     * server-rendered HTML when the request is authenticated, otherwise the
     * app falls back to a smaller shell (loading/layout/not-found only).
     * Callers pass their own current session; the resulting map is still
     * cached and reused for every user since it never depends on which
     * session unlocked it.
     */
    async resolveHash(route: string, actionName: string, authCookie?: string): Promise<string> {
        const actionMap = await this.getActionMap(route, authCookie);
        const hash = actionMap[actionName];

        if (!hash) {
            throw new ActionNotResolvedError(route, actionName);
        }

        return hash;
    }

    async invalidate(route: string): Promise<void> {
        this.memoryCache.delete(route);
        await this.store.invalidate(route);
    }

    private async getActionMap(route: string, authCookie?: string): Promise<Record<string, string>> {
        const inMemory = this.memoryCache.get(route);
        if (inMemory) {
            return inMemory;
        }

        const stored = await this.store.get(route);
        if (stored) {
            this.memoryCache.set(route, stored);
            return stored;
        }

        const discovered = await this.discover(route, authCookie);
        this.memoryCache.set(route, discovered);
        await this.store.save(route, discovered);
        return discovered;
    }

    private async discover(route: string, authCookie?: string): Promise<Record<string, string>> {
        logger.info('Discovering RU Digital Server Actions for route.', { route });

        const htmlResponse = await this.http.get<string>(route, {
            headers: {
                Accept: 'text/html',
                ...(authCookie ? { Cookie: authCookie } : {})
            }
        });
        const chunkUrls = extractAppChunkUrls(htmlResponse.data);

        const chunkResults = await Promise.allSettled(chunkUrls.map((url) => this.fetchAndExtractActions(url)));
        const actionMap: Record<string, string> = {};

        for (const result of chunkResults) {
            if (result.status === 'fulfilled') {
                Object.assign(actionMap, result.value);
            }
        }

        logger.info('RU Digital Server Action discovery finished.', {
            route,
            chunkCount: chunkUrls.length,
            actionsFound: Object.keys(actionMap).length
        });

        return actionMap;
    }

    private async fetchAndExtractActions(chunkUrl: string): Promise<Record<string, string>> {
        const response = await this.http.get<string>(chunkUrl);
        return extractActionsFromChunk(response.data);
    }
}
