import { useEffect } from 'react';
import { AIPage } from '@/modules/academic/presentation/views/pages/ai';
import { useWorkspace } from '@/modules/academic/presentation/context/workspace-context';
import { useTabsChrome } from './_layout';

export default function AiRoute() {
    const workspace = useWorkspace();
    const chrome = useTabsChrome();

    useEffect(() => {
        workspace.openTab('ai');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <AIPage
            bottomInset={chrome.bottomNavInset}
            hidePromptInput={chrome.isAILaunching}
            onChatScroll={chrome.closeChatHistory}
            onSendMessage={workspace.sendAiChatMessage}
        />
    );
}
