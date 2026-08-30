import { beforeAll, describe, expect, it } from 'vitest';
import { JwtMoodleAccessTokenService } from '@moodle/infrastructure/security/jwt-moodle-access-token-service';

const TEST_SECRET = 'unit-test-secret-do-not-use-in-prod';

describe('JwtMoodleAccessTokenService', () => {
    beforeAll(() => {
        process.env.MOODLE_JWT_SECRET = TEST_SECRET;
    });

    it('round-trips credentials through sign/verify', () => {
        const service = new JwtMoodleAccessTokenService();
        const credentials = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc', userId: 140 } };

        const token = service.sign(credentials);
        const verified = service.verify(token);

        expect(verified).toEqual(credentials);
    });

    it('produces a different token for the same credentials on each call (random IV in the encrypted session)', () => {
        const service = new JwtMoodleAccessTokenService();
        const credentials = { instanceId: 'icomp-colab' as const, username: 'matheusricardo1', session: { token: 'wstoken-abc' } };

        expect(service.sign(credentials)).not.toBe(service.sign(credentials));
    });

    it('throws when signing credentials without a session', () => {
        const service = new JwtMoodleAccessTokenService();

        expect(() => service.sign({ instanceId: 'icomp-colab', username: 'matheusricardo1' })).toThrow('Session payload is required to sign the access token.');
    });

    it('rejects a token signed with a different secret', () => {
        const serviceA = new JwtMoodleAccessTokenService('secret-a');
        const serviceB = new JwtMoodleAccessTokenService('secret-b');
        const token = serviceA.sign({ instanceId: 'icomp-colab', username: 'matheusricardo1', session: { token: 'x' } });

        expect(() => serviceB.verify(token)).toThrow();
    });

    it('rejects a garbage token', () => {
        const service = new JwtMoodleAccessTokenService();
        expect(() => service.verify('not-a-jwt')).toThrow();
    });

    it('throws instead of silently constructing with an undefined secret', () => {
        const originalSecret = process.env.MOODLE_JWT_SECRET;
        const originalFallback = process.env.JWT_SECRET;
        delete process.env.MOODLE_JWT_SECRET;
        delete process.env.JWT_SECRET;

        try {
            expect(() => new JwtMoodleAccessTokenService()).toThrow('CRITICAL: MOODLE_JWT_SECRET or JWT_SECRET must be defined.');
        } finally {
            if (originalSecret !== undefined) process.env.MOODLE_JWT_SECRET = originalSecret;
            if (originalFallback !== undefined) process.env.JWT_SECRET = originalFallback;
        }
    });
});
