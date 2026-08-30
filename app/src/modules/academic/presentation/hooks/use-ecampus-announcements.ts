import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnnouncementsHttpClient, AnnouncementsPendingError } from '@/modules/academic/infrastructure/http/announcements-http-client';
import type { EcampusAnnouncement } from '@/modules/academic/domain/entities/ecampus-announcement';

interface UseEcampusAnnouncementsResult {
    announcements: EcampusAnnouncement[];
    isLoading: boolean;
    error: string | null;
    reload: () => void;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 16;

/**
 * Loads eCampus's institutional announcements. The first-ever load across
 * the whole app triggers a live eCampus scrape (HTTP 202), so this polls a
 * few times until the result is cached; every load after that (by anyone) is
 * instant, since announcements are cached globally, not per student.
 */
export function useEcampusAnnouncements(): UseEcampusAnnouncementsResult {
    const client = useMemo(() => new AnnouncementsHttpClient(), []);
    const [announcements, setAnnouncements] = useState<EcampusAnnouncement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const activeRef = useRef(0);

    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    useEffect(() => {
        const runId = ++activeRef.current;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let polls = 0;

        setIsLoading(true);
        setError(null);

        const attempt = async () => {
            try {
                const result = await client.getAnnouncements();
                if (runId !== activeRef.current) return;
                setAnnouncements(result);
                setIsLoading(false);
            } catch (caught) {
                if (runId !== activeRef.current) return;
                if (caught instanceof AnnouncementsPendingError && polls < MAX_POLLS) {
                    polls += 1;
                    timer = setTimeout(() => void attempt(), POLL_INTERVAL_MS);
                    return;
                }
                setError(caught instanceof AnnouncementsPendingError
                    ? 'Os avisos estao demorando para carregar.'
                    : caught instanceof Error ? caught.message : 'Nao foi possivel carregar os avisos.');
                setIsLoading(false);
            }
        };

        void attempt();
        return () => {
            activeRef.current++;
            if (timer) clearTimeout(timer);
        };
    }, [client, reloadToken]);

    return { announcements, isLoading, error, reload };
}
