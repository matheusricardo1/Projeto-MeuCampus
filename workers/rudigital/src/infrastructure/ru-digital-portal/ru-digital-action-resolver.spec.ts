import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActionNotResolvedError } from '@/domain/exceptions/action-not-resolved.error';
import type { RuDigitalActionMapStore } from '@/application/ports/ru-digital-action-map-store';
import { RuDigitalActionResolver } from '@/infrastructure/ru-digital-portal/ru-digital-action-resolver';

const getMock = vi.fn();

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({ get: getMock }))
    }
}));

const LOGIN_HTML = '<script src="/_next/static/chunks/app/(auth)/login/page-abc.js"></script>';
const LOGIN_CHUNK = 'let j=(0,f.createServerReference)("60289b072ce34eaca70b5740beb9e596487a8b3a10",f.callServer,void 0,f.findSourceMapURL,"loginAction");';

function buildStore(overrides: Partial<Record<string, any>> = {}): RuDigitalActionMapStore {
    return {
        get: vi.fn().mockResolvedValue(null),
        save: vi.fn(),
        invalidate: vi.fn(),
        ...overrides
    } as unknown as RuDigitalActionMapStore;
}

beforeEach(() => {
    getMock.mockReset();
});

describe('RuDigitalActionResolver.resolveHash', () => {
    it('discovers the hash from the route HTML and its chunks when nothing is cached', async () => {
        getMock.mockImplementation((url: string) => {
            if (url === '/login') return Promise.resolve({ data: LOGIN_HTML });
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        const hash = await resolver.resolveHash('/login', 'loginAction');

        expect(hash).toBe('60289b072ce34eaca70b5740beb9e596487a8b3a10');
        expect(store.save).toHaveBeenCalledWith('/login', { loginAction: '60289b072ce34eaca70b5740beb9e596487a8b3a10' });
    });

    it('serves from the shared store without re-fetching when another instance already discovered it', async () => {
        const store = buildStore({ get: vi.fn().mockResolvedValue({ loginAction: 'cached-hash' }) });
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        const hash = await resolver.resolveHash('/login', 'loginAction');

        expect(hash).toBe('cached-hash');
        expect(getMock).not.toHaveBeenCalled();
    });

    it('serves from its own in-process memory cache on a second call, without hitting the store or HTTP again', async () => {
        getMock.mockImplementation((url: string) => {
            if (url === '/login') return Promise.resolve({ data: LOGIN_HTML });
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        await resolver.resolveHash('/login', 'loginAction');
        getMock.mockClear();
        (store.get as any).mockClear();

        const hash = await resolver.resolveHash('/login', 'loginAction');

        expect(hash).toBe('60289b072ce34eaca70b5740beb9e596487a8b3a10');
        expect(getMock).not.toHaveBeenCalled();
        expect(store.get).not.toHaveBeenCalled();
    });

    it('forwards the auth cookie only to the HTML discovery request, not the chunk fetches', async () => {
        getMock.mockImplementation((url: string) => {
            if (url === '/restaurante/select') return Promise.resolve({ data: LOGIN_HTML });
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        await resolver.resolveHash('/restaurante/select', 'loginAction', 'session_token=abc');

        expect(getMock).toHaveBeenCalledWith('/restaurante/select', { headers: { Accept: 'text/html', Cookie: 'session_token=abc' } });
    });

    it('throws ActionNotResolvedError when the requested action name is absent from every discovered chunk', async () => {
        getMock.mockImplementation((url: string) => {
            if (url === '/login') return Promise.resolve({ data: LOGIN_HTML });
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        await expect(resolver.resolveHash('/login', 'someActionThatDoesNotExist')).rejects.toThrow(ActionNotResolvedError);
    });

    it('tolerates one chunk failing to fetch and still resolves actions found in the others', async () => {
        const html = '<script src="/_next/static/chunks/app/broken.js"></script><script src="/_next/static/chunks/app/good.js"></script>';
        getMock.mockImplementation((url: string) => {
            if (url === '/login') return Promise.resolve({ data: html });
            if (url === '/_next/static/chunks/app/broken.js') return Promise.reject(new Error('network error'));
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        const hash = await resolver.resolveHash('/login', 'loginAction');

        expect(hash).toBe('60289b072ce34eaca70b5740beb9e596487a8b3a10');
    });
});

describe('RuDigitalActionResolver.invalidate', () => {
    it('clears both the in-memory cache and the shared store, forcing the next resolve to re-discover', async () => {
        getMock.mockImplementation((url: string) => {
            if (url === '/login') return Promise.resolve({ data: LOGIN_HTML });
            return Promise.resolve({ data: LOGIN_CHUNK });
        });
        const store = buildStore();
        const resolver = new RuDigitalActionResolver('https://rudigital.ufam.edu.br', store);

        await resolver.resolveHash('/login', 'loginAction');
        await resolver.invalidate('/login');

        expect(store.invalidate).toHaveBeenCalledWith('/login');

        getMock.mockClear();
        (store.get as any).mockClear();
        await resolver.resolveHash('/login', 'loginAction');

        expect(store.get).toHaveBeenCalledWith('/login');
        expect(getMock).toHaveBeenCalled();
    });
});
