import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';
import { ResourceNotFoundError } from '@ecampus/domain/errors/resource-not-found.error';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();
        const statusCode = this.getStatusCode(exception);
        const errorName = exception instanceof Error ? exception.name : 'UnknownError';
        const message = this.getMessage(exception);
        const stack = exception instanceof Error ? exception.stack : undefined;

        appLogger.error(`${request.method} ${request.originalUrl} failed`, {
            statusCode,
            errorName,
            message,
            location: this.getStackLocation(stack)
        });

        if (stack && statusCode >= 500) {
            appLogger.error('Stack trace', { stack });
        }

        response.status(statusCode).json({
            statusCode,
            message,
            error: errorName,
            path: request.originalUrl,
            timestamp: new Date().toISOString()
        });
    }

    private getMessage(exception: unknown): string {
        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            if (typeof response === 'string') return response;
            if (typeof response === 'object' && response !== null && 'message' in response) {
                const message = (response as { message: string | string[] }).message;
                return Array.isArray(message) ? message.join(', ') : message;
            }
        }

        if (exception instanceof Error) return exception.message;
        return 'Internal server error';
    }

    private getStatusCode(exception: unknown): number {
        if (exception instanceof HttpException) return exception.getStatus();
        if (exception instanceof ResourceNotFoundError) return HttpStatus.NOT_FOUND;
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private getStackLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        return stack.split('\n').find((line) => line.includes('src\\') || line.includes('src/'))?.trim();
    }
}
