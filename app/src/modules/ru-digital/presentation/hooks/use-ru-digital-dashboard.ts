import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuDigitalHttpClient } from '@/modules/ru-digital/infrastructure/http/ru-digital-http-client';
import { RuDigitalResourcePendingError } from '@/modules/ru-digital/domain/errors/ru-digital-resource-pending.error';
import { RuDigitalSessionExpiredError } from '@/modules/ru-digital/domain/errors/ru-digital-session-expired.error';
import type { RuDigitalStudent } from '@/modules/ru-digital/domain/entities/student';
import type { RuDigitalBalance } from '@/modules/ru-digital/domain/entities/balance';
import type { RuDigitalDailyMenu } from '@/modules/ru-digital/domain/entities/daily-menu';
import type { RuDigitalRestaurant } from '@/modules/ru-digital/domain/entities/restaurant';

interface UseRuDigitalDashboardResult {
    isLinked: boolean;
    isLoading: boolean;
    error: string | null;
    student: RuDigitalStudent | null;
    balance: RuDigitalBalance | null;
    dailyMenu: RuDigitalDailyMenu | null;
    restaurant: RuDigitalRestaurant | null;
    /** True once polling for the default restaurant has given up — the student needs to pick one (see the restaurant picker screen). */
    needsRestaurantSelection: boolean;
    reload: () => void;
}

const POLL_INTERVAL_MS = 2000;
// The worker can't (yet) push back a "restaurant not selected" failure — a
// stuck-forever pending default-restaurant fetch, after a bounded number of
// polls, is the client-side signal to fall back to the picker instead of
// spinning forever. See RestaurantNotSelectedError on the worker side.
const MAX_POLLS = 6;

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

export function useRuDigitalDashboard(): UseRuDigitalDashboardResult {
    const client = useMemo(() => new RuDigitalHttpClient(), []);
    const [isLinked, setIsLinked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [student, setStudent] = useState<RuDigitalStudent | null>(null);
    const [balance, setBalance] = useState<RuDigitalBalance | null>(null);
    const [dailyMenu, setDailyMenu] = useState<RuDigitalDailyMenu | null>(null);
    const [restaurant, setRestaurant] = useState<RuDigitalRestaurant | null>(null);
    const [needsRestaurantSelection, setNeedsRestaurantSelection] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const activeRef = useRef(0);

    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    useEffect(() => {
        const runId = ++activeRef.current;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let polls = 0;

        const isCurrent = () => runId === activeRef.current;

        const pollOne = async <T,>(load: () => Promise<T>, onReady: (value: T) => void): Promise<'ready' | 'pending' | 'gone'> => {
            try {
                const value = await load();
                if (!isCurrent()) return 'gone';
                onReady(value);
                return 'ready';
            } catch (caught) {
                if (!isCurrent()) return 'gone';
                if (caught instanceof RuDigitalResourcePendingError) return 'pending';
                throw caught;
            }
        };

        const attempt = async () => {
            try {
                const linked = await client.isLoggedIn();
                if (!isCurrent()) return;
                setIsLinked(linked);
                if (!linked) {
                    setIsLoading(false);
                    return;
                }

                const [studentResult, balanceResult, menuResult, restaurantResult] = await Promise.all([
                    pollOne(() => client.getStudent(), setStudent),
                    pollOne(() => client.getBalance(), setBalance),
                    pollOne(() => client.getDailyMenu(todayIsoDate()), setDailyMenu),
                    pollOne(() => client.getDefaultRestaurant(), setRestaurant)
                ]);

                if (!isCurrent()) return;

                const stillPending = [studentResult, balanceResult, menuResult, restaurantResult].some((result) => result === 'pending');
                if (!stillPending) {
                    setIsLoading(false);
                    setNeedsRestaurantSelection(false);
                    return;
                }

                polls += 1;
                if (polls >= MAX_POLLS) {
                    setIsLoading(false);
                    // A stuck default-restaurant fetch specifically (balance/menu also
                    // depend on one being selected) means this is a first-time session —
                    // send the student to pick one instead of leaving a dead spinner.
                    setNeedsRestaurantSelection(restaurantResult === 'pending');
                    return;
                }

                timer = setTimeout(() => void attempt(), POLL_INTERVAL_MS);
            } catch (caught) {
                if (!isCurrent()) return;
                if (caught instanceof RuDigitalSessionExpiredError) {
                    setIsLinked(false);
                    setIsLoading(false);
                    return;
                }
                setError(caught instanceof Error ? caught.message : 'Nao foi possivel carregar os dados do RU Digital.');
                setIsLoading(false);
            }
        };

        setIsLoading(true);
        setError(null);
        setNeedsRestaurantSelection(false);
        void attempt();

        return () => {
            activeRef.current++;
            if (timer) clearTimeout(timer);
        };
    }, [client, reloadToken]);

    return { isLinked, isLoading, error, student, balance, dailyMenu, restaurant, needsRestaurantSelection, reload };
}
