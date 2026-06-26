import { EcampusRequestValidator } from '@ecampus/presentation/http/validators/ecampus-request.validator';

export class GetLessonPlanParams {
    constructor(private readonly planId: string) {}

    toUseCaseInput() {
        return {
            planId: EcampusRequestValidator.parsePlanId(this.planId)
        };
    }
}
