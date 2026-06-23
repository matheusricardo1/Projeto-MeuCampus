type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'ACCESS';
type LogContext = Record<string, unknown>;

const colors: Record<LogLevel, string> = {
    ACCESS: '\x1b[35m',
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    CRITICAL: '\x1b[41m'
};

const sensitiveKeyPattern = /(password|senha|token|authorization|cookie|secret|cpf|credential|session)/i;
const cpfPattern = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

function log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const reset = '\x1b[0m';
    const serializedContext = context ? ` ${JSON.stringify(redactValue(context))}` : '';
    const line = `${color}[${level}]${reset} ${timestamp} ${redactString(message)}${serializedContext}`;

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

function redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactString(value);
    }

    if (Array.isArray(value)) {
        return value.map(redactValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as LogContext).map(([key, nestedValue]) => {
            if (sensitiveKeyPattern.test(key)) {
                return [key, '[REDACTED]'];
            }

            return [key, redactValue(nestedValue)];
        }));
    }

    return value;
}

function redactString(value: string): string {
    return value.replace(bearerPattern, 'Bearer [REDACTED]').replace(cpfPattern, '[CPF]');
}

export const appLogger = {
    access: (message: string, context?: LogContext) => log('ACCESS', message, context),
    info: (message: string, context?: LogContext) => log('INFO', message, context),
    warning: (message: string, context?: LogContext) => log('WARN', message, context),
    error: (message: string, context?: LogContext) => log('ERROR', message, context),
    critical: (message: string, context?: LogContext) => log('CRITICAL', message, context)
};
