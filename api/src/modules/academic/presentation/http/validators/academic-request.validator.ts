import { InvalidAcademicRequestError } from '@academic/presentation/http/errors/invalid-academic-request.error';
import { getCurrentAcademicPeriod } from '@academic/application/services/current-academic-period';

const acceptedPeriods = new Set(['1', '1o', '201', '2', '2o', '202', 'ferias1', 'ferias-1', '203', 'ferias2', 'ferias-2', '204', 'especial', '5', '401']);

export class AcademicRequestValidator {
    static parseCpf(value?: string): string {
        const digits = value?.replace(/\D/g, '') || '';
        if (!this.isValidCpf(digits)) {
            throw new InvalidAcademicRequestError('Informe um CPF valido.');
        }

        return digits;
    }

    static parsePassword(value?: string): string {
        if (typeof value !== 'string' || value.length < 1 || value.length > 128 || /[\u0000-\u001F\u007F]/.test(value)) {
            throw new InvalidAcademicRequestError('Informe uma senha valida.');
        }

        return value;
    }

    static parseYear(value?: string): string {
        const year = value?.trim() || getCurrentAcademicPeriod().year;
        if (!/^\d{4}$/.test(year)) {
            throw new InvalidAcademicRequestError('Informe um ano com 4 digitos.');
        }

        const numericYear = Number(year);
        const nextYear = new Date().getFullYear() + 1;
        if (numericYear < 2000 || numericYear > nextYear) {
            throw new InvalidAcademicRequestError('Informe um ano dentro do periodo aceito.');
        }

        return year;
    }

    static parsePeriod(value?: string): string {
        const period = value?.trim().toLowerCase() || getCurrentAcademicPeriod().period;
        if (!acceptedPeriods.has(period)) {
            throw new InvalidAcademicRequestError('Informe um periodo valido.');
        }

        return period;
    }

    static parsePlanId(value: string): string {
        const planId = value.trim();
        if (!/^\d{1,20}$/.test(planId)) {
            throw new InvalidAcademicRequestError('Plano de ensino invalido.');
        }

        return planId;
    }

    private static isValidCpf(digits: string): boolean {
        if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
            return false;
        }

        const calculateDigit = (size: number) => {
            let sum = 0;
            for (let index = 0; index < size; index += 1) {
                sum += Number(digits[index]) * (size + 1 - index);
            }

            const remainder = (sum * 10) % 11;
            return remainder === 10 ? 0 : remainder;
        };

        return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
    }
}
