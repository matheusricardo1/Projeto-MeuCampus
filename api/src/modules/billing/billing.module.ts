import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { UserPlanRepository } from '@billing/infrastructure/prisma/user-plan.repository';
import { MercadoPagoPaymentService } from '@billing/infrastructure/mercadopago/mercadopago-payment.service';
import { BillingController } from '@billing/presentation/http/billing.controller';

@Module({
    imports: [AuthModule],
    controllers: [BillingController],
    providers: [PrismaService, UserPlanRepository, MercadoPagoPaymentService],
    exports: [UserPlanRepository]
})
export class BillingModule {}
