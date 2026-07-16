import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EcampusCircuitBreaker } from '@/infrastructure/ecampus-portal/ecampus-circuit-breaker';

// Mirror the breaker's own constants (kept private on the class).
const MIN_REQUESTS_IN_WINDOW = 5;
const RESET_TIMEOUT_MS = 2 * 60 * 1000;

describe('EcampusCircuitBreaker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stays closed while there are too few samples to judge the error rate', () => {
        const breaker = new EcampusCircuitBreaker();

        // Even an all-failure streak below the minimum sample size is too noisy
        // to act on, so the breaker must keep letting requests through.
        for (let i = 0; i < MIN_REQUESTS_IN_WINDOW - 1; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(true);
    });

    it('opens once the error rate crosses the threshold over the window', () => {
        const breaker = new EcampusCircuitBreaker();

        for (let i = 0; i < MIN_REQUESTS_IN_WINDOW; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(false);
    });

    it('stays closed when enough successes keep the error rate below the threshold', () => {
        const breaker = new EcampusCircuitBreaker();

        // 3 successes then 3 failures: at every failure the window has >= 5
        // samples but the error rate peaks at 50% (< 60%), so it never trips.
        breaker.recordSuccess();
        breaker.recordSuccess();
        breaker.recordSuccess();
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();

        expect(breaker.canAttempt()).toBe(true);
    });

    it('stays open until the reset timeout elapses, then allows a half-open probe', () => {
        const breaker = new EcampusCircuitBreaker();
        for (let i = 0; i < MIN_REQUESTS_IN_WINDOW; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(false);

        vi.advanceTimersByTime(RESET_TIMEOUT_MS - 1);
        expect(breaker.canAttempt()).toBe(false);

        vi.advanceTimersByTime(1);
        expect(breaker.canAttempt()).toBe(true);
    });

    it('closes again when the half-open probe succeeds', () => {
        const breaker = new EcampusCircuitBreaker();
        for (let i = 0; i < MIN_REQUESTS_IN_WINDOW; i += 1) {
            breaker.recordFailure();
        }
        vi.advanceTimersByTime(RESET_TIMEOUT_MS);
        expect(breaker.canAttempt()).toBe(true); // half-open probe allowed

        breaker.recordSuccess();

        expect(breaker.canAttempt()).toBe(true); // back to closed
    });

    it('goes straight back to open when the half-open probe fails, without needing the full threshold again', () => {
        const breaker = new EcampusCircuitBreaker();
        for (let i = 0; i < MIN_REQUESTS_IN_WINDOW; i += 1) {
            breaker.recordFailure();
        }
        vi.advanceTimersByTime(RESET_TIMEOUT_MS);
        expect(breaker.canAttempt()).toBe(true); // half-open probe allowed

        breaker.recordFailure();

        expect(breaker.canAttempt()).toBe(false);
    });
});
