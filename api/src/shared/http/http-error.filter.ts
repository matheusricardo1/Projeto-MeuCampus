import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { appLogger } from '@/shared/logging/app-logger';
import { InvalidAiMessageError } from '@ai/domain/errors/invalid-ai-message.error';
import { AuthenticationError } from '@ecampus/domain/errors/authentication.error';
import { ResourceNotFoundError } from '@ecampus/domain/errors/resource-not-found.error';
import { InvalidEcampusRequestError } from '@ecampus/presentation/http/errors/invalid-ecampus-request.error';

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
            path: request.originalUrl,
            timestamp: new Date().toISOString()
        });
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

        if (exception instanceof ResourceNotFoundError) {
            return this.translateMessage(exception.message, statusCode);
        }

        if (exception instanceof InvalidAiMessageError) {
            return this.translateMessage(exception.message, statusCode);
        }

        if (exception instanceof AuthenticationError || exception instanceof InvalidEcampusRequestError) {
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
        if (exception instanceof InvalidAiMessageError) return HttpStatus.BAD_REQUEST;
        if (exception instanceof InvalidEcampusRequestError) return HttpStatus.BAD_REQUEST;
        if (exception instanceof AuthenticationError) return HttpStatus.UNAUTHORIZED;
        if (exception instanceof ResourceNotFoundError) return HttpStatus.NOT_FOUND;
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private getStackLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        return stack.split('\n').find((line) => line.includes('src\\') || line.includes('src/'))?.trim();
    }
}
