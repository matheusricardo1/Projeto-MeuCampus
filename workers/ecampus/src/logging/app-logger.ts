type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
type LogContext = Record<string, unknown>;

const sensitiveKeyPattern = /(password|senha|token|authorization|cookie|secret|cpf|credential|session)/i;
const cpfPattern = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

function log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const serializedContext = context ? ` ${JSON.stringify(redactValue(context))}` : '';
    const line = `[${level}] ${timestamp} ${redactString(message)}${serializedContext}`;

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
    info: (message: string, context?: LogContext) => log('INFO', message, context),
    warning: (message: string, context?: LogContext) => log('WARN', message, context),
    error: (message: string, context?: LogContext) => log('ERROR', message, context),
    critical: (message: string, context?: LogContext) => log('CRITICAL', message, context)
};
