// src/core/logger.ts
export const logger = {
    info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    warning: (msg: string) => console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg: string) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    critical: (msg: string) => console.error(`\x1b[41m[CRITICAL]\x1b[0m ${msg}`)
};

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthenticationError";
    }
}