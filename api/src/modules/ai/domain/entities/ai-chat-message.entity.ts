type AiChatMessageRole = 'user' | 'assistant' | 'system';

interface AiChatTable {
    headers: string[];
    rows: string[][];
}

export interface AiChatMessage {
    id: string;
    role: AiChatMessageRole;
    content: string;
    createdAt: string;
    table?: AiChatTable;
    quickReplies?: string[];
    suggestions?: string[];
    links?: string[];
}
