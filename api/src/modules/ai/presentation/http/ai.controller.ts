import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AiAuthenticatedUser } from '@ai/domain/entities/ai-authenticated-user.entity';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { CurrentAiUser } from '@ai/presentation/http/decorators/current-ai-user.decorator';
import { SendAiChatMessageRequest } from '@ai/presentation/http/dto/send-ai-chat-message.request';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';

@Controller('ai')
@UseGuards(AiAuthGuard)
export class AiController {
    constructor(private readonly sendAiChatMessageUseCase: SendAiChatMessageUseCase) {}

    @Post('chat/messages')
    @HttpCode(202)
    async sendMessage(
        @CurrentAiUser() user: AiAuthenticatedUser,
        @Body() body: SendAiChatMessageRequest
    ) {
        return this.sendAiChatMessageUseCase.execute(
            user.id,
            new SendAiChatMessageRequest(body?.conversationId, body?.message, body?.history).toUseCaseInput()
        );
    }
}
