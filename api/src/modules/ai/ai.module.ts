import { Module } from '@nestjs/common';
import { SendAiChatMessageUseCase } from '@ai/application/use-cases/send-ai-chat-message.usecase';
import { AI_CHAT_PROVIDER, type AiChatProvider } from '@ai/application/ports/ai-chat-provider';
import { VercelAiChatProvider } from '@ai/infrastructure/providers/vercel-ai-chat.provider';
import { AiController } from '@ai/presentation/http/ai.controller';
import { AiAuthGuard } from '@ai/presentation/http/guards/ai-auth.guard';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';

@Module({
    controllers: [AiController],
    providers: [
        JwtAccessTokenService,
        AiAuthGuard,
        {
            provide: AI_CHAT_PROVIDER,
            useFactory: () => new VercelAiChatProvider()
        },
        {
            provide: SendAiChatMessageUseCase,
            useFactory: (aiChatProvider: AiChatProvider) => {
                return new SendAiChatMessageUseCase(aiChatProvider);
            },
            inject: [AI_CHAT_PROVIDER]
        }
    ]
})
export class AiModule {}
