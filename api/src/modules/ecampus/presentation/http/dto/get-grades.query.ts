import { EcampusRequestValidator } from '@ecampus/presentation/http/validators/ecampus-request.validator';

export class GetGradesQuery {
    constructor(
        private readonly year?: string,
        private readonly period?: string
    ) {}

    toUseCaseInput() {
        return {
            year: EcampusRequestValidator.parseYear(this.year),
            period: EcampusRequestValidator.parsePeriod(this.period)
        };
    }
}
