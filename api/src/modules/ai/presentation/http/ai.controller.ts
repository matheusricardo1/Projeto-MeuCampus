import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { CancelAiChatMessageUseCase } from '@ai/application/use-cases/cancel-ai-chat-message.usecase';
import { CurrentAiUser } from '@ai/presentation/http/decorators/current-ai-user.decorator';
import { SendAiChatMessageRequest } from '@ai/presentation/http/dto/send-ai-chat-message.request';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';
import { AiQuotaGuard } from '@ai/presentation/http/guards/ai-quota.guard';

@Controller('ai')
@UseGuards(AiAuthGuard)
export class AiController {
    constructor(
        private readonly sendAiChatMessageUseCase: SendAiChatMessageUseCase,
        private readonly cancelAiChatMessageUseCase: CancelAiChatMessageUseCase
    ) {}

    @Post('chat/messages')
    @HttpCode(202)
    @UseGuards(AiQuotaGuard)
    async sendMessage(
        @CurrentAiUser() user: AiAuthenticatedUser,
        @Body() body: SendAiChatMessageRequest
    ) {
        return this.sendAiChatMessageUseCase.execute(
            user.id,
            new SendAiChatMessageRequest(body?.conversationId, body?.message, body?.history).toUseCaseInput()
        );
    }

    @Delete('chat/messages/:jobId')
    @HttpCode(202)
    async cancelMessage(@Param('jobId') jobId: string) {
        await this.cancelAiChatMessageUseCase.execute(jobId);
        return { status: 'cancelling' };
    }
}
