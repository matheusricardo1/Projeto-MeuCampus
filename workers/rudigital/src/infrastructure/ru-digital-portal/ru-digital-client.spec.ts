import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import { ExternalServiceError } from '@/domain/exceptions/external-service.error';
import { RestaurantNotSelectedError } from '@/domain/exceptions/restaurant-not-selected.error';
import type { RuDigitalActionResolver } from '@/infrastructure/ru-digital-portal/ru-digital-action-resolver';
import { RuDigitalClient } from '@/infrastructure/ru-digital-portal/ru-digital-client';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({ get: getMock, post: postMock }))
    }
}));

function buildResolver(overrides: Partial<Record<string, any>> = {}): RuDigitalActionResolver {
    return {
        resolveHash: vi.fn().mockResolvedValue('a-resolved-hash'),
        invalidate: vi.fn(),
        ...overrides
    } as unknown as RuDigitalActionResolver;
}

const SALDO_FLIGHT_PAYLOAD = '0:{"a":"$@1","f":"","b":"xyz"}\n1:{"almoco":{"valorRefeicao":1.3,"saldoAtual":0,"disponivelParaCompra":26}}\n';

beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
});

describe('RuDigitalClient.login', () => {
    it('extracts the session_token cookie from the response and becomes authenticated', async () => {
        postMock.mockResolvedValue({ status: 200, headers: { 'set-cookie': ['session_token=abc123; Path=/; HttpOnly'] }, data: '' });
        const client = new RuDigitalClient(buildResolver());

        await client.login('06124555212', 'secret');

        expect(client.isAuthenticated).toBe(true);
        expect(client.exportSession()).toEqual({ token: 'abc123' });
    });

    it('sends the CPF masked and the password as multipart form fields', async () => {
        postMock.mockResolvedValue({ status: 200, headers: { 'set-cookie': ['session_token=abc123'] }, data: '' });
        const client = new RuDigitalClient(buildResolver());

        await client.login('06124555212', 'secret');

        const body = postMock.mock.calls[0]?.[1] as FormData;
        expect(body).toBeInstanceOf(FormData);
        expect(body.get('1_username')).toBe('061.245.552-12');
        expect(body.get('1_password')).toBe('secret');
    });

    it('throws AuthenticationError when the response carries no session cookie (bad credentials)', async () => {
        postMock.mockResolvedValue({ status: 200, headers: {}, data: '' });
        const client = new RuDigitalClient(buildResolver());

        await expect(client.login('06124555212', 'wrong')).rejects.toThrow(AuthenticationError);
        expect(client.isAuthenticated).toBe(false);
    });
});

describe('RuDigitalClient session import/export', () => {
    it('exportSession throws when there is no active session', () => {
        const client = new RuDigitalClient(buildResolver());
        expect(() => client.exportSession()).toThrow(AuthenticationError);
    });

    it('importSession restores both the token and the restaurant preference', () => {
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt', restaurantId: 'MAO' });

        expect(client.isAuthenticated).toBe(true);
        expect(client.exportSession()).toEqual({ token: 'jwt', restaurantId: 'MAO' });
    });
});

describe('RuDigitalClient.callAction', () => {
    it('throws without making any request when there is no active session', async () => {
        const client = new RuDigitalClient(buildResolver());

        await expect(client.callAction('/home/dashboard', 'getSaldoAction', [])).rejects.toThrow(AuthenticationError);
        expect(postMock).not.toHaveBeenCalled();
    });

    it('resolves the hash, posts the action, and parses a successful flight-payload response', async () => {
        postMock.mockResolvedValue({ status: 200, data: SALDO_FLIGHT_PAYLOAD });
        const resolver = buildResolver();
        const client = new RuDigitalClient(resolver);
        client.importSession({ token: 'jwt' });

        const result = await client.callAction('/home/dashboard', 'getSaldoAction', [{ queryKey: ['saldo', 'session'] }]);

        expect(resolver.resolveHash).toHaveBeenCalledWith('/home/dashboard', 'getSaldoAction', 'session_token=jwt');
        expect(postMock).toHaveBeenCalledWith('/home/dashboard', JSON.stringify([{ queryKey: ['saldo', 'session'] }]), expect.objectContaining({
            headers: expect.objectContaining({ 'next-action': 'a-resolved-hash', Cookie: 'session_token=jwt' })
        }));
        expect(result).toEqual({ almoco: { valorRefeicao: 1.3, saldoAtual: 0, disponivelParaCompra: 26 } });
    });

    it('includes the restaurant cookie alongside the session cookie once one is selected', async () => {
        postMock.mockResolvedValue({ status: 200, data: SALDO_FLIGHT_PAYLOAD });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt', restaurantId: 'MAO' });

        await client.callAction('/home/dashboard', 'getSaldoAction', []);

        expect(postMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
            headers: expect.objectContaining({ Cookie: 'session_token=jwt; restaurante_default_id=MAO' })
        }));
    });

    it('clears the session and throws AuthenticationError on a 401, without retrying', async () => {
        postMock.mockResolvedValue({ status: 401, data: '' });
        const resolver = buildResolver();
        const client = new RuDigitalClient(resolver);
        client.importSession({ token: 'jwt' });

        await expect(client.callAction('/home/dashboard', 'getSaldoAction', [])).rejects.toThrow(AuthenticationError);
        expect(client.isAuthenticated).toBe(false);
        expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('throws RestaurantNotSelectedError on a 303 without invalidating the resolved hash', async () => {
        postMock.mockResolvedValue({ status: 303, data: '' });
        const resolver = buildResolver();
        const client = new RuDigitalClient(resolver);
        client.importSession({ token: 'jwt' });

        await expect(client.callAction('/home/dashboard', 'getSaldoAction', [])).rejects.toThrow(RestaurantNotSelectedError);
        expect(resolver.invalidate).not.toHaveBeenCalled();
        expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('invalidates the cached hash and retries once on an unexpected status, then throws if it fails again', async () => {
        postMock.mockResolvedValue({ status: 500, data: '' });
        const resolver = buildResolver();
        const client = new RuDigitalClient(resolver);
        client.importSession({ token: 'jwt' });

        await expect(client.callAction('/home/dashboard', 'getSaldoAction', [])).rejects.toThrow(ExternalServiceError);
        expect(resolver.invalidate).toHaveBeenCalledWith('/home/dashboard');
        expect(postMock).toHaveBeenCalledTimes(2);
    });

    it('succeeds on the retry after the first attempt failed', async () => {
        postMock
            .mockResolvedValueOnce({ status: 500, data: '' })
            .mockResolvedValueOnce({ status: 200, data: SALDO_FLIGHT_PAYLOAD });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt' });

        const result = await client.callAction('/home/dashboard', 'getSaldoAction', []);

        expect(result).toEqual({ almoco: { valorRefeicao: 1.3, saldoAtual: 0, disponivelParaCompra: 26 } });
        expect(postMock).toHaveBeenCalledTimes(2);
    });
});

describe('RuDigitalClient.logout', () => {
    it('clears the local session even when the external logout call fails', async () => {
        postMock.mockResolvedValue({ status: 500, data: '' });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt', restaurantId: 'MAO' });

        await client.logout();

        expect(client.isAuthenticated).toBe(false);
        expect(() => client.exportSession()).toThrow(AuthenticationError);
    });
});

describe('RuDigitalClient.listRestaurants', () => {
    const RESTAURANT_LIST_PAYLOAD = '["$","div",null,{"restaurantes":[{"id":"MAO","nome":"Manaus - Campus Coroado","cidade":"Manaus - Campus Coroado"}]}]';

    it('throws without making a request when there is no active session', async () => {
        const client = new RuDigitalClient(buildResolver());
        await expect(client.listRestaurants()).rejects.toThrow(AuthenticationError);
        expect(getMock).not.toHaveBeenCalled();
    });

    it('fetches and extracts the restaurant list using the session cookie', async () => {
        getMock.mockResolvedValue({ status: 200, data: RESTAURANT_LIST_PAYLOAD });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt' });

        const result = await client.listRestaurants();

        expect(getMock).toHaveBeenCalledWith('/restaurante/select', expect.objectContaining({
            headers: expect.objectContaining({ Cookie: 'session_token=jwt' })
        }));
        expect(result).toEqual([{ id: 'MAO', nome: 'Manaus - Campus Coroado', cidade: 'Manaus - Campus Coroado' }]);
    });

    it('throws ExternalServiceError on a non-200 response', async () => {
        getMock.mockResolvedValue({ status: 500, data: '' });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt' });

        await expect(client.listRestaurants()).rejects.toThrow(ExternalServiceError);
    });
});

describe('RuDigitalClient.selectDefaultRestaurant', () => {
    it('sends the useActionState-shaped body and stores the restaurant on a successful redirect (303)', async () => {
        postMock.mockResolvedValue({ status: 303, data: '' });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt' });

        await client.selectDefaultRestaurant('MAO');

        expect(postMock).toHaveBeenCalledWith('/restaurante/select', JSON.stringify(['$undefined', { restauranteId: 'MAO' }]), expect.anything());
        expect(client.exportSession()).toEqual({ token: 'jwt', restaurantId: 'MAO' });
    });

    it('clears the session and throws AuthenticationError on a 401', async () => {
        postMock.mockResolvedValue({ status: 401, data: '' });
        const client = new RuDigitalClient(buildResolver());
        client.importSession({ token: 'jwt' });

        await expect(client.selectDefaultRestaurant('MAO')).rejects.toThrow(AuthenticationError);
        expect(client.isAuthenticated).toBe(false);
    });

    it('retries once and throws ExternalServiceError if every attempt returns an unexpected status', async () => {
        postMock.mockResolvedValue({ status: 500, data: '' });
        const resolver = buildResolver();
        const client = new RuDigitalClient(resolver);
        client.importSession({ token: 'jwt' });

        await expect(client.selectDefaultRestaurant('MAO')).rejects.toThrow(ExternalServiceError);
        expect(resolver.invalidate).toHaveBeenCalledWith('/restaurante/select');
        expect(postMock).toHaveBeenCalledTimes(2);
    });
});
