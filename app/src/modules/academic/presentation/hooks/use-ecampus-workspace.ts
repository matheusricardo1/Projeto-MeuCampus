import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '@/modules/academic/domain/entities/grade';
import type { AiChatMessage } from '@/modules/academic/domain/entities/ai-chat-message';
import type { LessonPlanItem } from '@/modules/academic/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/modules/academic/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/modules/academic/domain/entities/schedule-class';
import type { StudentProfile } from '@/modules/academic/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/shared/auth/auth-session-expired.error';
import { ServerError } from '@/shared/errors/server.error';
import { EcampusResourcePendingError } from '@/modules/academic/domain/errors/ecampus-resource-pending.error';
import { AcademicPeriod } from '@/modules/academic/domain/value-objects/academic-period';
import { createEcampusUseCases } from '@/modules/academic/presentation/composition/create-ecampus-use-cases';
import { connectEcampusRealtime, type EcampusBootstrapEvent, type EcampusResourceFailedEvent, type EcampusResourceReadyEvent } from '@/modules/academic/infrastructure/realtime/ecampus-realtime-client';
import { useLanguage } from '@/shared/i18n/language-provider';
import type { TranslationKey, TranslationValues } from '@/shared/i18n/languages';

type WorkspaceTab = 'home' | 'profile' | 'schedule' | 'grades' | 'lessonPlan' | 'ai';
type ResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan' | 'prefetch' | 'restore' | 'login' | 'logout' | 'aiChat';
type InitialResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan';
type BootstrapResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects';

// Upper bound on how long any single resource can stay "pending" before its
// skeleton is force-cleared — see perResourceTimeoutsRef below.
const RESOURCE_STUCK_TIMEOUT_MS = 25000;

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

interface SendAiChatMessageHandlers {
    onJobId?: (jobId: string) => void;
    onToolCall?: (toolName: string) => void;
}

interface RequestOptions {
    reportError?: boolean;
    showGlobalLoading?: boolean;
    sessionGeneration?: number;
    // The cold-start restoreSession check finds an already-stale session before the
    // user ever actively used this tab — surfacing "session expired" there would
    // wrongly imply they had just been logged in. Only live expiries (a request that
    // fails mid-session) should show that banner.
    silentSessionExpiry?: boolean;
}

interface PrefetchOptions extends RequestOptions {
    includeProfile?: boolean;
    force?: boolean;
}

type WorkspaceError =
    | { kind: 'raw'; message: string; retryable?: boolean }
    | { kind: 'translated'; key: TranslationKey; values?: TranslationValues; retryable?: boolean };

const DEFAULT_REQUEST_OPTIONS: Required<Pick<RequestOptions, 'reportError' | 'showGlobalLoading'>> = {
    reportError: true,
    showGlobalLoading: true
};
const IS_AI_FEATURE_ENABLED = true;
const BOOTSTRAP_RESOURCES: BootstrapResourceKey[] = ['profile', 'schedule', 'grades', 'lessonPlanSubjects'];

function getCurrentGradesInput(): GradesInput {
    const current = AcademicPeriod.guessCurrent();
    return { year: current.year, period: current.period };
}

function getGradesJobData(input: GradesInput, current: GradesInput): Record<string, unknown> {
    return input.year === current.year && input.period === current.period
        ? {}
        : { year: input.year, period: input.period };
}

export function useEcampusWorkspace() {
    const { t } = useLanguage();
    const useCases = useMemo(() => createEcampusUseCases(), []);
    const currentGradesInput = useMemo(() => getCurrentGradesInput(), []);
    const sessionGeneration = useRef(0);
    const isExpiringSessionRef = useRef(false);
    const isWaitingForInitialEventsRef = useRef(false);
    const hasRealtimeConnectedRef = useRef(false);
    const initialEventsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRequests = useRef(new Map<ResourceKey, Promise<unknown>>());
    const pendingInitialResourcesRef = useRef(new Set<InitialResourceKey>());
    // Safety net per resource: normally a resource clears itself via a
    // realtime "resource-ready" event, but if that event is ever dropped
    // (a WebSocket reconnect race, a job that silently fails server-side)
    // the resource would stay "pending" — and its skeleton on screen —
    // forever. This force-resolves it after a bounded wait no matter which
    // code path marked it pending.
    const perResourceTimeoutsRef = useRef(new Map<InitialResourceKey, ReturnType<typeof setTimeout>>());
    const realtimeHandlerRef = useRef<(event: EcampusResourceReadyEvent) => void>(() => undefined);
    const realtimeFailureHandlerRef = useRef<(event: EcampusResourceFailedEvent) => void>(() => undefined);
    const realtimeBootstrapReadyHandlerRef = useRef<(event: EcampusBootstrapEvent) => void>(() => undefined);
    const realtimeBootstrapFailedHandlerRef = useRef<(event: EcampusBootstrapEvent) => void>(() => undefined);
    const pendingLessonPlanPlanIdRef = useRef<string | null>(null);
    // Tracks which planId the current `lessonPlan` state actually holds, so a
    // re-fetch trigger that's unrelated to the lesson plan itself (e.g. a
    // grades refresh re-running loadLessonPlanSubjects) doesn't re-scrape data
    // that's already loaded and just sitting on screen.
    const loadedLessonPlanIdRef = useRef<string | null>(null);
    const pendingGradesPeriodRef = useRef<GradesInput | null>(null);
    const loadedResourcesRef = useRef(new Set<InitialResourceKey>());
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(0);
    const [errorState, setErrorState] = useState<WorkspaceError | null>(null);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [schedule, setSchedule] = useState<ScheduleClass[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanItem[]>([]);
    const [lessonPlanSubjects, setLessonPlanSubjects] = useState<LessonPlanSubject[]>([]);
    const [selectedLessonPlanSubjectCode, setSelectedLessonPlanSubjectCode] = useState('');
    const [gradesInput, setGradesInput] = useState<GradesInput>(currentGradesInput);
    const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>([]);
    const [aiChatConversationId, setAiChatConversationId] = useState<string | undefined>();
    const [pendingInitialResources, setPendingInitialResources] = useState<Set<InitialResourceKey>>(new Set());

    const isInitialDataLoading = pendingInitialResources.size > 0;
    const isLoading = loadingRequests > 0 || isInitialDataLoading;
    const error = errorState
        ? errorState.kind === 'translated'
            ? t(errorState.key, errorState.values)
            : errorState.message
        : null;
    const isErrorRetryable = errorState?.retryable ?? false;
    const clearError = () => setErrorState(null);
    const setRawError = (message: string, retryable?: boolean) => setErrorState({ kind: 'raw', message, retryable });
    const setTranslatedError = (key: TranslationKey, values?: TranslationValues, retryable?: boolean) => setErrorState({ kind: 'translated', key, values, retryable });

    const clearWorkspaceData = () => {
        setProfile(null);
        setSchedule([]);
        setGrades([]);
        setLessonPlan([]);
        setLessonPlanSubjects([]);
        setSelectedLessonPlanSubjectCode('');
        setAiChatMessages([]);
        setAiChatConversationId(undefined);
        pendingLessonPlanPlanIdRef.current = null;
        loadedLessonPlanIdRef.current = null;
        pendingGradesPeriodRef.current = null;
        loadedResourcesRef.current.clear();
        pendingInitialResourcesRef.current.clear();
        perResourceTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        perResourceTimeoutsRef.current.clear();
        isWaitingForInitialEventsRef.current = false;
        clearInitialEventsTimeout();
        setPendingInitialResources(new Set());
    };

    const startNewSessionGeneration = () => {
        sessionGeneration.current += 1;
        inFlightRequests.current.clear();
        loadedResourcesRef.current.clear();
        pendingInitialResourcesRef.current.clear();
        perResourceTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        perResourceTimeoutsRef.current.clear();
        isWaitingForInitialEventsRef.current = false;
        hasRealtimeConnectedRef.current = false;
        clearInitialEventsTimeout();
        setLoadingRequests(0);
        setPendingInitialResources(new Set());
        return sessionGeneration.current;
    };

    const clearPerResourceTimeout = (resource: InitialResourceKey) => {
        const timeout = perResourceTimeoutsRef.current.get(resource);
        if (timeout) {
            clearTimeout(timeout);
            perResourceTimeoutsRef.current.delete(resource);
        }
    };

    const markInitialResourcesPending = (resources: InitialResourceKey[]) => {
        resources.forEach((resource) => pendingInitialResourcesRef.current.add(resource));
        setPendingInitialResources((current) => {
            const next = new Set(current);
            resources.forEach((resource) => next.add(resource));
            return next;
        });

        resources.forEach((resource) => {
            clearPerResourceTimeout(resource);
            perResourceTimeoutsRef.current.set(resource, setTimeout(() => {
                perResourceTimeoutsRef.current.delete(resource);
                markInitialResourceReady(resource);
            }, RESOURCE_STUCK_TIMEOUT_MS));
        });
    };

    const markInitialResourceReady = (resource: InitialResourceKey) => {
        clearPerResourceTimeout(resource);
        pendingInitialResourcesRef.current.delete(resource);
        setPendingInitialResources((current) => {
            if (!current.has(resource)) {
                return current;
            }

            const next = new Set(current);
            next.delete(resource);
            return next;
        });
    };

    const isInitialResourcePending = (resource: InitialResourceKey) => pendingInitialResourcesRef.current.has(resource);
    // A resource can finish loading with a genuinely empty result (e.g. no
    // grades posted yet this period) — use this, not `.length === 0`, to
    // tell "never loaded" apart from "loaded, and there's nothing there".
    const isLoaded = (resource: InitialResourceKey) => loadedResourcesRef.current.has(resource);

    const clearInitialEventsTimeout = () => {
        if (initialEventsTimeoutRef.current) {
            clearTimeout(initialEventsTimeoutRef.current);
            initialEventsTimeoutRef.current = null;
        }
    };

    // The bootstrap tracker's completion signal (bootstrap-ready /
    // bootstrap-failed) fires exactly once every required resource has
    // settled, whether it succeeded or failed — so there's no need to poll
    // the cache speculatively while waiting for it. This timeout only
    // exists as a last resort if that signal itself never arrives (e.g. a
    // dropped Redis pub/sub message).
    const waitForInitialScrapingEvents = () => {
        isWaitingForInitialEventsRef.current = true;
        markInitialResourcesPending([...BOOTSTRAP_RESOURCES, 'lessonPlan']);
        clearInitialEventsTimeout();
        initialEventsTimeoutRef.current = setTimeout(() => {
            if (!isWaitingForInitialEventsRef.current) {
                return;
            }

            isWaitingForInitialEventsRef.current = false;
            setTranslatedError('errors.generic', undefined, true);
            pendingInitialResourcesRef.current.clear();
            perResourceTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            perResourceTimeoutsRef.current.clear();
            setPendingInitialResources(new Set());
        }, 30000);
    };

    const finishInitialScrapingEvents = async () => {
        if (!isWaitingForInitialEventsRef.current) {
            return;
        }

        isWaitingForInitialEventsRef.current = false;
        clearInitialEventsTimeout();
        const gradesOverride = pendingGradesPeriodRef.current ?? undefined;
        pendingGradesPeriodRef.current = null;
        await loadInitialDataFromCache({ reportError: false, showGlobalLoading: false }, gradesOverride);
    };

    const expireSession = async (message?: string, options: { silent?: boolean } = {}) => {
        if (isExpiringSessionRef.current) {
            return;
        }

        isExpiringSessionRef.current = true;
        try {
            startNewSessionGeneration();
            setIsAuthenticated(false);
            clearWorkspaceData();
            if (!options.silent) {
                if (message) {
                    setRawError(message);
                } else {
                    setTranslatedError('errors.sessionExpired');
                }
            }
            await useCases.clearAuthSession.execute();
        } finally {
            isExpiringSessionRef.current = false;
        }
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
                    await expireSession(caught.message, { silent: requestOptions.silentSessionExpiry });
                }

                return null;
            }

            if (requestOptions.reportError) {
                if (caught instanceof ServerError) {
                    setTranslatedError('errors.server', undefined, true);
                } else if (caught instanceof Error) {
                    setRawError(caught.message, true);
                } else {
                    setTranslatedError('errors.generic', undefined, true);
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
            loadedResourcesRef.current.add('profile');
            markInitialResourceReady('profile');
        }
    };

    const loadSchedule = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('schedule', () => run(() => useCases.getSchedule.execute(), {
            ...options,
            sessionGeneration: generation
        }));

        if (data !== null && generation === sessionGeneration.current) {
            setSchedule(data);
            loadedResourcesRef.current.add('schedule');
            markInitialResourceReady('schedule');
        }
    };

    const loadGrades = async (options?: RequestOptions, override?: GradesInput) => {
        const generation = sessionGeneration.current;
        const target = override ?? gradesInput;
        const data = await runSingle('grades', () => run(() => useCases.getGrades.execute(target.year, target.period), {
            ...options,
            sessionGeneration: generation
        }));

        if (data !== null && generation === sessionGeneration.current) {
            setGrades(data);
            if (override && (override.year !== gradesInput.year || override.period !== gradesInput.period)) {
                setGradesInput(override);
            }
            loadedResourcesRef.current.add('grades');
            markInitialResourceReady('grades');
        }
    };

    const changeGradesInputAndLoad = async (input: GradesInput) => {
        setGradesInput(input);
        setGrades([]);
        setLessonPlanSubjects([]);
        setLessonPlan([]);
        setSelectedLessonPlanSubjectCode('');
        loadedResourcesRef.current.delete('lessonPlanSubjects');
        loadedResourcesRef.current.delete('lessonPlan');
        pendingLessonPlanPlanIdRef.current = null;
        loadedLessonPlanIdRef.current = null;

        const generation = sessionGeneration.current;
        const [gradesData] = await Promise.all([
            run(() => useCases.getGrades.execute(input.year, input.period), {
                reportError: true,
                showGlobalLoading: true,
                sessionGeneration: generation
            }),
            run(() => useCases.getLessonPlanSubjects.execute(input.year, input.period), {
                reportError: false,
                showGlobalLoading: false,
                sessionGeneration: generation
            }).then((subjectsData) => {
                if (subjectsData !== null && generation === sessionGeneration.current) {
                    const selected = pickLessonPlanSubject(subjectsData, '');
                    setLessonPlanSubjects(subjectsData);
                    setSelectedLessonPlanSubjectCode(selected?.code || '');
                    loadedResourcesRef.current.add('lessonPlanSubjects');
                }
            })
        ]);

        if (gradesData !== null && generation === sessionGeneration.current) {
            setGrades(gradesData);
            loadedResourcesRef.current.add('grades');
        }
    };

    const pickLessonPlanSubject = (subjects: LessonPlanSubject[], currentCode: string) => {
        return subjects.find((subject) => subject.code === currentCode)
            || subjects.find((subject) => subject.available)
            || subjects[0]
            || null;
    };

    const loadLessonPlanSubjects = async (options?: RequestOptions, override?: GradesInput) => {
        const generation = sessionGeneration.current;
        const target = override ?? gradesInput;
        const data = await runSingle('lessonPlanSubjects', () => run(() => useCases.getLessonPlanSubjects.execute(target.year, target.period), {
            ...options,
            sessionGeneration: generation
        }));

        if (!data || generation !== sessionGeneration.current) {
            return;
        }

        const selectedSubject = pickLessonPlanSubject(data, selectedLessonPlanSubjectCode);
        setLessonPlanSubjects(data);
        setSelectedLessonPlanSubjectCode(selectedSubject?.code || '');
        loadedResourcesRef.current.add('lessonPlanSubjects');
        markInitialResourceReady('lessonPlanSubjects');

        const pendingPlanId = pendingLessonPlanPlanIdRef.current;
        if (pendingPlanId && selectedSubject?.planId === pendingPlanId) {
            pendingLessonPlanPlanIdRef.current = null;
            await loadLessonPlan(options);
            return;
        }

        if (selectedSubject?.planId === loadedLessonPlanIdRef.current) {
            // Already loaded — this call was triggered by something unrelated
            // to lesson-plan (e.g. a grades refresh re-running this function),
            // so don't re-scrape data that's already sitting on screen.
            markInitialResourceReady('lessonPlan');
            return;
        }

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
            // Not every subject has a published teaching plan yet — that's a normal
            // state the course details screen already renders inline, not something
            // that should also raise the workspace-wide error banner.
            setLessonPlan([]);
            markInitialResourceReady('lessonPlan');
            return;
        }

        const data = await runSingle('lessonPlan', () => run(() => useCases.getLessonPlan.execute(selectedSubject.planId!), {
            ...options,
            sessionGeneration: generation
        }));

        if (data !== null && generation === sessionGeneration.current) {
            setLessonPlan(data);
            loadedResourcesRef.current.add('lessonPlan');
            loadedLessonPlanIdRef.current = selectedSubject.planId;
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

    const loadInitialDataFromCache = async (options?: RequestOptions, gradesOverride?: GradesInput) => {
        await Promise.allSettled([
            loadProfile(options),
            loadSchedule(options),
            loadGrades(options, gradesOverride),
            loadLessonPlanSubjects(options, gradesOverride)
        ]);
    };

    realtimeHandlerRef.current = (event: EcampusResourceReadyEvent) => {
        // During bootstrap wait, only track the lesson-plan planId and the
        // grades period eCampus actually resolved (A3). All data loading
        // happens in batch when bootstrap-ready fires.
        if (isWaitingForInitialEventsRef.current) {
            if (event.resource === 'lesson-plan' && event.planId) {
                pendingLessonPlanPlanIdRef.current = event.planId;
            }
            if (event.resource === 'grades' && event.year && event.period) {
                pendingGradesPeriodRef.current = { year: event.year, period: event.period };
            }
            return;
        }

        const silentOptions: RequestOptions = { reportError: false, showGlobalLoading: false };

        switch (event.resource) {
            case 'profile':
                void loadProfile(silentOptions);
                return;
            case 'schedule':
                void loadSchedule(silentOptions);
                return;
            case 'grades':
                // Trust the period eCampus actually scraped, not whatever
                // gradesInput currently guesses — they can disagree (e.g.
                // eCampus resolving the previous term because the calendar-
                // guessed one has nothing posted yet).
                if (event.year && event.period) {
                    const resolved = { year: event.year, period: event.period };
                    void loadGrades(silentOptions, resolved);
                    void loadLessonPlanSubjects(silentOptions, resolved);
                }
                return;
            case 'lesson-plan-subjects':
                if (isLoaded('grades') || !isInitialResourcePending('grades')) {
                    void loadLessonPlanSubjects(silentOptions);
                }
                return;
            case 'lesson-plan': {
                const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);
                if (!event.planId || event.planId === selectedSubject?.planId) {
                    void loadLessonPlan(silentOptions);
                    return;
                }

                pendingLessonPlanPlanIdRef.current = event.planId || null;
            }
        }
    };

    realtimeFailureHandlerRef.current = (event: EcampusResourceFailedEvent) => {
        if (event.errorName === 'AuthenticationError') {
            void expireSession(event.message);
            return;
        }

        if (!isWaitingForInitialEventsRef.current) {
            setRawError(event.message || 'Nao foi possivel carregar todos os dados agora.', true);
        }
    };

    realtimeBootstrapReadyHandlerRef.current = () => {
        if (isWaitingForInitialEventsRef.current) {
            void finishInitialScrapingEvents();
        }
    };

    realtimeBootstrapFailedHandlerRef.current = (event: EcampusBootstrapEvent) => {
        if (!isWaitingForInitialEventsRef.current) {
            return;
        }

        isWaitingForInitialEventsRef.current = false;
        clearInitialEventsTimeout();
        setPendingInitialResources(new Set());
        setRawError(event.failedResources.length > 0
            ? `Nao foi possivel carregar: ${event.failedResources.join(', ')}.`
            : 'Nao foi possivel carregar todos os dados agora.', true);
        const gradesOverride = pendingGradesPeriodRef.current ?? undefined;
        pendingGradesPeriodRef.current = null;
        void loadInitialDataFromCache({ reportError: false, showGlobalLoading: false }, gradesOverride);
    };

    const prefetchWorkspace = async (options?: PrefetchOptions) => {
        await runSingle('prefetch', async () => {
            const tasks: Array<Promise<unknown>> = [];
            const resourcesToWaitFor: InitialResourceKey[] = [];
            const taskFactories: Array<() => Promise<unknown>> = [];
            const silentOptions: RequestOptions = {
                reportError: options?.reportError ?? false,
                showGlobalLoading: false
            };

            if (!options?.force) {
                if ((options?.includeProfile ?? true) && !profile && !isInitialResourcePending('profile')) {
                    resourcesToWaitFor.push('profile');
                    taskFactories.push(() => loadProfile(silentOptions));
                }

                if (!isLoaded('schedule') && !isInitialResourcePending('schedule')) {
                    resourcesToWaitFor.push('schedule');
                    taskFactories.push(() => loadSchedule(silentOptions));
                }

                if (!isLoaded('grades') && !isInitialResourcePending('grades')) {
                    resourcesToWaitFor.push('grades');
                    taskFactories.push(() => loadGrades(silentOptions));
                }

                if (!isLoaded('lessonPlanSubjects') && !isInitialResourcePending('lessonPlanSubjects')) {
                    resourcesToWaitFor.push('lessonPlanSubjects', 'lessonPlan');
                    taskFactories.push(() => loadLessonPlanSubjects(silentOptions));
                }

                markInitialResourcesPending(resourcesToWaitFor);
                await Promise.allSettled(taskFactories.map((task) => task()));
                return;
            }

            if ((options?.includeProfile ?? true) && (options.force || (!profile && !isInitialResourcePending('profile')))) {
                resourcesToWaitFor.push('profile');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('profile'), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options.force || (!isLoaded('schedule') && !isInitialResourcePending('schedule'))) {
                resourcesToWaitFor.push('schedule');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('schedule'), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options.force || (!isLoaded('grades') && !isInitialResourcePending('grades'))) {
                resourcesToWaitFor.push('grades');
                tasks.push(run(() => useCases.enqueueScrapeJob.execute('grades', getGradesJobData(gradesInput, currentGradesInput)), {
                    reportError: options?.reportError ?? false,
                    showGlobalLoading: false
                }));
            }

            if (options.force || (!isLoaded('lessonPlanSubjects') && !isInitialResourcePending('lessonPlanSubjects'))) {
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
                    if (!disposed && isWaitingForInitialEventsRef.current && hasRealtimeConnectedRef.current) {
                        void loadInitialDataFromCache({ reportError: false, showGlobalLoading: false });
                    }
                    hasRealtimeConnectedRef.current = true;
                },
                (event) => {
                    if (!disposed) {
                        void expireSession(event?.message);
                    }
                },
                (event) => {
                    if (!disposed) {
                        realtimeFailureHandlerRef.current(event);
                    }
                },
                (event) => {
                    if (!disposed) {
                        realtimeBootstrapReadyHandlerRef.current(event);
                    }
                },
                (event) => {
                    if (!disposed) {
                        realtimeBootstrapFailedHandlerRef.current(event);
                    }
                }
            );
        });

        return () => {
            disposed = true;
            disconnect?.();
        };
    }, [isAuthenticated, useCases]);

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

            const generation = sessionGeneration.current;
            const validated = await run(async () => {
                await useCases.validateAuthSession.execute();
                return true;
            }, {
                reportError: false,
                showGlobalLoading: false,
                sessionGeneration: generation,
                silentSessionExpiry: true
            });

            if (!validated || generation !== sessionGeneration.current || isExpiringSessionRef.current) {
                return;
            }

            setIsAuthenticated(true);
            setIsReady(true);
            await prefetchWorkspace({ force: false });
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
        setIsAuthenticated(true);
        clearError();
        waitForInitialScrapingEvents();
    };

    const logout = async () => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        clearError();

        await runSingle('logout', () => useCases.logout.execute()).catch((caught) => {
            if (caught instanceof Error) {
                setRawError(caught.message);
            } else {
                setTranslatedError('errors.logout');
            }
            return null;
        });
    };

    const sendAiChatMessage = async (input: SendAiChatMessageInput, handlers?: SendAiChatMessageHandlers) => {
        const generation = sessionGeneration.current;
        clearError();

        try {
            return await useCases.sendAiChatMessage.execute(input, handlers);
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

    const createPixCheckout = () => useCases.createPixCheckout.execute();

    const getCheckoutStatus = (paymentId: string) => useCases.getCheckoutStatus.execute(paymentId);

    const getMercadoPagoPublicKey = () => useCases.getMercadoPagoPublicKey.execute();

    const createCardCheckout = (input: Parameters<typeof useCases.createCardCheckout.execute>[0]) => useCases.createCardCheckout.execute(input);

    const getBillingPlan = () => useCases.getBillingPlan.execute();

    const cancelAiChatMessage = async (jobId: string) => {
        try {
            await useCases.cancelAiChatMessage.execute(jobId);
        } catch {
            // Best-effort: if the cancel request itself fails (offline, request
            // already finished), the generation either already completed or will
            // simply finish on its own — nothing else to do from the UI's side.
        }
    };

    const changeLessonPlanSubject = async (code: string) => {
        const generation = sessionGeneration.current;
        const selectedSubject = lessonPlanSubjects.find((subject) => subject.code === code);

        setSelectedLessonPlanSubjectCode(code);
        clearError();

        if (!selectedSubject) {
            setLessonPlan([]);
            return;
        }

        if (selectedSubject.planId === loadedLessonPlanIdRef.current) {
            // Already loaded for this exact subject (e.g. navigating back to a
            // course the user already opened) — the data in `lessonPlan` is
            // already correct, so don't wipe it and don't re-scrape.
            return;
        }

        setLessonPlan([]);

        if (!selectedSubject.planId) {
            // Not every subject has a published teaching plan yet — that's a normal
            // state the course details screen already renders inline, not something
            // that should also raise the workspace-wide error banner.
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
            void prefetchWorkspace();
            return;
        }

        if (tab === 'home') void prefetchWorkspace();
        if (tab === 'profile' && !isLoaded('profile') && !isInitialResourcePending('profile')) {
            markInitialResourcesPending(['profile']);
            void run(() => useCases.enqueueScrapeJob.execute('profile'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'schedule' && !isLoaded('schedule') && !isInitialResourcePending('schedule')) {
            markInitialResourcesPending(['schedule']);
            void run(() => useCases.enqueueScrapeJob.execute('schedule'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'grades' && !isLoaded('grades') && !isInitialResourcePending('grades')) {
            markInitialResourcesPending(['grades']);
            void run(() => useCases.enqueueScrapeJob.execute('grades', getGradesJobData(gradesInput, currentGradesInput)), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && !isLoaded('grades') && !isInitialResourcePending('grades')) {
            markInitialResourcesPending(['grades']);
            void run(() => useCases.enqueueScrapeJob.execute('grades', getGradesJobData(gradesInput, currentGradesInput)), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && !isLoaded('lessonPlanSubjects') && !isInitialResourcePending('lessonPlanSubjects')) {
            markInitialResourcesPending(['lessonPlanSubjects', 'lessonPlan']);
            void run(() => useCases.enqueueScrapeJob.execute('lesson-plan-subjects'), { reportError: false, showGlobalLoading: false });
        }
        if (tab === 'lessonPlan' && isLoaded('lessonPlanSubjects') && !isLoaded('lessonPlan') && !isInitialResourcePending('lessonPlan')) {
            const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);
            if (selectedSubject?.planId) {
                markInitialResourcesPending(['lessonPlan']);
                void enqueueLessonPlanScrape(selectedSubject.planId, { reportError: false, showGlobalLoading: false });
            }
        }
        // AI tab doesn't require data loading
    };

    return {
        changeLessonPlanSubject,
        changeGradesInputAndLoad,
        currentGradesInput,
        error,
        isErrorRetryable,
        grades,
        gradesInput,
        isAuthenticated,
        isInitialDataLoading,
        isLoading,
        aiChatConversationId,
        aiChatMessages,
        cancelAiChatMessage,
        createCardCheckout,
        createPixCheckout,
        getBillingPlan,
        getCheckoutStatus,
        getMercadoPagoPublicKey,
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
        setAiChatConversationId,
        setAiChatMessages,
        setGradesInput
    };
}
