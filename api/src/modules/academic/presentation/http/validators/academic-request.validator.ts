import { InvalidAcademicRequestError } from '@academic/presentation/http/errors/invalid-academic-request.error';
import { AcademicPeriod } from '@academic/domain/value-objects/academic-period.value-object';

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

    /**
     * Returns undefined when the caller didn't specify a year at all —
     * distinct from an invalid one — so the use case can resolve "current"
     * from cached data instead of a blind calendar guess. Format/range rules
     * themselves live on AcademicPeriod, not here.
     */
    static parseYear(value?: string): string | undefined {
        const year = value?.trim();
        return year ? AcademicPeriod.validateYear(year) : undefined;
    }

    static parsePeriod(value?: string): string | undefined {
        const period = value?.trim();
        return period ? AcademicPeriod.validatePeriod(period) : undefined;
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
