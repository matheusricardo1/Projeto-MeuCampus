import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EcampusCircuitBreaker } from '@/infrastructure/ecampus-portal/ecampus-circuit-breaker';

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30000;

describe('EcampusCircuitBreaker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stays closed and keeps allowing attempts below the failure threshold', () => {
        const breaker = new EcampusCircuitBreaker();

        for (let i = 0; i < FAILURE_THRESHOLD - 1; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(true);
    });

    it('opens and blocks attempts once the failure threshold is reached', () => {
        const breaker = new EcampusCircuitBreaker();

        for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(false);
    });

    it('resets the failure count on a success before the threshold is hit', () => {
        const breaker = new EcampusCircuitBreaker();

        for (let i = 0; i < FAILURE_THRESHOLD - 1; i += 1) {
            breaker.recordFailure();
        }
        breaker.recordSuccess();

        for (let i = 0; i < FAILURE_THRESHOLD - 1; i += 1) {
            breaker.recordFailure();
        }

        expect(breaker.canAttempt()).toBe(true);
    });

    it('stays open until the reset timeout elapses, then allows a half-open probe', () => {
        const breaker = new EcampusCircuitBreaker();
        for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
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
        for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
            breaker.recordFailure();
        }
        vi.advanceTimersByTime(RESET_TIMEOUT_MS);
        expect(breaker.canAttempt()).toBe(true);

        breaker.recordSuccess();

        for (let i = 0; i < FAILURE_THRESHOLD - 1; i += 1) {
            breaker.recordFailure();
        }
        expect(breaker.canAttempt()).toBe(true);
    });

    it('goes straight back to open when the half-open probe fails, without needing the full threshold again', () => {
        const breaker = new EcampusCircuitBreaker();
        for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
            breaker.recordFailure();
        }
        vi.advanceTimersByTime(RESET_TIMEOUT_MS);
        expect(breaker.canAttempt()).toBe(true);

        breaker.recordFailure();

        expect(breaker.canAttempt()).toBe(false);
    });
});
