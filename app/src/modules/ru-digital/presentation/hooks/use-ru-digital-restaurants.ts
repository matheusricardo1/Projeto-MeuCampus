import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuDigitalHttpClient } from '@/modules/ru-digital/infrastructure/http/ru-digital-http-client';
import { RuDigitalResourcePendingError } from '@/modules/ru-digital/domain/errors/ru-digital-resource-pending.error';
import type { RuDigitalRestaurant } from '@/modules/ru-digital/domain/entities/restaurant';

interface UseRuDigitalRestaurantsResult {
    restaurants: RuDigitalRestaurant[];
    isLoading: boolean;
    error: string | null;
    isSelecting: boolean;
    selectRestaurant: (restaurantId: string) => Promise<boolean>;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 8;

export function useRuDigitalRestaurants(): UseRuDigitalRestaurantsResult {
    const client = useMemo(() => new RuDigitalHttpClient(), []);
    const [restaurants, setRestaurants] = useState<RuDigitalRestaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const activeRef = useRef(0);

    useEffect(() => {
        const runId = ++activeRef.current;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let polls = 0;

        const attempt = async () => {
            try {
                const result = await client.listRestaurants();
                if (runId !== activeRef.current) return;
                setRestaurants(result);
                setIsLoading(false);
            } catch (caught) {
                if (runId !== activeRef.current) return;
                if (caught instanceof RuDigitalResourcePendingError && polls < MAX_POLLS) {
                    polls += 1;
                    timer = setTimeout(() => void attempt(), POLL_INTERVAL_MS);
                    return;
                }
                setError(caught instanceof Error ? caught.message : 'Nao foi possivel carregar os restaurantes.');
                setIsLoading(false);
            }
        };

        setIsLoading(true);
        setError(null);
        void attempt();

        return () => {
            activeRef.current++;
            if (timer) clearTimeout(timer);
        };
    }, [client]);

    const selectRestaurant = useCallback(async (restaurantId: string): Promise<boolean> => {
        setIsSelecting(true);
        setError(null);
        try {
            await client.selectRestaurant(restaurantId);
            return true;
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel selecionar o restaurante.');
            return false;
        } finally {
            setIsSelecting(false);
        }
    }, [client]);

    return { restaurants, isLoading, error, isSelecting, selectRestaurant };
}
