import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AcademicLoginFailedException } from '@academic/domain/exceptions/academic-login-failed.exception';
import { AcademicResourceNotFoundException } from '@academic/domain/exceptions/academic-resource-not-found.exception';
import { AcademicWorkerUnavailableException } from '@academic/domain/exceptions/academic-worker-unavailable.exception';
import { InvalidAcademicPeriodException, InvalidAcademicYearException } from '@academic/domain/exceptions/invalid-academic-period.exception';

describe('AcademicLoginFailedException', () => {
    it('carries a fixed, user-facing message and a matching name', () => {
        const error = new AcademicLoginFailedException();
        expect(error.message).toBe('CPF ou senha invalidos.');
        expect(error.name).toBe('AcademicLoginFailedException');
        expect(error).toBeInstanceOf(Error);
    });
});

describe('AcademicResourceNotFoundException', () => {
    it('exposes the missing resource and a 404 status code', () => {
        const error = new AcademicResourceNotFoundException('grades');
        expect(error.resource).toBe('grades');
        expect(error.message).toBe('No cached result for grades.');
        expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
        expect(error.name).toBe('AcademicResourceNotFoundException');
    });
});

describe('AcademicWorkerUnavailableException', () => {
    it('carries a 503 status code and a fixed message', () => {
        const error = new AcademicWorkerUnavailableException();
        expect(error.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.message).toContain('temporariamente indisponivel');
        expect(error.name).toBe('AcademicWorkerUnavailableException');
    });
});

describe('InvalidAcademicYearException', () => {
    it('uses a default message when none is given', () => {
        const error = new InvalidAcademicYearException();
        expect(error.message).toBe('Informe um ano dentro do periodo aceito.');
        expect(error.name).toBe('InvalidAcademicYearException');
    });

    it('accepts a custom message', () => {
        const error = new InvalidAcademicYearException('Informe um ano com 4 digitos.');
        expect(error.message).toBe('Informe um ano com 4 digitos.');
    });
});

describe('InvalidAcademicPeriodException', () => {
    it('carries a fixed message', () => {
        const error = new InvalidAcademicPeriodException();
        expect(error.message).toBe('Informe um periodo valido.');
        expect(error.name).toBe('InvalidAcademicPeriodException');
    });
});
