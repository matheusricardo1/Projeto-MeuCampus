import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';
import { DomainException } from '@/shared/domain/domain.exception';

const statusMessages: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'Requisicao invalida.',
    [HttpStatus.UNAUTHORIZED]: 'Voce precisa entrar novamente.',
    [HttpStatus.FORBIDDEN]: 'Voce nao tem permissao para realizar esta acao.',
    [HttpStatus.NOT_FOUND]: 'Recurso nao encontrado.',
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Formato da requisicao nao suportado.',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'Nao foi possivel processar sua solicitacao agora. Tente novamente em instantes.',
    [HttpStatus.BAD_GATEWAY]: 'O eCampus nao respondeu como esperado. Tente novamente em instantes.',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'Servico temporariamente indisponivel. Tente novamente em instantes.',
    [HttpStatus.GATEWAY_TIMEOUT]: 'A comunicacao demorou mais que o esperado. Tente novamente.'
};
const fallbackServerMessage = 'Nao foi possivel processar sua solicitacao agora. Tente novamente em instantes.';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();
        const statusCode = this.getStatusCode(exception);
        const errorName = exception instanceof Error ? exception.name : 'UnknownError';
        const message = this.getMessage(exception, statusCode);
        const stack = exception instanceof Error ? exception.stack : undefined;
        const location = this.getStackLocation(stack);
        const isServerError = statusCode >= 500;
        const logMessage = `${request.method} ${request.originalUrl}`;
        const logContext = isServerError
            ? { statusCode, errorName, message, location }
            : { statusCode, errorName, message };

        if (isServerError) {
            appLogger.error(logMessage, logContext);
        } else {
            appLogger.warning(logMessage, logContext);
        }

        response.status(statusCode).json({
            statusCode,
            message,
            error: this.getErrorLabel(statusCode),
            ...this.getPassthroughFields(exception),
            path: request.originalUrl,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Forwards a machine-readable `errorCode` (plus any extra fields the
     * throw site attached) untouched, so callers can branch on it client-side
     * without needing bespoke handling in this filter for every case. Named
     * `errorCode` (not `error`) specifically so it never collides with the
     * generic per-status `error` label above.
     */
    private getPassthroughFields(exception: unknown): Record<string, unknown> {
        if (!(exception instanceof HttpException)) return {};

        const response = exception.getResponse();
        if (typeof response !== 'object' || response === null || !('errorCode' in response)) return {};

        const { statusCode: _statusCode, message: _message, error: _error, ...rest } = response as Record<string, unknown>;
        return rest;
    }

    private getMessage(exception: unknown, statusCode: number): string {
        if (statusCode >= 500) {
            return statusMessages[statusCode] || fallbackServerMessage;
        }

        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            if (typeof response === 'string') return this.translateMessage(response, statusCode);
            if (typeof response === 'object' && response !== null && 'message' in response) {
                const message = (response as { message: string | string[] }).message;
                return Array.isArray(message)
                    ? message.map((item) => this.translateMessage(item, statusCode)).join(', ')
                    : this.translateMessage(message, statusCode);
            }
        }

        if (exception instanceof DomainException) {
            return this.translateMessage(exception.message, statusCode);
        }

        return statusMessages[statusCode] || 'Nao foi possivel concluir a operacao.';
    }

    private getErrorLabel(statusCode: number): string {
        if (statusCode >= 500) return 'Erro interno';

        const labels: Record<number, string> = {
            [HttpStatus.BAD_REQUEST]: 'Requisicao invalida',
            [HttpStatus.UNAUTHORIZED]: 'Nao autorizado',
            [HttpStatus.FORBIDDEN]: 'Acesso negado',
            [HttpStatus.NOT_FOUND]: 'Nao encontrado',
            [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Formato invalido',
            [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas tentativas'
        };

        return labels[statusCode] || 'Erro na requisicao';
    }

    private translateMessage(message: string, statusCode: number): string {
        const normalized = message.trim();
        const dictionary: Record<string, string> = {
            "Field 'user' must be a valid CPF.": 'Informe um CPF valido.',
            "Field 'password' is invalid.": 'Informe uma senha valida.',
            "Query param 'year' must have 4 digits.": 'Informe um ano com 4 digitos.',
            "Query param 'year' is outside the accepted range.": 'Informe um ano dentro do periodo aceito.',
            "Query param 'period' is invalid.": 'Informe um periodo valido.',
            "Route param 'planId' is invalid.": 'Plano de ensino invalido.',
            'Invalid eCampus credentials.': 'CPF ou senha invalidos.',
            'Invalid CPF or password.': 'CPF ou senha invalidos.',
            'Invalid or expired bearer token.': 'Sua sessao expirou. Entre novamente.',
            'Missing bearer token.': 'Sua sessao nao foi encontrada. Entre novamente.',
            'Authorization header must use Bearer token.': 'Sua sessao esta invalida. Entre novamente.',
            'eCampus session missing from token payload.': 'Sua sessao nao foi encontrada. Entre novamente.',
            'eCampus session expired. Please sign in again.': 'Sua sessao expirou. Entre novamente.',
            'Attempted to access protected route without auth.': 'Sua sessao expirou. Entre novamente.',
            'Origin is not allowed.': 'Origem nao permitida.',
            'Content-Type must be application/json.': 'A requisicao precisa usar JSON.',
            'Too many requests. Try again later.': 'Muitas tentativas. Aguarde um minuto e tente novamente.',
            'HTTPS is required.': 'A comunicacao precisa usar HTTPS.',
            'Internal server error': fallbackServerMessage
        };

        return dictionary[normalized] || normalized || statusMessages[statusCode] || 'Nao foi possivel concluir a operacao.';
    }

    private getStatusCode(exception: unknown): number {
        if (exception instanceof HttpException) return exception.getStatus();
        if (exception instanceof DomainException) return exception.statusCode;
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private getStackLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        return stack.split('\n').find((line) => line.includes('src\\') || line.includes('src/'))?.trim();
    }
}
