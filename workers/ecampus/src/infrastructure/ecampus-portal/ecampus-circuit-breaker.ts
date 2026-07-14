import { appLogger as logger } from '@/infrastructure/logging/app-logger';

export class EcampusUnavailableError extends Error {
    constructor(message = 'O eCampus parece estar fora do ar ou muito lento no momento. Tente novamente em alguns instantes.') {
        super(message);
        this.name = 'EcampusUnavailableError';
    }
}

type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * A single EcampusClient is created per request (see EcampusAuthService), so
 * this state has to live outside any one client instance — eCampus's overall
 * availability is one shared external dependency, not something scoped to a
 * single student's session. Trips open after repeated connectivity/server
 * failures so the worker stops sending more requests that would just time
 * out anyway (each up to 15-25s) and fails fast instead, then probes again
 * after a cooldown.
 */
export class EcampusCircuitBreaker {
    private static readonly FAILURE_THRESHOLD = 5;
    private static readonly RESET_TIMEOUT_MS = 30000;

    private state: BreakerState = 'closed';
    private consecutiveFailures = 0;
    private openedAt = 0;

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
        this.consecutiveFailures = 0;
    }

    recordFailure(): void {
        if (this.state === 'half-open') {
            // The probe failed - eCampus is still down, go straight back to open.
            this.trip();
            return;
        }

        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= EcampusCircuitBreaker.FAILURE_THRESHOLD) {
            this.trip();
        }
    }

    private trip(): void {
        this.state = 'open';
        this.openedAt = Date.now();
        logger.error(`eCampus circuit breaker opened after ${this.consecutiveFailures} consecutive connectivity failures - failing fast for ${EcampusCircuitBreaker.RESET_TIMEOUT_MS}ms instead of hitting eCampus.`);
    }
}

// Process-wide singleton, shared by every EcampusClient instance.
export const ecampusCircuitBreaker = new EcampusCircuitBreaker();
