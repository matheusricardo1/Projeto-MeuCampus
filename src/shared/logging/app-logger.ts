type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'ACCESS';

const colors: Record<LogLevel, string> = {
    ACCESS: '\x1b[35m',
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    CRITICAL: '\x1b[41m'
};

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const reset = '\x1b[0m';
    const serializedContext = context ? ` ${JSON.stringify(context)}` : '';
    const line = `${color}[${level}]${reset} ${timestamp} ${message}${serializedContext}`;

    if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(line);
        return;
    }

    if (level === 'WARN') {
        console.warn(line);
        return;
    }

    console.log(line);
}

export const appLogger = {
    access: (message: string, context?: Record<string, unknown>) => log('ACCESS', message, context),
    info: (message: string, context?: Record<string, unknown>) => log('INFO', message, context),
    warning: (message: string, context?: Record<string, unknown>) => log('WARN', message, context),
    error: (message: string, context?: Record<string, unknown>) => log('ERROR', message, context),
    critical: (message: string, context?: Record<string, unknown>) => log('CRITICAL', message, context)
};
