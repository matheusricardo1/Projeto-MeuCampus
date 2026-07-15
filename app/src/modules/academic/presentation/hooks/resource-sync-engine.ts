export interface BootstrapSyncOptions {
    /** Pulls every resource still pending; resolves once the attempt settles. */
    loadPending: () => Promise<void>;
    /** True once nothing is pending anymore. */
    isDone: () => boolean;
    /** Called once when the deadline passes with something still pending. */
    onDeadline: () => void;
    pollIntervalMs: number;
    deadlineMs: number;
    // Injectable so tests can drive the loop with fake timers/clock; default to
    // the platform globals.
    now?: () => number;
    schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    cancel?: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface BootstrapSync {
    /** Begins (or restarts) the sync: immediate pull, then poll until done/deadline. */
    start: () => void;
    /** A realtime signal arrived — pull now instead of waiting for the next tick. */
    signal: () => void;
    /** Stops all polling; safe to call any number of times. */
    stop: () => void;
}

/**
 * A pull-first, poll-backed sync loop. It repeatedly asks `loadPending` to
 * fetch whatever is still pending until `isDone` is true or the deadline
 * elapses. This is intentionally free of any WebSocket/React knowledge so it
 * can be unit-tested in isolation; the hook supplies the actual loaders and
 * the pending/ready bookkeeping through the callbacks.
 */
export function createBootstrapSync(options: BootstrapSyncOptions): BootstrapSync {
    const now = options.now ?? (() => Date.now());
    const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel ?? ((handle) => clearTimeout(handle));

    let timer: ReturnType<typeof setTimeout> | null = null;
    let deadlineAt = 0;
    let running = false;
    // Prevents overlapping ticks if a single pull takes longer than the poll
    // interval — a slow backend must never fan out into concurrent pull storms.
    let inFlight = false;

    const clearTimer = () => {
        if (timer !== null) {
            cancel(timer);
            timer = null;
        }
    };

    const stop = () => {
        running = false;
        clearTimer();
    };

    const scheduleNext = () => {
        clearTimer();
        if (running) {
            timer = schedule(tick, options.pollIntervalMs);
        }
    };

    async function tick(): Promise<void> {
        if (!running || inFlight) {
            return;
        }

        inFlight = true;
        try {
            await options.loadPending();
        } finally {
            inFlight = false;
        }

        if (!running) {
            return;
        }

        if (options.isDone()) {
            stop();
            return;
        }

        if (now() >= deadlineAt) {
            stop();
            options.onDeadline();
            return;
        }

        scheduleNext();
    }

    const start = (): void => {
        clearTimer();
        deadlineAt = now() + options.deadlineMs;
        running = true;
        void tick();
    };

    const signal = (): void => {
        if (running) {
            void tick();
        }
    };

    return { start, signal, stop };
}
