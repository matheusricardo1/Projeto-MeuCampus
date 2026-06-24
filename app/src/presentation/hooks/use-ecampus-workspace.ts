import { useMemo, useRef, useState } from 'react';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import { createEcampusUseCases } from '@/presentation/composition/create-ecampus-use-cases';

type WorkspaceTab = 'home' | 'profile' | 'schedule' | 'grades' | 'lessonPlan';
type ResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan' | 'prefetch' | 'restore' | 'login' | 'logout';

interface LoginInput {
    user: string;
    password: string;
}

interface GradesInput {
    year: string;
    period: string;
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

const DEFAULT_REQUEST_OPTIONS: Required<Pick<RequestOptions, 'reportError' | 'showGlobalLoading'>> = {
    reportError: true,
    showGlobalLoading: true
};

function getCurrentGradesInput(): GradesInput {
    const now = new Date();
    return {
        year: now.getFullYear().toString(),
        period: now.getMonth() >= 6 ? '2' : '1'
    };
}

export function useEcampusWorkspace() {
    const useCases = useMemo(() => createEcampusUseCases(), []);
    const currentGradesInput = useMemo(() => getCurrentGradesInput(), []);
    const sessionGeneration = useRef(0);
    const inFlightRequests = useRef(new Map<ResourceKey, Promise<unknown>>());
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [schedule, setSchedule] = useState<ScheduleClass[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanItem[]>([]);
    const [lessonPlanSubjects, setLessonPlanSubjects] = useState<LessonPlanSubject[]>([]);
    const [selectedLessonPlanSubjectCode, setSelectedLessonPlanSubjectCode] = useState('');
    const [gradesInput, setGradesInput] = useState<GradesInput>(currentGradesInput);

    const isLoading = loadingRequests > 0;

    const clearWorkspaceData = () => {
        setProfile(null);
        setSchedule([]);
        setGrades([]);
        setLessonPlan([]);
        setLessonPlanSubjects([]);
        setSelectedLessonPlanSubjectCode('');
    };

    const startNewSessionGeneration = () => {
        sessionGeneration.current += 1;
        inFlightRequests.current.clear();
        setLoadingRequests(0);
        return sessionGeneration.current;
    };

    const expireSession = async (message = 'Sua sessao expirou. Entre novamente.') => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        setActiveTab('home');
        setError(message);
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
            setError(null);
        }

        try {
            return await task();
        } catch (caught) {
            if (caught instanceof AuthSessionExpiredError) {
                if (requestOptions.sessionGeneration === undefined || requestOptions.sessionGeneration === sessionGeneration.current) {
                    await expireSession(caught.message);
                }

                return null;
            }

            if (requestOptions.reportError) {
                setError(caught instanceof Error ? caught.message : 'Nao foi possivel completar a operacao.');
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
        const data = await runSingle('lessonPlanSubjects', () => run(async () => {
            const subjects = await useCases.getLessonPlanSubjects.execute();
            const selectedSubject = pickLessonPlanSubject(subjects, selectedLessonPlanSubjectCode);
            const items = selectedSubject?.planId
                ? await useCases.getLessonPlan.execute(selectedSubject.planId)
                : [];

            return {
                items,
                selectedCode: selectedSubject?.code || '',
                subjects
            };
        }, {
            ...options,
            sessionGeneration: generation
        }));

        if (!data || generation !== sessionGeneration.current) {
            return;
        }

        setLessonPlanSubjects(data.subjects);
        setSelectedLessonPlanSubjectCode(data.selectedCode);
        setLessonPlan(data.items);
    };

    const loadLessonPlan = async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const selectedSubject = pickLessonPlanSubject(lessonPlanSubjects, selectedLessonPlanSubjectCode);

        if (!selectedSubject) {
            setError('Carregue suas materias antes de buscar o plano de ensino.');
            return;
        }

        setSelectedLessonPlanSubjectCode(selectedSubject.code);

        if (!selectedSubject.planId) {
            setLessonPlan([]);
            setError(`Plano de ensino ainda nao disponivel para ${selectedSubject.code} - ${selectedSubject.subject}.`);
            return;
        }

        const data = await runSingle('lessonPlan', () => run(() => useCases.getLessonPlan.execute(selectedSubject.planId!), {
            ...options,
            sessionGeneration: generation
        }));

        if (data && generation === sessionGeneration.current) {
            setLessonPlan(data);
        }
    };

    const prefetchWorkspace = async (options?: PrefetchOptions) => {
        const backgroundOptions: RequestOptions = {
            reportError: false,
            showGlobalLoading: true,
            ...options
        };

        await runSingle('prefetch', async () => {
            const tasks: Array<Promise<void>> = [];

            if ((options?.includeProfile ?? true) && (options?.force || !profile)) {
                tasks.push(loadProfile(backgroundOptions));
            }

            if (options?.force || schedule.length === 0) {
                tasks.push(loadSchedule(backgroundOptions));
            }

            if (options?.force || grades.length === 0) {
                tasks.push(loadGrades(backgroundOptions));
            }

            if (options?.force || lessonPlanSubjects.length === 0) {
                tasks.push(loadLessonPlanSubjects(backgroundOptions));
            }

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
            setError(null);
            setActiveTab('home');

            const generation = sessionGeneration.current;
            const data = await runSingle('restore', () => run(() => useCases.getStudentProfile.execute(), {
                reportError: false,
                showGlobalLoading: true,
                sessionGeneration: generation
            }));

            if (!data || generation !== sessionGeneration.current) {
                await expireSession();
                setIsReady(true);
                return;
            }

            setProfile(data);
            setIsAuthenticated(true);
            void prefetchWorkspace({ includeProfile: false });
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
        setError(null);
        void prefetchWorkspace({ force: true });
    };

    const logout = async () => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        setError(null);
        setActiveTab('home');

        await runSingle('logout', () => useCases.logout.execute()).catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel encerrar a sessao no eCampus.');
            return null;
        });
    };

    const changeLessonPlanSubject = (code: string) => {
        setSelectedLessonPlanSubjectCode(code);
        setLessonPlan([]);
        setError(null);
    };

    const openTab = (tab: WorkspaceTab) => {
        setActiveTab(tab);

        if (tab === 'home') void prefetchWorkspace();
        if (tab === 'profile' && !profile) void loadProfile({ reportError: false, showGlobalLoading: true });
        if (tab === 'schedule' && schedule.length === 0) void loadSchedule({ reportError: false, showGlobalLoading: true });
        if (tab === 'grades' && grades.length === 0) void loadGrades({ reportError: false, showGlobalLoading: true });
        if (tab === 'lessonPlan' && grades.length === 0) void loadGrades({ reportError: false, showGlobalLoading: true });
        if (tab === 'lessonPlan' && lessonPlanSubjects.length === 0) void loadLessonPlanSubjects({ reportError: false, showGlobalLoading: true });
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
        setGradesInput
    };
}
