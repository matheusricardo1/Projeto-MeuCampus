import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '@/domain/entities/grade';
import type { AiChatMessage } from '@/domain/entities/ai-chat-message';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import { EcampusResourcePendingError } from '@/domain/errors/ecampus-resource-pending.error';
import { createEcampusUseCases } from '@/presentation/composition/create-ecampus-use-cases';
import { connectEcampusRealtime, type EcampusResourceReadyEvent } from '@/infrastructure/realtime/ecampus-realtime-client';
import { useLanguage } from '@/presentation/i18n/language-provider';
import type { TranslationKey, TranslationValues } from '@/presentation/i18n/languages';

type WorkspaceTab = 'home' | 'profile' | 'schedule' | 'grades' | 'lessonPlan' | 'ai';
type ResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan' | 'prefetch' | 'restore' | 'login' | 'logout' | 'aiChat';
type InitialResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan';

interface LoginInput {
    user: string;
    password: string;
}

interface GradesInput {
    year: string;
    period: string;
}

interface SendAiChatMessageInput {
    conversationId?: string;
    message: string;
    history?: AiChatMessage[];
}

interface RequestOptions {
    reportError?: boolean;
    showGlobalLoading?: boolean;
    sessionGeneration?: number;
}

interface PrefetchOptions extends RequestOptions {
    includeProfile?: boolean;
    force?: boolean;
}

type WorkspaceError =
    | { kind: 'raw'; message: string }
    | { kind: 'translated'; key: TranslationKey; values?: TranslationValues };

const DEFAULT_REQUEST_OPTIONS: Required<Pick<RequestOptions, 'reportError' | 'showGlobalLoading'>> = {
    reportError: true,
    showGlobalLoading: true
};
const IS_AI_FEATURE_ENABLED = process.env.EXPO_PUBLIC_APP_ENV === 'development';

function getCurrentGradesInput(): GradesInput {
    const now = new Date();
    return {
        year: now.getFullYear().toString(),
        period: now.getMonth() >= 6 ? '2' : '1'
    };
}

export function useEcampusWorkspace() {
    const { t } = useLanguage();
    const useCases = useMemo(() => createEcampusUseCases(), []);
    const currentGradesInput = useMemo(() => getCurrentGradesInput(), []);
    const sessionGeneration = useRef(0);
    const inFlightRequests = useRef(new Map<ResourceKey, Promise<unknown>>());
    const realtimeHandlerRef = useRef<(event: EcampusResourceReadyEvent) => void>(() => undefined);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(0);
    const [errorState, setErrorState] = useState<WorkspaceError | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [schedule, setSchedule] = useState<ScheduleClass[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanItem[]>([]);
    const [lessonPlanSubjects, setLessonPlanSubjects] = useState<LessonPlanSubject[]>([]);
    const [selectedLessonPlanSubjectCode, setSelectedLessonPlanSubjectCode] = useState('');
    const [gradesInput, setGradesInput] = useState<GradesInput>(currentGradesInput);
    const [pendingInitialResources, setPendingInitialResources] = useState<Set<InitialResourceKey>>(new Set());

    const isInitialDataLoading = pendingInitialResources.size > 0;
    const isLoading = loadingRequests > 0 || isInitialDataLoading;
    const error = errorState
        ? errorState.kind === 'translated'
            ? t(errorState.key, errorState.values)
            : errorState.message
        : null;
    const clearError = () => setErrorState(null);
    const setRawError = (message: string) => setErrorState({ kind: 'raw', message });
    const setTranslatedError = (key: TranslationKey, values?: TranslationValues) => setErrorState({ kind: 'translated', key, values });

    const clearWorkspaceData = () => {
        setProfile(null);
        setSchedule([]);
        setGrades([]);
        setLessonPlan([]);
        setLessonPlanSubjects([]);
        setSelectedLessonPlanSubjectCode('');
        setPendingInitialResources(new Set());
    };

    const startNewSessionGeneration = () => {
        sessionGeneration.current += 1;
        inFlightRequests.current.clear();
        setLoadingRequests(0);
        setPendingInitialResources(new Set());
        return sessionGeneration.current;
    };

    const markInitialResourcesPending = (resources: InitialResourceKey[]) => {
        setPendingInitialResources((current) => {
            const next = new Set(current);
            resources.forEach((resource) => next.add(resource));
            return next;
        });
    };

    const markInitialResourceReady = (resource: InitialResourceKey) => {
        setPendingInitialResources((current) => {
            if (!current.has(resource)) {
                return current;
            }

            const next = new Set(current);
            next.delete(resource);
            return next;
        });
    };

    const expireSession = async (message?: string) => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        setActiveTab('home');
        if (message) {
            setRawError(message);
        } else {
            setTranslatedError('errors.sessionExpired');
        }
        await useCases.clearAuthSession.execute();
    };

    const runSingle = async <T,>(key: ResourceKey, task: () => Promise<T>): Promise<T | null> => {
        const current = inFlightRequests.current.get(key) as Promise<T> | undefined;
        if (current) {
            return current;
        }

        const request = task().finally(() => {
            if (inFlightRequests.current.get(key) === request) {
                inFlightRequests.current.delete(key);
            }
        });

        inFlightRequests.current.set(key, request);
        return request;
    };

    const run = async <T,>(task: () => Promise<T>, options: RequestOptions = {}): Promise<T | null> => {
        const requestOptions = { ...DEFAULT_REQUEST_OPTIONS, ...options };

        if (requestOptions.showGlobalLoading) {
            setLoadingRequests((current) => current + 1);
        }

        if (requestOptions.reportError) {
            clearError();
        }

        try {
            return await task();
        } catch (caught) {
            if (caught instanceof EcampusResourcePendingError) {
                return null;
            }

            if (caught instanceof AuthSessionExpiredError) {
                if (requestOptions.sessionGeneration === undefined || requestOptions.sessionGeneration === sessionGeneration.current) {
                    await expireSession(caught.message);
                }

                return null;
            }

            if (requestOptions.reportError) {
                if (caught instanceof Error) {
                    setRawError(caught.message);
                } else {
                    setTranslatedError('errors.generic');
                }
            }

            return null;
        } finally {
            if (requestOptions.showGlobalLoading) {
                setLoadingRequests((current) => Math.max(0, current - 1));
            }
        }
    };

    const loadProfile = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('profile', () => run(() => useCases.getStudentProfile.execute(), {
            ...options,
            sessionGeneration: generation
        }));

        if (data && generation === sessionGeneration.current) {
            setProfile(data);
            setIsAuthenticated(true);
            markInitialResourceReady('profile');
        }
    };

    const loadSchedule = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('schedule', () => run(() => useCases.getSchedule.execute(), {
            ...options,
            sessionGeneration: generation
        }));

        if (data && generation === sessionGeneration.current) {
            setSchedule(data);
            markInitialResourceReady('schedule');
        }
    };

    const loadGrades = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('grades', () => run(() => useCases.getGrades.execute(gradesInput.year, gradesInput.period), {
            ...options,
            sessionGeneration: generation
        }));

        if (data && generation === sessionGeneration.current) {
            setGrades(data);
            markInitialResourceReady('grades');
        }
    };

    const changeGradesInputAndLoad = async (input: GradesInput) => {
        setGradesInput(input);
        setGrades([]);

        const generation = sessionGeneration.current;
        const data = await run(() => useCases.getGrades.execute(input.year, input.period), {
            reportError: true,
            showGlobalLoading: true,
            sessionGeneration: generation
        });

        if (data && generation === sessionGeneration.current) {
            setGrades(data);
        }
    };

    const pickLessonPlanSubject = (subjects: LessonPlanSubject[], currentCode: string) => {
        return subjects.find((subject) => subject.code === currentCode)
            || subjects.find((subject) => subject.available)
            || subjects[0]
            || null;
    };

    const loadLessonPlanSubjects = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('lessonPlanSubjects', () => run(() => useCases.getLessonPlanSubjects.execute(), {
            ...options,
            sessionGeneration: generation
        }));

        if (!data || generation !== sessionGeneration.current) {
            return;
        }

        const selectedSubject = pickLessonPlanSubject(data, selectedLessonPlanSubjectCode);
        setLessonPlanSubjects(data);
        setSelectedLessonPlanSubjectCode(selectedSubject?.code || '');
        markInitialResourceReady('lessonPlanSubjects');

        if (selectedSubject?.planId) {
            await enqueueLessonPlanScrape(selectedSubject.planId, { reportError: false, showGlobalLoading: false });
        } else {
            setLessonPlan([]);
            markInitialResourceReady('lessonPlan');
        }
    };

    const loadLessonPlan = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);

        if (!selectedSubject) {
            setTranslatedError('errors.loadSubjectsFirst');
            return;
        }

        setSelectedLessonPlanSubjectCode(selectedSubject.code);

        if (!selectedSubject.planId) {
            setLessonPlan([]);
            setTranslatedError('errors.lessonPlanUnavailable', { code: selectedSubject.code, subject: selectedSubject.subject });
            return;
        }

        const data = await runSingle('lessonPlan', () => run(() => useCases.getLessonPlan.execute(selectedSubject.planId!), {
            ...options,
            sessionGeneration: generation
        }));

        if (data && generation === sessionGeneration.current) {
            setLessonPlan(data);
            markInitialResourceReady('lessonPlan');
        }
    };

    const enqueueLessonPlanScrape = async (planId: string, options?: RequestOptions) => {
        await run(() => useCases.enqueueScrapeJob.execute('lesson-plan', { planId }), {
            reportError: false,
            showGlobalLoading: false,
            ...options
        });
    };

    realtimeHandlerRef.current = (event: EcampusResourceReadyEvent) => {
        const silentOptions: RequestOptions = { reportError: false, showGlobalLoading: false };

        switch (event.resource) {
            case 'profile':
                void loadProfile(silentOptions);
                return;
            case 'schedule':
                void loadSchedule(silentOptions);
                return;
            case 'grades':
                if (event.year === gradesInput.year && event.period === gradesInput.period) {
                    void loadGrades(silentOptions);
                }
                return;
            case 'lesson-plan-subjects':
                void loadLessonPlanSubjects(silentOptions);
                return;
            case 'lesson-plan': {
                const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);
                if (!event.planId || event.planId === selectedSubject?.planId) {
                    void loadLessonPlan(silentOptions);
                }
            }
        }
    };

    useEffect(() => {
        let disconnect: (() => void) | undefined;
        let disposed = false;

        if (!isAuthenticated) {
            return undefined;
        }

        void useCases.getAuthSession.execute().then((session) => {
            if (!session || disposed) {
                return;
            }

            disconnect = connectEcampusRealtime(
                session.accessToken,
                (event) => realtimeHandlerRef.current(event),
                () => {
                    if (!disposed) {
                        void prefetchWorkspace({ force: false });
                    }
                }
            );
        });

        return () => {
            disposed = true;
            disconnect?.();
        };
    }, [isAuthenticated, useCases]);

    const prefetchWorkspace = async (options?: PrefetchOptions) => {
        await runSingle('prefetch', async () => {
            const tasks: Array<Promise<unknown>> = [];
            const resourcesToWaitFor: InitialResourceKey[] = [];

            if ((options?.includeProfile ?? true) && (options?.force || !profile)) {
                resourcesToWaitFor.push('profile');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('profile'), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options?.force || schedule.length === 0) {
                resourcesToWaitFor.push('schedule');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('schedule'), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options?.force || grades.length === 0) {
                resourcesToWaitFor.push('grades');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('grades', {
                    year: gradesInput.year,
                    period: gradesInput.period
                }), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options?.force || lessonPlanSubjects.length === 0) {
                resourcesToWaitFor.push('lessonPlanSubjects', 'lessonPlan');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('lesson-plan-subjects'), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            markInitialResourcesPending(resourcesToWaitFor);
            await Promise.allSettled(tasks);
        });
    };

    const refreshDashboard = async () => {
        await prefetchWorkspace({
            force: true,
            reportError: true,
            showGlobalLoading: true
        });
    };

    const restoreSession = async () => {
        setIsReady(false);

        try {
            const session = await useCases.getAuthSession.execute();

            if (!session) {
                setIsAuthenticated(false);
                clearWorkspaceData();
                setIsReady(true);
                return;
            }

            startNewSessionGeneration();
            clearWorkspaceData();
            clearError();
            setActiveTab('home');

            setIsAuthenticated(true);
        } finally {
            setIsReady(true);
        }
    };

    const login = async (input: LoginInput) => {
        const session = await runSingle('login', () => run(() => useCases.login.execute(input)));

        if (!session) {
            return;
        }

        startNewSessionGeneration();
        clearWorkspaceData();
        setActiveTab('home');
        setIsAuthenticated(true);
        clearError();
    };

    const logout = async () => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        clearError();
        setActiveTab('home');

        await runSingle('logout', () => useCases.logout.execute()).catch((caught) => {
            if (caught instanceof Error) {
                setRawError(caught.message);
            } else {
                setTranslatedError('errors.logout');
            }
            return null;
        });
    };

    const sendAiChatMessage = async (input: SendAiChatMessageInput) => {
        const generation = sessionGeneration.current;
        clearError();

        try {
            return await useCases.sendAiChatMessage.execute(input);
        } catch (caught) {
            if (caught instanceof AuthSessionExpiredError) {
                if (generation === sessionGeneration.current) {
                    await expireSession(caught.message);
                }

                return null;
            }

            if (caught instanceof Error) {
                setRawError(caught.message);
                throw caught;
            }

            setTranslatedError('errors.generic');
            throw new Error(t('errors.generic'));
        }
    };

    const changeLessonPlanSubject = async (code: string) => {
        const generation = sessionGeneration.current;
        const selectedSubject = lessonPlanSubjects.find((subject) => subject.code === code);

        setSelectedLessonPlanSubjectCode(code);
        setLessonPlan([]);
        clearError();

        if (!selectedSubject) {
            return;
        }

        if (!selectedSubject.planId) {
            setTranslatedError('errors.lessonPlanUnavailable', { code: selectedSubject.code, subject: selectedSubject.subject });
            return;
        }

        markInitialResourcesPending(['lessonPlan']);
        await run(() => useCases.enqueueScrapeJob.execute('lesson-plan', { planId: selectedSubject.planId }), {
            reportError: true,
            showGlobalLoading: true,
            sessionGeneration: generation
        });
    };

    const openTab = (tab: WorkspaceTab) => {
        if (tab === 'ai' && !IS_AI_FEATURE_ENABLED) {
            setActiveTab('home');
            void prefetchWorkspace();
            return;
        }

        setActiveTab(tab);

        if (tab === 'home') void prefetchWorkspace();
        if (tab === 'profile' && !profile) {
            markInitialResourcesPending(['profile']);
            void run(() => useCases.enqueueScrapeJob.execute('profile'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'schedule' && schedule.length === 0) {
            markInitialResourcesPending(['schedule']);
            void run(() => useCases.enqueueScrapeJob.execute('schedule'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'grades' && grades.length === 0) {
            markInitialResourcesPending(['grades']);
            void run(() => useCases.enqueueScrapeJob.execute('grades', {
                year: gradesInput.year,
                period: gradesInput.period
            }), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && grades.length === 0) {
            markInitialResourcesPending(['grades']);
            void run(() => useCases.enqueueScrapeJob.execute('grades', {
                year: gradesInput.year,
                period: gradesInput.period
            }), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && lessonPlanSubjects.length === 0) {
            markInitialResourcesPending(['lessonPlanSubjects', 'lessonPlan']);
            void run(() => useCases.enqueueScrapeJob.execute('lesson-plan-subjects'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && lessonPlanSubjects.length > 0 && lessonPlan.length === 0) {
            const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);
            if (selectedSubject?.planId) {
                markInitialResourcesPending(['lessonPlan']);
                void enqueueLessonPlanScrape(selectedSubject.planId, { reportError: false, showGlobalLoading: false });
            }
        }
        // AI tab doesn't require data loading
    };

    return {
        activeTab,
        changeLessonPlanSubject,
        changeGradesInputAndLoad,
        currentGradesInput,
        error,
        grades,
        gradesInput,
        isAuthenticated,
        isInitialDataLoading,
        isLoading,
        isReady,
        lessonPlan,
        lessonPlanSubjects,
        loadGrades,
        loadLessonPlan,
        loadLessonPlanSubjects,
        loadProfile,
        loadSchedule,
        login,
        logout,
        openTab,
        profile,
        refreshDashboard,
        restoreSession,
        schedule,
        selectedLessonPlanSubjectCode,
        sendAiChatMessage,
        setGradesInput
    };
}
