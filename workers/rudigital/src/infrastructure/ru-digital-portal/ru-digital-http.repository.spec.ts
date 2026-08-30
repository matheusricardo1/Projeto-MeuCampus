import { describe, expect, it, vi } from 'vitest';
import { RuDigitalHttpRepository } from '@/infrastructure/ru-digital-portal/ru-digital-http.repository';
import type { RuDigitalAuthService } from '@/infrastructure/ru-digital-portal/ru-digital-auth-service';

const CREDENTIALS = { cpf: '06124555212', token: 'jwt' };
const DASHBOARD_ROUTE = '/home/dashboard';

function buildFakeClient(overrides: Partial<Record<string, any>> = {}) {
    return {
        callAction: vi.fn(),
        listRestaurants: vi.fn(),
        selectDefaultRestaurant: vi.fn(),
        exportSession: vi.fn().mockReturnValue({ token: 'jwt' }),
        ...overrides
    };
}

function buildRepository(fakeClient: ReturnType<typeof buildFakeClient>, authOverrides: Partial<Record<string, any>> = {}) {
    const authService = {
        getAuthenticatedClient: vi.fn().mockReturnValue(fakeClient),
        logout: vi.fn(),
        ...authOverrides
    } as unknown as RuDigitalAuthService;
    return { repository: new RuDigitalHttpRepository(authService), authService };
}

describe('RuDigitalHttpRepository.getStudent', () => {
    it('maps the real "discente" wire shape into the English Student entity', async () => {
        const fakeClient = buildFakeClient({
            callAction: vi.fn().mockResolvedValue({
                idAluno: 171988, idCursoAluno: 193808, cpf: '061.245.552-12', idPessoa: 'MATHEUS RICARDO OLIVEIRA LIMA',
                matrAluno: '22551205', formaEvasao: 'Sem Evasão', codCurso: 'IE17', nomeCursoDiploma: 'Engenharia de Software',
                nivelCursoItem: 1, tipoAluno: 4
            })
        });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getStudent(CREDENTIALS);

        expect(fakeClient.callAction).toHaveBeenCalledWith(DASHBOARD_ROUTE, 'getDiscenteAction', [
            { client: '$T', queryKey: ['discente', 'session'], meta: '$undefined', signal: '$T' }
        ]);
        expect(result).toEqual({
            studentId: 171988,
            courseEnrollmentId: 193808,
            cpf: '061.245.552-12',
            fullName: 'MATHEUS RICARDO OLIVEIRA LIMA',
            enrollmentNumber: '22551205',
            courseCode: 'IE17',
            courseName: 'Engenharia de Software'
        });
    });

    it('defaults every field defensively when the wire payload is missing fields', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({}) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getStudent(CREDENTIALS);

        expect(result).toEqual({ studentId: 0, courseEnrollmentId: 0, cpf: '', fullName: '', enrollmentNumber: '', courseCode: '', courseName: '' });
    });
});

describe('RuDigitalHttpRepository.getBalance', () => {
    it('maps the real "saldo" wire shape (desjejum/almoco/jantar) into breakfast/lunch/dinner', async () => {
        const fakeClient = buildFakeClient({
            callAction: vi.fn().mockResolvedValue({
                almoco: { valorRefeicao: 1.3, saldoAtual: 0, disponivelParaCompra: 26 },
                desjejum: { valorRefeicao: 0.75, saldoAtual: 0, disponivelParaCompra: 26 },
                jantar: { valorRefeicao: 1.4, saldoAtual: 0, disponivelParaCompra: 26 }
            })
        });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getBalance(CREDENTIALS);

        expect(result).toEqual({
            breakfast: { mealPrice: 0.75, currentBalance: 0, availableForPurchase: 26 },
            lunch: { mealPrice: 1.3, currentBalance: 0, availableForPurchase: 26 },
            dinner: { mealPrice: 1.4, currentBalance: 0, availableForPurchase: 26 }
        });
    });

    it('defaults a missing meal entirely to zeros instead of throwing', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ almoco: { valorRefeicao: 1.3, saldoAtual: 2, disponivelParaCompra: 5 } }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getBalance(CREDENTIALS);

        expect(result.breakfast).toEqual({ mealPrice: 0, currentBalance: 0, availableForPurchase: 0 });
        expect(result.lunch).toEqual({ mealPrice: 1.3, currentBalance: 2, availableForPurchase: 5 });
    });

    it('parses a comma-decimal price string as a number (defensive JSON boundary)', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ almoco: { valorRefeicao: '1,30', saldoAtual: 0, disponivelParaCompra: 26 } }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getBalance(CREDENTIALS);

        expect(result.lunch.mealPrice).toBe(1.3);
    });
});

describe('RuDigitalHttpRepository.getDailyMenu', () => {
    it('maps the real "cardapio" wire shape and always echoes back the requested date', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ data: '2026-08-28T20:51:43.642Z', restaurante: '', items: [], refeicaoId: '' }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getDailyMenu(CREDENTIALS, '2026-08-28');

        expect(fakeClient.callAction).toHaveBeenCalledWith(DASHBOARD_ROUTE, 'getCardapioAction', ['2026-08-28']);
        expect(result).toEqual({ date: '2026-08-28', restaurantId: '', mealId: '', items: [] });
    });

    it('coerces every menu item to a string, even non-string array entries', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ items: ['Arroz', 42, null] }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getDailyMenu(CREDENTIALS, '2026-08-28');

        expect(result.items).toEqual(['Arroz', '42', 'null']);
    });
});

describe('RuDigitalHttpRepository.getDefaultRestaurant', () => {
    it('maps the real "restaurante" wire shape into id/name/city', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ id: 'MAO', nome: 'Manaus - Campus Coroado', cidade: 'Manaus - Campus Coroado' }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getDefaultRestaurant(CREDENTIALS);

        expect(fakeClient.callAction).toHaveBeenCalledWith(DASHBOARD_ROUTE, 'getRestauranteDefaultAction', [
            { client: '$T', queryKey: ['restaurante', 'session'], meta: '$undefined', signal: '$T' }
        ]);
        expect(result).toEqual({ id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' });
    });
});

describe('RuDigitalHttpRepository.getLastConsumption', () => {
    it('maps the real "ultimoConsumo" wire shape, translating null-ish fields correctly', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ hasPendingFeedback: false, consumoId: '2c91808f9f4826a3019f62c7d49b127c', refeicao: null }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getLastConsumption(CREDENTIALS, 'MAO');

        expect(fakeClient.callAction).toHaveBeenCalledWith(DASHBOARD_ROUTE, 'getUltimoConsumoAction', ['MAO']);
        expect(result).toEqual({ hasPendingFeedback: false, consumptionId: '2c91808f9f4826a3019f62c7d49b127c', meal: null });
    });

    it('only treats a literal boolean true as pending feedback', async () => {
        const fakeClient = buildFakeClient({ callAction: vi.fn().mockResolvedValue({ hasPendingFeedback: 'true', consumoId: null, refeicao: null }) });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.getLastConsumption(CREDENTIALS, 'MAO');

        expect(result.hasPendingFeedback).toBe(false);
        expect(result.consumptionId).toBeNull();
    });
});

describe('RuDigitalHttpRepository.listRestaurants', () => {
    it('maps the real restaurant list wire shape into id/name/city entities', async () => {
        const fakeClient = buildFakeClient({
            listRestaurants: vi.fn().mockResolvedValue([
                { id: 'HUM', nome: 'Humaitá - IEAA', cidade: 'Humaitá - IEAA' },
                { id: 'MAO', nome: 'Manaus - Campus Coroado', cidade: 'Manaus - Campus Coroado' }
            ])
        });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.listRestaurants(CREDENTIALS);

        expect(result).toEqual([
            { id: 'HUM', name: 'Humaitá - IEAA', city: 'Humaitá - IEAA' },
            { id: 'MAO', name: 'Manaus - Campus Coroado', city: 'Manaus - Campus Coroado' }
        ]);
    });
});

describe('RuDigitalHttpRepository.selectDefaultRestaurant', () => {
    it('selects the restaurant on the client and returns its freshly exported session', async () => {
        const fakeClient = buildFakeClient({
            selectDefaultRestaurant: vi.fn().mockResolvedValue(undefined),
            exportSession: vi.fn().mockReturnValue({ token: 'jwt', restaurantId: 'MAO' })
        });
        const { repository } = buildRepository(fakeClient);

        const result = await repository.selectDefaultRestaurant(CREDENTIALS, 'MAO');

        expect(fakeClient.selectDefaultRestaurant).toHaveBeenCalledWith('MAO');
        expect(result).toEqual({ token: 'jwt', restaurantId: 'MAO' });
    });
});

describe('RuDigitalHttpRepository.logout', () => {
    it('delegates to the auth service', async () => {
        const fakeClient = buildFakeClient();
        const { repository, authService } = buildRepository(fakeClient);

        await repository.logout(CREDENTIALS);

        expect(authService.logout).toHaveBeenCalledWith(CREDENTIALS);
    });
});
