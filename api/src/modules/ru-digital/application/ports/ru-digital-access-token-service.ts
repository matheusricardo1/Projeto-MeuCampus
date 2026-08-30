import type { RuDigitalCredentials } from '@ru-digital/domain/entities/ru-digital-credentials.entity';

/**
 * Own, independent token service — deliberately not merged into the
 * eCampus/academic AccessTokenService so this integration can't affect the
 * auth path every other authenticated request already depends on.
 */
export abstract class RuDigitalAccessTokenService {
    abstract sign(credentials: RuDigitalCredentials): string;
    abstract verify(token: string): RuDigitalCredentials;
}
