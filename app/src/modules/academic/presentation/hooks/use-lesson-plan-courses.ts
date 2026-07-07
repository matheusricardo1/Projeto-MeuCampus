import { useMemo } from 'react';
import type { Translate } from '@/shared/i18n/languages';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';

export type CourseCard = {
    absences: string;
    available: boolean;
    classIdentifier: string;
    code: string;
    credits: number | null;
    evaluations: string;
    evaluationItems: Array<{ score: string; weight: string }>;
    exerciseAverage: string;
    finalExam: string;
    finalGrade: string;
    attendance: Workspace['grades'][number]['attendance'] | null;
    planItems: Workspace['lessonPlan'];
    professor: string;
    scheduleItems: Workspace['schedule'];
    status: string;
    subject: string;
    workloadHours: number | null;
};

type AttendanceSummary = Workspace['grades'][number]['attendance'];

export function useLessonPlanCourses({ grades, items, schedule, selectedSubjectCode, subjects, t }: {
    grades: Workspace['grades'];
    items: Workspace['lessonPlan'];
    schedule: Workspace['schedule'];
    selectedSubjectCode: string;
    subjects: Workspace['lessonPlanSubjects'];
    t: Translate;
}): CourseCard[] {
    return useMemo(() => {
        const byCode = new Map<string, CourseCard>();

        for (const grade of grades) {
            byCode.set(grade.code, {
                absences: grade.absences,
                available: true,
                classIdentifier: grade.class_identifier,
                code: grade.code,
                credits: null,
                evaluations: grade.evaluations.map((evaluation) => `${evaluation.weight}: ${evaluation.score}`).join(' | '),
                evaluationItems: grade.evaluations,
                exerciseAverage: grade.exercise_average,
                finalExam: grade.final_exam,
                finalGrade: grade.final_grade,
                attendance: grade.attendance,
                planItems: grade.code === selectedSubjectCode ? items : [],
                professor: '',
                scheduleItems: schedule.filter((item) => item.code === grade.code || item.class_identifier === grade.class_identifier),
                status: grade.status || t('lesson.inProgress'),
                subject: grade.subject,
                workloadHours: grade.attendance?.workload_hours ?? null
            });
        }

        for (const subject of subjects) {
            const backendGrade = subject.grade ?? null;
            const current = byCode.get(subject.code);
            const grade = current ?? (backendGrade ? {
                absences: backendGrade.absences,
                available: true,
                classIdentifier: backendGrade.class_identifier,
                code: backendGrade.code,
                credits: null,
                evaluations: backendGrade.evaluations.map((evaluation) => `${evaluation.weight}: ${evaluation.score}`).join(' | '),
                evaluationItems: backendGrade.evaluations,
                exerciseAverage: backendGrade.exercise_average,
                finalExam: backendGrade.final_exam,
                finalGrade: backendGrade.final_grade,
                attendance: backendGrade.attendance,
                planItems: backendGrade.code === selectedSubjectCode ? items : [],
                professor: '',
                scheduleItems: [],
                status: backendGrade.status || t('lesson.inProgress'),
                subject: backendGrade.subject,
                workloadHours: backendGrade.attendance?.workload_hours ?? null
            } : null);
            const attendance = buildAttendanceSummary(
                grade?.attendance ?? null,
                subject.workloadHours ?? grade?.workloadHours ?? null,
                grade?.absences || '0'
            );
            const backendScheduleItems = subject.scheduleItems ?? [];

            byCode.set(subject.code, {
                absences: grade?.absences || '0',
                available: subject.available,
                classIdentifier: grade?.classIdentifier || subject.classIdentifier,
                code: subject.code,
                credits: subject.credits,
                evaluations: grade?.evaluations || '',
                evaluationItems: grade?.evaluationItems || [],
                exerciseAverage: grade?.exerciseAverage || '',
                finalExam: grade?.finalExam || '',
                finalGrade: grade?.finalGrade || '',
                attendance,
                planItems: subject.code === selectedSubjectCode ? items : [],
                professor: subject.professor,
                scheduleItems: backendScheduleItems.length > 0
                    ? backendScheduleItems
                    : schedule.filter((item) => item.code === subject.code || item.class_identifier === subject.classIdentifier),
                status: grade?.status || (subject.available ? t('lesson.planAvailable') : t('lesson.planUnavailable')),
                subject: grade?.subject || subject.subject,
                workloadHours: subject.workloadHours ?? grade?.workloadHours ?? null
            });
        }

        return Array.from(byCode.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    }, [grades, items, schedule, selectedSubjectCode, subjects, t]);
}

function buildAttendanceSummary(
    currentAttendance: AttendanceSummary | null,
    workloadHours: number | null,
    absences: string
): AttendanceSummary | null {
    if (currentAttendance && currentAttendance.source === 'computed') {
        return currentAttendance;
    }

    if (!workloadHours || workloadHours <= 0) {
        return currentAttendance;
    }

    const absencesHours = parseHours(absences);
    const maxAbsencesAllowed = Math.floor(workloadHours * 0.25);
    const minimumPresenceHours = workloadHours - maxAbsencesAllowed;
    const presenceHours = Math.max(workloadHours - absencesHours, 0);

    return {
        workload_hours: workloadHours,
        absences_hours: absencesHours,
        max_absences_allowed: maxAbsencesAllowed,
        minimum_presence_hours: minimumPresenceHours,
        presence_hours: presenceHours,
        presence_percent: Math.max(0, Math.min(100, Math.round((presenceHours / workloadHours) * 100))),
        is_absence_risk: absencesHours > maxAbsencesAllowed,
        source: 'computed'
    };
}

function parseHours(value: string): number {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
}
