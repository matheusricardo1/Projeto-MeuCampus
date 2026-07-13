import { describe, expect, it } from 'vitest';
import { LoginAcademicRequest } from '@academic/presentation/http/dto/login-academic.request';
import { InvalidAcademicRequestError } from '@academic/presentation/http/errors/invalid-academic-request.error';

describe('LoginAcademicRequest', () => {
    it('parses a valid CPF and password into credentials input', () => {
        const request = new LoginAcademicRequest('529.982.247-25', 'secret123');
        expect(request.toCredentialsInput()).toEqual({ user: '52998224725', password: 'secret123' });
    });

    it('throws when the CPF is missing', () => {
        const request = new LoginAcademicRequest(undefined, 'secret123');
        expect(() => request.toCredentialsInput()).toThrow(InvalidAcademicRequestError);
    });

    it('throws when the password is missing', () => {
        const request = new LoginAcademicRequest('529.982.247-25', undefined);
        expect(() => request.toCredentialsInput()).toThrow(InvalidAcademicRequestError);
    });

    it('throws when the CPF check digits are invalid', () => {
        const request = new LoginAcademicRequest('52998224726', 'secret123');
        expect(() => request.toCredentialsInput()).toThrow(InvalidAcademicRequestError);
    });
});
