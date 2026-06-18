'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';
import { createEcampusUseCases } from '@/presentation/composition/create-ecampus-use-cases';

type WorkspaceTab = 'profile' | 'schedule' | 'grades' | 'lessonPlan';

interface LoginInput {
    user: string;
    password: string;
}

interface GradesInput {
    year: string;
    period: string;
}

export function useEcampusWorkspace() {
    const useCases = useMemo(() => createEcampusUseCases(), []);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('profile');
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [schedule, setSchedule] = useState<ScheduleClass[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [lessonPlan, setLessonPlan] = useState<LessonPlanItem[]>([]);
    const [lessonPlanSubjects, setLessonPlanSubjects] = useState<LessonPlanSubject[]>([]);
    const [selectedLessonPlanSubjectCode, setSelectedLessonPlanSubjectCode] = useState('');
    const [gradesInput, setGradesInput] = useState<GradesInput>({ year: new Date().getFullYear().toString(), period: '1' });

    const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | null> => {
        setIsLoading(true);
        setError(null);

        try {
            return await task();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel completar a operacao.');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadProfile = useCallback(async () => {
        const data = await run(() => useCases.getStudentProfile.execute());
        if (data) {
            setProfile(data);
            setIsAuthenticated(true);
        }
    }, [run, useCases]);

    const restoreSession = useCallback(async () => {
        const session = useCases.getAuthSession.execute();
        if (!session) return;
        setIsAuthenticated(true);
        await loadProfile();
    }, [loadProfile, useCases]);

    const login = useCallback(async (input: LoginInput) => {
        const session = await run(() => useCases.login.execute(input));
        if (!session) return;
        setIsAuthenticated(true);
        await loadProfile();
    }, [loadProfile, run, useCases]);

    const logout = useCallback(async () => {
        await useCases.logout.execute().catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel encerrar a sessao no eCampus.');
        });
        setIsAuthenticated(false);
        setProfile(null);
        setSchedule([]);
        setGrades([]);
        setLessonPlan([]);
        setLessonPlanSubjects([]);
        setSelectedLessonPlanSubjectCode('');
        setError(null);
        setActiveTab('profile');
    }, [useCases]);

    const loadSchedule = useCallback(async () => {
        const data = await run(() => useCases.getSchedule.execute());
        if (data) setSchedule(data);
    }, [run, useCases]);

    const loadGrades = useCallback(async () => {
        const data = await run(() => useCases.getGrades.execute(gradesInput.year, gradesInput.period));
        if (data) setGrades(data);
    }, [gradesInput.period, gradesInput.year, run, useCases]);

    const pickLessonPlanSubject = useCallback((subjects: LessonPlanSubject[], currentCode: string) => {
        return subjects.find((subject) => subject.code === currentCode) || subjects.find((subject) => subject.available) || subjects[0] || null;
    }, []);

    const loadLessonPlanSubjects = useCallback(async () => {
        const data = await run(async () => {
            const subjects = await useCases.getLessonPlanSubjects.execute();
            const selectedSubject = pickLessonPlanSubject(subjects, selectedLessonPlanSubjectCode);
            const items = selectedSubject?.planId ? await useCases.getLessonPlan.execute(selectedSubject.planId) : [];

            return {
                items,
                selectedCode: selectedSubject?.code || '',
                subjects
            };
        });

        if (!data) return;
        setLessonPlanSubjects(data.subjects);
        setSelectedLessonPlanSubjectCode(data.selectedCode);
        setLessonPlan(data.items);
    }, [pickLessonPlanSubject, run, selectedLessonPlanSubjectCode, useCases]);

    const loadLessonPlan = useCallback(async () => {
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

        const data = await run(() => useCases.getLessonPlan.execute(selectedSubject.planId!));
        if (data) setLessonPlan(data);
    }, [lessonPlanSubjects, pickLessonPlanSubject, run, selectedLessonPlanSubjectCode, useCases]);

    const changeLessonPlanSubject = useCallback((code: string) => {
        setSelectedLessonPlanSubjectCode(code);
        setLessonPlan([]);
        setError(null);
    }, []);

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
        restoreSession,
        setActiveTab,
        setGradesInput
    };
}
