import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { Grade } from '@academic/domain/entities/grade.entity';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';
import { isSameSubject, subjectIdentityKey } from '@academic/domain/services/academic-subject-identity';
import { buildAttendanceSummary } from '@academic/domain/services/academic-attendance-policy';

export interface AcademicSubjectSources {
    grades?: Grade[];
    lessonPlanSubjects?: LessonPlanSubject[];
    schedule?: ScheduleClass[];
}

/**
 * Domain policy for reconciling the same academic subject across three
 * independent eCampus resources (grades, lesson plan, schedule), which may
 * disagree or partially overlap. Callers must pass already-parsed, typed
 * data — this never touches raw/unknown input.
 */
export function reconcileAcademicSubjects(sources: AcademicSubjectSources): AcademicSubject[] {
    const subjects = new Map<string, AcademicSubject>();
    const grades = sources.grades ?? [];
    const lessonPlanSubjects = sources.lessonPlanSubjects ?? [];
    const schedule = sources.schedule ?? [];

    for (const grade of grades) {
        upsertSubject(subjects, grade.code, {
            available: true,
            code: grade.code,
            subject: grade.subject,
            classIdentifier: grade.class_identifier,
            credits: null,
            professor: '',
            workloadHours: grade.attendance?.workload_hours ?? null,
            planId: null,
            grade,
            attendance: grade.attendance,
            scheduleItems: []
        });
    }

    for (const subject of lessonPlanSubjects) {
        const current = getSubjectByIdentity(subjects, subject.code, subject.classIdentifier, subject.subject);
        upsertSubject(subjects, subject.code, {
            ...current,
            available: subject.available,
            code: subject.code || current?.code || '',
            subject: subject.subject || current?.subject || '',
            classIdentifier: current?.classIdentifier || subject.classIdentifier,
            credits: subject.credits,
            professor: subject.professor,
            workloadHours: subject.workloadHours ?? current?.workloadHours ?? null,
            planId: subject.planId,
            grade: current?.grade ?? null,
            attendance: current?.attendance ?? null,
            scheduleItems: current?.scheduleItems ?? []
        });
    }

    for (const scheduleItem of schedule) {
        const current = getSubjectByIdentity(subjects, scheduleItem.code, scheduleItem.class_identifier, scheduleItem.subject);
        upsertSubject(subjects, scheduleItem.code, {
            ...current,
            available: current?.available ?? false,
            code: scheduleItem.code || current?.code || '',
            subject: current?.subject || scheduleItem.subject,
            classIdentifier: current?.classIdentifier || scheduleItem.class_identifier,
            credits: current?.credits ?? null,
            professor: current?.professor ?? '',
            workloadHours: current?.workloadHours ?? null,
            planId: current?.planId ?? null,
            grade: current?.grade ?? null,
            attendance: current?.attendance ?? null,
            scheduleItems: [...(current?.scheduleItems ?? []), scheduleItem]
        });
    }

    return Array.from(subjects.values())
        .map((subject) => ({
            ...subject,
            attendance: buildAttendanceSummary(subject.attendance, subject.workloadHours, subject.grade?.absences ?? '0')
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
}

function upsertSubject(subjects: Map<string, AcademicSubject>, preferredCode: string, subject: AcademicSubject): void {
    subjects.set(subjectIdentityKey(preferredCode, subject.classIdentifier, subject.subject), subject);
}

function getSubjectByIdentity(
    subjects: Map<string, AcademicSubject>,
    code: string,
    classIdentifier: string,
    subject: string
): AcademicSubject | undefined {
    return subjects.get(subjectIdentityKey(code, classIdentifier, subject))
        ?? Array.from(subjects.values()).find((item) => isSameSubject(item, code, classIdentifier, subject));
}
