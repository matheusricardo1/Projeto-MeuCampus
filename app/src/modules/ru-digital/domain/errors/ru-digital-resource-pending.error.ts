/** Thrown when a RU Digital resource isn't cached yet and a scrape was enqueued (HTTP 202). The caller should poll again shortly. */
export class RuDigitalResourcePendingError extends Error {
    constructor(public readonly resource: string) {
        super(`RU Digital resource "${resource}" is still being loaded.`);
        this.name = 'RuDigitalResourcePendingError';
    }
}
