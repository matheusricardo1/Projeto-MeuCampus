import type { AiChatTable } from '@/domain/entities/ai-chat-message';

export interface ParsedChatResponse {
    content: string;
    table?: AiChatTable;
    quickReplies?: string[];
    suggestions?: string[];
    links?: string[];
}

const QUICK_REPLIES_PATTERN = /\n?\[\[OPCOES:\s*([^\]]+)\]\]\s*$/i;
const FOLLOWUP_SUGGESTIONS_PATTERN = /\n?\[\[SUGESTOES:\s*([^\]]+)\]\]\s*$/i;
const LINK_PATTERN = /https?:\/\/[^\s<>()"']+/g;

// Turns the model's raw markdown-ish reply (trailing [[OPCOES: ...]] /
// [[SUGESTOES: ...]] marker lines, an inline markdown table, bare URLs) into
// the structured widget fields the frontend renders directly — so the
// client never has to parse marker syntax out of streamed/partial text.
export function parseChatResponse(rawText: string): ParsedChatResponse {
    const afterOptions = extractMarkerList(rawText, QUICK_REPLIES_PATTERN, 4, 2);
    const afterSuggestions = extractMarkerList(afterOptions.content, FOLLOWUP_SUGGESTIONS_PATTERN, 3, 1);
    const { content, table } = extractTable(afterSuggestions.content);
    const links = extractLinks(content);

    return {
        content,
        ...(table ? { table } : {}),
        ...(afterOptions.items.length ? { quickReplies: afterOptions.items } : {}),
        ...(afterSuggestions.items.length ? { suggestions: afterSuggestions.items } : {}),
        ...(links.length ? { links } : {})
    };
}

function extractMarkerList(text: string, pattern: RegExp, maxItems: number, minItems: number): { content: string; items: string[] } {
    const match = text.match(pattern);
    if (!match?.[1]) return { content: text, items: [] };

    const items = match[1]
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);

    if (items.length < minItems) return { content: text, items: [] };

    return { content: text.slice(0, match.index).trimEnd(), items };
}

function isTableRowLine(line: string): boolean {
    return line.startsWith('|') && line.endsWith('|') && line.length > 1;
}

function isTableSeparatorLine(line: string): boolean {
    return isTableRowLine(line) && line.split('|').slice(1, -1).every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

function splitTableRow(line: string): string[] {
    return line.slice(1, -1).split('|').map((cell) => cell.trim());
}

function extractTable(text: string): { content: string; table?: AiChatTable } {
    const lines = text.replace(/\r\n/g, '\n').split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = (lines[lineIndex] ?? '').trim();
        const nextLine = (lines[lineIndex + 1] ?? '').trim();
        if (!isTableRowLine(line) || !isTableSeparatorLine(nextLine)) continue;

        const headers = splitTableRow(line);
        const rows: string[][] = [];
        let cursor = lineIndex + 2;
        while (cursor < lines.length && isTableRowLine((lines[cursor] ?? '').trim())) {
            rows.push(splitTableRow((lines[cursor] ?? '').trim()));
            cursor += 1;
        }

        const before = lines.slice(0, lineIndex).join('\n').trim();
        const after = lines.slice(cursor).join('\n').trim();
        const content = [before, after].filter(Boolean).join('\n\n').trim();

        return { content, table: { headers, rows } };
    }

    return { content: text };
}

function extractLinks(content: string): string[] {
    const matches = content.match(LINK_PATTERN) || [];
    const cleaned = matches.map((url) => url.replace(/[.,;:!?)\]]+$/, ''));
    return Array.from(new Set(cleaned)).slice(0, 4);
}
