import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';
import { InternalSecretGuard } from '@/shared/mcp/internal-secret.guard';
import { McpController } from '@composition/mcp/mcp.controller';

@Module({
    imports: [EcampusModule],
    controllers: [McpController],
    providers: [InternalSecretGuard]
})
export class McpModule {}
