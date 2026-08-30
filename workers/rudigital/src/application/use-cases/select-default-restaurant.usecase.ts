import type { RuDigitalRepository } from '@/domain/repositories/ru-digital.repository';
import type { RuDigitalSessionStore } from '@/application/ports/ru-digital-session-store';
import type { RuDigitalCredentials } from '@/domain/value-objects/ru-digital-credentials';

export class SelectDefaultRestaurantUseCase {
    constructor(
        private readonly repository: RuDigitalRepository,
        private readonly sessions: RuDigitalSessionStore
    ) {}

    /** Returns the updated session (now carrying the chosen restaurant) so the caller can re-issue its access token. */
    async execute(credentials: RuDigitalCredentials, restaurantId: string): Promise<{ session: Record<string, unknown> }> {
        await this.sessions.assertActive(credentials.cpf);
        const session = await this.repository.selectDefaultRestaurant(credentials, restaurantId);
        return { session };
    }
}
