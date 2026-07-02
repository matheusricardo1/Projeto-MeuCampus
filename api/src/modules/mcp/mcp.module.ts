import { Module } from '@nestjs/common';
import { EcampusModule } from '@ecampus/ecampus.module';
import { InternalSecretGuard } from '@mcp/guards/internal-secret.guard';
import { McpController } from '@mcp/presentation/http/mcp.controller';

@Module({
    imports: [EcampusModule],
    controllers: [McpController],
    providers: [InternalSecretGuard]
})
export class McpModule {}
