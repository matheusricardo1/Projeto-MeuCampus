import { AcademicRequestValidator } from '@academic/presentation/http/validators/academic-request.validator';

export class GetGradesQuery {
    constructor(
        private readonly year?: string,
        private readonly period?: string
    ) {}

    toUseCaseInput() {
        return {
            year: AcademicRequestValidator.parseYear(this.year),
            period: AcademicRequestValidator.parsePeriod(this.period)
        };
    }
}
