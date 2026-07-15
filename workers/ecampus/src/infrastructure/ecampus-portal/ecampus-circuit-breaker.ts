import { appLogger as logger } from '@/infrastructure/logging/app-logger';

export class EcampusUnavailableError extends Error {
    constructor(message = 'O eCampus parece estar fora do ar ou muito lento no momento. Tente novamente em alguns instantes.') {
        super(message);
        this.name = 'EcampusUnavailableError';
    }
}

type BreakerState = 'closed' | 'open' | 'half-open';

interface RequestOutcome {
    timestamp: number;
    success: boolean;
}

/**
 * A single EcampusClient is created per request (see EcampusAuthService), so
 * this state has to live outside any one client instance — eCampus's overall
 * availability is one shared external dependency, not something scoped to a
 * single student's session. Trips open when the error rate over a rolling
 * window gets too high, so the worker stops sending more requests that would
 * just time out anyway (each up to 15-25s) and fails fast instead, then
 * probes again after a cooldown.
 */
export class EcampusCircuitBreaker {
    private static readonly WINDOW_MS = 3 * 60 * 1000;
    private static readonly ERROR_RATE_THRESHOLD = 0.6;
    // Below this many samples in the window, a rate is too noisy to act on
    // (e.g. 1 failure out of 1 request is a 100% rate but tells us nothing).
    private static readonly MIN_REQUESTS_IN_WINDOW = 5;
    private static readonly RESET_TIMEOUT_MS = 2 * 60 * 1000;

    private state: BreakerState = 'closed';
    private openedAt = 0;
    private requests: RequestOutcome[] = [];

    canAttempt(): boolean {
        if (this.state !== 'open') {
            return true;
        }

        if (Date.now() - this.openedAt < EcampusCircuitBreaker.RESET_TIMEOUT_MS) {
            return false;
        }

        // Cooldown elapsed - let exactly one request through as a probe.
        this.state = 'half-open';
        return true;
    }

    recordSuccess(): void {
        if (this.state !== 'closed') {
            logger.info('eCampus circuit breaker closing again after a successful request.');
        }

        this.state = 'closed';
        this.recordOutcome(true);
    }

    recordFailure(): void {
        if (this.state === 'half-open') {
            // The probe failed - eCampus is still down, go straight back to open.
            this.trip();
            return;
        }

        this.recordOutcome(false);

        const errorRate = this.currentErrorRate();
        if (errorRate !== null && errorRate >= EcampusCircuitBreaker.ERROR_RATE_THRESHOLD) {
            this.trip();
        }
    }

    private recordOutcome(success: boolean): void {
        const now = Date.now();
        this.requests.push({ timestamp: now, success });
        this.pruneOldRequests(now);
    }

    private pruneOldRequests(now: number): void {
        const cutoff = now - EcampusCircuitBreaker.WINDOW_MS;
        while (this.requests[0] !== undefined && this.requests[0].timestamp < cutoff) {
            this.requests.shift();
        }
    }

    private currentErrorRate(): number | null {
        if (this.requests.length < EcampusCircuitBreaker.MIN_REQUESTS_IN_WINDOW) {
            return null;
        }

        const failures = this.requests.filter((request) => !request.success).length;
        return failures / this.requests.length;
    }

    private trip(): void {
        this.state = 'open';
        this.openedAt = Date.now();
        const errorRate = this.currentErrorRate();
        const rateMessage = errorRate !== null ? ` after a ${(errorRate * 100).toFixed(0)}% error rate over the last ${EcampusCircuitBreaker.WINDOW_MS / 1000}s` : '';
        logger.error(`eCampus circuit breaker opened${rateMessage} - failing fast for ${EcampusCircuitBreaker.RESET_TIMEOUT_MS}ms instead of hitting eCampus.`);
    }
}

// Process-wide singleton, shared by every EcampusClient instance.
export const ecampusCircuitBreaker = new EcampusCircuitBreaker();
