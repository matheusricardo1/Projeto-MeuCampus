import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthenticationError } from '@/domain/exceptions/authentication.error';
import { RuDigitalAuthService } from '@/infrastructure/ru-digital-portal/ru-digital-auth-service';
import { RuDigitalClient } from '@/infrastructure/ru-digital-portal/ru-digital-client';

const loginMock = vi.fn();
const exportSessionMock = vi.fn();
const importSessionMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('@/infrastructure/ru-digital-portal/ru-digital-client', () => ({
    RuDigitalClient: vi.fn().mockImplementation(function RuDigitalClientMock() {
        return {
            login: loginMock,
            exportSession: exportSessionMock,
            importSession: importSessionMock,
            logout: logoutMock
        };
    })
}));

const RESOLVER = {} as any;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('RuDigitalAuthService.authenticate', () => {
    it('logs in with a fresh client and returns its exported session', async () => {
        loginMock.mockResolvedValue(undefined);
        exportSessionMock.mockReturnValue({ token: 'jwt' });

        const service = new RuDigitalAuthService(RESOLVER);
        const result = await service.authenticate({ cpf: '06124555212' }, 'secret');

        expect(RuDigitalClient).toHaveBeenCalledWith(RESOLVER);
        expect(loginMock).toHaveBeenCalledWith('06124555212', 'secret');
        expect(result).toEqual({ token: 'jwt' });
    });
});

describe('RuDigitalAuthService.getAuthenticatedClient', () => {
    it('imports the token and restaurantId into a fresh client', () => {
        const service = new RuDigitalAuthService(RESOLVER);
        service.getAuthenticatedClient({ cpf: '06124555212', token: 'jwt', restaurantId: 'MAO' });

        expect(importSessionMock).toHaveBeenCalledWith({ token: 'jwt', restaurantId: 'MAO' });
    });

    it('imports just the token when no restaurant has been selected yet', () => {
        const service = new RuDigitalAuthService(RESOLVER);
        service.getAuthenticatedClient({ cpf: '06124555212', token: 'jwt' });

        expect(importSessionMock).toHaveBeenCalledWith({ token: 'jwt' });
    });

    it('throws AuthenticationError when there is no token on the credentials', () => {
        const service = new RuDigitalAuthService(RESOLVER);

        expect(() => service.getAuthenticatedClient({ cpf: '06124555212' })).toThrow(AuthenticationError);
        expect(RuDigitalClient).not.toHaveBeenCalled();
    });
});

describe('RuDigitalAuthService.logout', () => {
    it('imports the session and logs out when a token is present', async () => {
        const service = new RuDigitalAuthService(RESOLVER);
        await service.logout({ cpf: '06124555212', token: 'jwt', restaurantId: 'MAO' });

        expect(importSessionMock).toHaveBeenCalledWith({ token: 'jwt', restaurantId: 'MAO' });
        expect(logoutMock).toHaveBeenCalled();
    });

    it('does nothing when there is no token to log out from', async () => {
        const service = new RuDigitalAuthService(RESOLVER);
        await service.logout({ cpf: '06124555212' });

        expect(RuDigitalClient).not.toHaveBeenCalled();
        expect(logoutMock).not.toHaveBeenCalled();
    });
});
