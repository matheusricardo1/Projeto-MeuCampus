import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';
import { AiQuotaService } from '@ai/infrastructure/redis/ai-quota.service';
import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';

const FREE_DAILY_LIMIT = Number(process.env.AI_FREE_DAILY_LIMIT || 30);
const PAID_DAILY_LIMIT = Number(process.env.AI_PAID_DAILY_LIMIT || 100);

interface RequestWithAiUser {
    aiUser?: AiAuthenticatedUser;
}

@Injectable()
export class AiQuotaGuard implements CanActivate {
    constructor(
        private readonly quotaService: AiQuotaService,
        private readonly userPlanRepository: UserPlanRepository
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithAiUser>();
        const cpf = request.aiUser?.id;
        if (!cpf) {
            return true;
        }

        const userId = pseudonymousUserId(cpf);
        const { plan } = await this.userPlanRepository.getPlan(userId);
        const limit = plan === 'PAID' ? PAID_DAILY_LIMIT : FREE_DAILY_LIMIT;

        const result = await this.quotaService.consume(userId, limit);

        if (!result.allowed) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    // errorCode (not `error`) so it survives HttpErrorFilter, which
                    // always overwrites `error` with a generic per-status label.
                    errorCode: 'AI_DAILY_LIMIT_REACHED',
                    message: `Limite diario de ${limit} mensagens atingido.`,
                    limit,
                    plan
                },
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        return true;
    }
}
