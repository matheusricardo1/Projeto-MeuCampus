import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { isPlanActive, type UserPlan } from '@billing/domain/entities/user-plan.entity';

@Injectable()
export class UserPlanRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getPlan(pseudonymousUserId: string): Promise<UserPlan> {
        const user = await this.prisma.user.findUnique({ where: { id: pseudonymousUserId } });

        if (!user) {
            return { id: pseudonymousUserId, plan: 'FREE', planExpiresAt: null };
        }

        if (user.plan === 'PAID' && !isPlanActive({ id: user.id, plan: user.plan, planExpiresAt: user.planExpiresAt })) {
            return { id: user.id, plan: 'FREE', planExpiresAt: user.planExpiresAt };
        }

        return { id: user.id, plan: user.plan, planExpiresAt: user.planExpiresAt };
    }

    async createPendingPayment(pseudonymousUserId: string, params: { amountCents: number; planDays: number }): Promise<string> {
        await this.prisma.user.upsert({
            where: { id: pseudonymousUserId },
            create: { id: pseudonymousUserId },
            update: {}
        });

        const payment = await this.prisma.payment.create({
            data: {
                userId: pseudonymousUserId,
                amountCents: params.amountCents,
                planDays: params.planDays,
                status: 'PENDING'
            }
        });

        return payment.id;
    }

    async attachMercadoPagoId(paymentId: string, mpPaymentId: string): Promise<void> {
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { mpPaymentId }
        });
    }

    async approvePayment(mpPaymentId: string): Promise<void> {
        const payment = await this.prisma.payment.findUnique({ where: { mpPaymentId } });
        if (!payment || payment.status === 'APPROVED') return;

        await this.prisma.$transaction([
            this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'APPROVED' }
            }),
            this.prisma.user.update({
                where: { id: payment.userId },
                data: {
                    plan: 'PAID',
                    planExpiresAt: this.extendExpiry(payment.planDays)
                }
            })
        ]);
    }

    async markPaymentStatus(mpPaymentId: string, status: 'REJECTED' | 'EXPIRED'): Promise<void> {
        await this.prisma.payment.updateMany({
            where: { mpPaymentId, status: 'PENDING' },
            data: { status }
        });
    }

    async getPaymentStatus(paymentId: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | null> {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        return payment?.status ?? null;
    }

    /** Users whose PAID plan hasn't expired yet — mirrors the active-plan check in isPlanActive(). */
    async countActivePaidUsers(): Promise<number> {
        return this.prisma.user.count({
            where: { plan: 'PAID', planExpiresAt: { gt: new Date() } }
        });
    }

    async sumRevenueCents(since?: Date): Promise<number> {
        const result = await this.prisma.payment.aggregate({
            where: { status: 'APPROVED', ...(since ? { createdAt: { gte: since } } : {}) },
            _sum: { amountCents: true }
        });

        return result._sum?.amountCents ?? 0;
    }

    private extendExpiry(days: number): Date {
        const base = new Date();
        base.setUTCDate(base.getUTCDate() + days);
        return base;
    }
}
