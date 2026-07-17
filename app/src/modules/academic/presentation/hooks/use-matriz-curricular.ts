import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MatrizHttpClient, MatrizPendingError } from '@/modules/academic/infrastructure/http/matriz-http-client';
import type { MatrizCurricular } from '@/modules/academic/domain/entities/matriz-curricular';

interface UseMatrizCurricularResult {
    matriz: MatrizCurricular | null;
    isLoading: boolean;
    error: string | null;
    reload: () => void;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 16; // ~40s: first scrape downloads + parses the report PDF.

/**
 * Loads the student's curriculum matrix. The first ever load triggers a live
 * eCampus scrape (HTTP 202), so we poll a few times until the parsed matrix is
 * cached; subsequent loads are instant.
 */
export function useMatrizCurricular(): UseMatrizCurricularResult {
    const client = useMemo(() => new MatrizHttpClient(), []);
    const [matriz, setMatriz] = useState<MatrizCurricular | null>(null);
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
                const result = await client.getMatrizCurricular();
                if (runId !== activeRef.current) return;
                setMatriz(result);
                setIsLoading(false);
            } catch (caught) {
                if (runId !== activeRef.current) return;
                if (caught instanceof MatrizPendingError && polls < MAX_POLLS) {
                    polls += 1;
                    timer = setTimeout(() => void attempt(), POLL_INTERVAL_MS);
                    return;
                }
                setError(caught instanceof MatrizPendingError
                    ? 'A matriz está demorando para carregar. Tente novamente.'
                    : caught instanceof Error ? caught.message : 'Não foi possível carregar a matriz curricular.');
                setIsLoading(false);
            }
        };

        void attempt();
        return () => {
            activeRef.current++;
            if (timer) clearTimeout(timer);
        };
    }, [client, reloadToken]);

    return { matriz, isLoading, error, reload };
}
