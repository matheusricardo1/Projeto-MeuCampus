import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';
import { CommunityController } from '@community/presentation/http/community.controller';

@Module({
    imports: [AuthModule],
    controllers: [CommunityController],
    providers: [PrismaService, CommunityPostRepository],
    exports: [CommunityPostRepository]
})
export class CommunityModule {}
