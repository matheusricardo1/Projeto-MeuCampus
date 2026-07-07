export type AiChatMessageRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
    id: string;
    role: AiChatMessageRole;
    content: string;
    createdAt: string;
}
