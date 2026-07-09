export class AiDailyLimitReachedError extends Error {
    readonly limit: number;
    readonly plan: 'FREE' | 'PAID';

    constructor(limit: number, plan: 'FREE' | 'PAID', message = 'Limite diario de mensagens atingido.') {
        super(message);
        this.name = 'AiDailyLimitReachedError';
        this.limit = limit;
        this.plan = plan;
    }
}
