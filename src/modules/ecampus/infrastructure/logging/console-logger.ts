export const logger = {
    info: (message: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${message}`),
    warning: (message: string) => console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`),
    error: (message: string) => console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`),
    critical: (message: string) => console.error(`\x1b[41m[CRITICAL]\x1b[0m ${message}`)
};
