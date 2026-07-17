import { Module } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { GlobalDataRepository } from '@global-data/infrastructure/prisma/global-data.repository';

@Module({
    providers: [PrismaService, GlobalDataRepository],
    exports: [GlobalDataRepository]
})
export class GlobalDataModule {}
