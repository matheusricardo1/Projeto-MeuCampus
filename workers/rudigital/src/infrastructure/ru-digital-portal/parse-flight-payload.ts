import { ExternalServiceError } from '@/domain/exceptions/external-service.error';

const LINE_PATTERN = /^(\d+):([\s\S]*)$/;

/**
 * RU Digital's Server Actions respond in Next.js's "RSC Flight" wire format:
 * newline-separated `<index>:<payload>` segments. A bootstrap segment
 * (`{"a":...,"f":"...","b":"..."}`) always comes first; the actual data we
 * asked for is a later segment, and is plain JSON. An error is instead
 * prefixed with `E`, e.g. `1:E{"digest":"123"}` (production builds redact
 * the message, only a digest id survives).
 *
 * Returns the last successfully-parsed JSON segment that isn't the bootstrap
 * one — server actions only ever return a single data value, so the last
 * valid segment is always it.
 */
export function parseFlightPayload<T>(raw: unknown): T {
    const text = typeof raw === 'string' ? raw : '';
    const lines = text.split('\n').filter((line) => line.length > 0);

    let result: T | undefined;
    let found = false;

    for (const line of lines) {
        const match = line.match(LINE_PATTERN);
        if (!match) continue;

        const payload = match[2] ?? '';

        if (payload.startsWith('E{')) {
            throw new ExternalServiceError(`RU Digital action failed: ${payload.slice(1)}`);
        }

        if (isBootstrapSegment(payload)) continue;

        try {
            result = JSON.parse(payload) as T;
            found = true;
        } catch {
            // Not JSON — an RSC element/module reference we don't need (e.g. "$Sreact.fragment").
        }
    }

    if (!found) {
        throw new ExternalServiceError('RU Digital response did not contain a parsable data segment.');
    }

    return result as T;
}

function isBootstrapSegment(payload: string): boolean {
    return /^\{"a":/.test(payload);
}
