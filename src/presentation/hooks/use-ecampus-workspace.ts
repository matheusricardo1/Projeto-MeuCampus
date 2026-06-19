'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { AuthSessionExpiredError } from '@/domain/errors/auth-session-expired.error';
import { createEcampusUseCases } from '@/presentation/composition/create-ecampus-use-cases';

type WorkspaceTab = 'home' | 'profile' | 'schedule' | 'grades' | 'lessonPlan';

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

type ResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan' | 'prefetch' | 'restore' | 'login' | 'logout';

const DEFAULT_REQUEST_OPTIONS: Required<Pick<RequestOptions, 'reportError' | 'showGlobalLoading'>> = {
    reportError: true,
    showGlobalLoading: true
};

export function useEcampusWorkspace() {
    const useCases = useMemo(() => createEcampusUseCases(), []);
    const sessionGeneration = useRef(0);
    const inFlightRequests = useRef(new Map<ResourceKey, Promise<unknown>>());
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loadingRequests, setLoadingRequests] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [schedule, setSchedule] = useState<ScheduleClass[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanItem[]>([]);
    const [lessonPlanSubjects, setLessonPlanSubjects] = useState<LessonPlanSubject[]>([]);
    const [selectedLessonPlanSubjectCode, setSelectedLessonPlanSubjectCode] = useState('');
    const [gradesInput, setGradesInput] = useState<GradesInput>({ year: new Date().getFullYear().toString(), period: '1' });

    const isLoading = loadingRequests > 0;

    const clearWorkspaceData = useCallback(() => {
        setProfile(null);
        setSchedule([]);
        setGrades([]);
        setLessonPlan([]);
        setLessonPlanSubjects([]);
        setSelectedLessonPlanSubjectCode('');
    }, []);

    const startNewSessionGeneration = useCallback(() => {
        sessionGeneration.current += 1;
        inFlightRequests.current.clear();
        return sessionGeneration.current;
    }, []);

    const expireSession = useCallback((message = 'Sua sessao expirou. Entre novamente.') => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        setActiveTab('home');
        setError(message);
        useCases.clearAuthSession.execute();
    }, [clearWorkspaceData, startNewSessionGeneration, useCases]);

    const runSingle = useCallback(async <T,>(key: ResourceKey, task: () => Promise<T>): Promise<T | null> => {
        const current = inFlightRequests.current.get(key) as Promise<T> | undefined;
        if (current) return current;

        const request = task().finally(() => {
            if (inFlightRequests.current.get(key) === request) {
                inFlightRequests.current.delete(key);
            }
        });

        inFlightRequests.current.set(key, request);
        return request;
    }, []);

    const run = useCallback(async <T,>(task: () => Promise<T>, options: RequestOptions = {}): Promise<T | null> => {
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
                    expireSession(caught.message);
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
    }, [expireSession]);

    const loadProfile = useCallback(async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('profile', () => run(() => useCases.getStudentProfile.execute(), { ...options, sessionGeneration: generation }));
        if (data && generation === sessionGeneration.current) {
            setProfile(data);
            setIsAuthenticated(true);
        }
    }, [run, runSingle, useCases]);

    const loadSchedule = useCallback(async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('schedule', () => run(() => useCases.getSchedule.execute(), { ...options, sessionGeneration: generation }));
        if (data && generation === sessionGeneration.current) setSchedule(data);
    }, [run, runSingle, useCases]);

    const loadGrades = useCallback(async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('grades', () => run(() => useCases.getGrades.execute(gradesInput.year, gradesInput.period), { ...options, sessionGeneration: generation }));
        if (data && generation === sessionGeneration.current) setGrades(data);
    }, [gradesInput.period, gradesInput.year, run, runSingle, useCases]);

    const pickLessonPlanSubject = useCallback((subjects: LessonPlanSubject[], currentCode: string) => {
        return subjects.find((subject) => subject.code === currentCode) || subjects.find((subject) => subject.available) || subjects[0] || null;
    }, []);

    const loadLessonPlanSubjects = useCallback(async (options?: RequestOptions) => {
        const generation = sessionGeneration.current;
        const data = await runSingle('lessonPlanSubjects', () => run(async () => {
            const subjects = await useCases.getLessonPlanSubjects.execute();
            const selectedSubject = pickLessonPlanSubject(subjects, selectedLessonPlanSubjectCode);
            const items = selectedSubject?.planId ? await useCases.getLessonPlan.execute(selectedSubject.planId) : [];

            return {
                items,
                selectedCode: selectedSubject?.code || '',
                subjects
            };
        }, { ...options, sessionGeneration: generation }));

        if (!data || generation !== sessionGeneration.current) return;
        setLessonPlanSubjects(data.subjects);
        setSelectedLessonPlanSubjectCode(data.selectedCode);
        setLessonPlan(data.items);
    }, [pickLessonPlanSubject, run, runSingle, selectedLessonPlanSubjectCode, useCases]);

    const prefetchWorkspace = useCallback(async (options?: PrefetchOptions) => {
        const backgroundOptions: RequestOptions = {
            reportError: false,
            showGlobalLoading: true,
            ...options
        };

        await runSingle('prefetch', async () => {
            const tasks: Array<Promise<void>> = [];

            if ((options?.includeProfile ?? true) && (options?.force || !profile)) tasks.push(loadProfile(backgroundOptions));
            if (options?.force || schedule.length === 0) tasks.push(loadSchedule(backgroundOptions));
            if (options?.force || grades.length === 0) tasks.push(loadGrades(backgroundOptions));
            if (options?.force || lessonPlanSubjects.length === 0) tasks.push(loadLessonPlanSubjects(backgroundOptions));

            await Promise.allSettled(tasks);
        });
    }, [grades.length, lessonPlanSubjects.length, loadGrades, loadLessonPlanSubjects, loadProfile, loadSchedule, profile, runSingle, schedule.length]);

    const refreshDashboard = useCallback(async () => {
        await prefetchWorkspace({
            force: true,
            reportError: true,
            showGlobalLoading: true
        });
    }, [prefetchWorkspace]);

    const restoreSession = useCallback(async () => {
        const session = useCases.getAuthSession.execute();
        if (!session) return;

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
            expireSession();
            return;
        }

        setProfile(data);
        setIsAuthenticated(true);
        void prefetchWorkspace({ includeProfile: false });
    }, [clearWorkspaceData, expireSession, prefetchWorkspace, run, runSingle, startNewSessionGeneration, useCases]);

    const login = useCallback(async (input: LoginInput) => {
        const session = await runSingle('login', () => run(() => useCases.login.execute(input)));
        if (!session) return;
        startNewSessionGeneration();
        clearWorkspaceData();
        setActiveTab('home');
        setIsAuthenticated(true);
        void prefetchWorkspace({ force: true });
    }, [clearWorkspaceData, prefetchWorkspace, run, runSingle, startNewSessionGeneration, useCases]);

    const logout = useCallback(async () => {
        startNewSessionGeneration();
        setIsAuthenticated(false);
        clearWorkspaceData();
        setError(null);
        setActiveTab('home');

        await runSingle('logout', () => useCases.logout.execute()).catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel encerrar a sessao no eCampus.');
        });
    }, [clearWorkspaceData, runSingle, startNewSessionGeneration, useCases]);

    const loadLessonPlan = useCallback(async (options?: RequestOptions) => {
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

        const data = await runSingle('lessonPlan', () => run(() => useCases.getLessonPlan.execute(selectedSubject.planId!), { ...options, sessionGeneration: generation }));
        if (data && generation === sessionGeneration.current) setLessonPlan(data);
    }, [lessonPlanSubjects, pickLessonPlanSubject, run, runSingle, selectedLessonPlanSubjectCode, useCases]);

    const changeLessonPlanSubject = useCallback((code: string) => {
        setSelectedLessonPlanSubjectCode(code);
        setLessonPlan([]);
        setError(null);
    }, []);

    const openTab = useCallback((tab: WorkspaceTab) => {
        setActiveTab(tab);

        if (tab === 'home') void prefetchWorkspace();
        if (tab === 'profile' && !profile) void loadProfile({ reportError: false, showGlobalLoading: true });
        if (tab === 'schedule' && schedule.length === 0) void loadSchedule({ reportError: false, showGlobalLoading: true });
        if (tab === 'grades' && grades.length === 0) void loadGrades({ reportError: false, showGlobalLoading: true });
        if (tab === 'lessonPlan' && lessonPlanSubjects.length === 0) void loadLessonPlanSubjects({ reportError: false, showGlobalLoading: true });
    }, [grades.length, lessonPlanSubjects.length, loadGrades, loadLessonPlanSubjects, loadProfile, loadSchedule, prefetchWorkspace, profile, schedule.length]);

    return {
        activeTab,
        error,
        grades,
        gradesInput,
        isAuthenticated,
        isLoading,
        lessonPlan,
        lessonPlanSubjects,
        profile,
        schedule,
        selectedLessonPlanSubjectCode,
        changeLessonPlanSubject,
        loadGrades,
        loadLessonPlan,
        loadLessonPlanSubjects,
        loadProfile,
        loadSchedule,
        login,
        logout,
        openTab,
        refreshDashboard,
        restoreSession,
        setActiveTab,
        setGradesInput
    };
}
