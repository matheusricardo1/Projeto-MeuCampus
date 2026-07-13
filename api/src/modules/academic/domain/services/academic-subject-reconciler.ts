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
        const found = getSubjectByIdentity(subjects, subject.code, subject.classIdentifier, subject.subject);
        const current = found?.value;
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
        }, found?.key);
    }

    for (const scheduleItem of schedule) {
        const found = getSubjectByIdentity(subjects, scheduleItem.code, scheduleItem.class_identifier, scheduleItem.subject);
        const current = found?.value;
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
        }, found?.key);
    }

    return Array.from(subjects.values())
        .map((subject) => ({
            ...subject,
            attendance: buildAttendanceSummary(subject.attendance, subject.workloadHours, subject.grade?.absences ?? '0')
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
}

// `existingKey` is the map key the matched subject is currently stored
// under, which can differ from the key the merged record would naturally
// get (e.g. a lesson-plan row resolved to an existing grade by subject name
// alone, because its own code differs from the grade's code). Without
// removing that stale key, the merged record would be inserted under a
// second key instead of replacing the original — producing two cards for
// what is really one subject.
function upsertSubject(subjects: Map<string, AcademicSubject>, preferredCode: string, subject: AcademicSubject, existingKey?: string): void {
    const key = subjectIdentityKey(preferredCode, subject.classIdentifier, subject.subject);
    if (existingKey && existingKey !== key) {
        subjects.delete(existingKey);
    }
    subjects.set(key, subject);
}

function getSubjectByIdentity(
    subjects: Map<string, AcademicSubject>,
    code: string,
    classIdentifier: string,
    subject: string
): { key: string; value: AcademicSubject } | undefined {
    const directKey = subjectIdentityKey(code, classIdentifier, subject);
    const direct = subjects.get(directKey);
    if (direct) return { key: directKey, value: direct };

    for (const [key, value] of subjects.entries()) {
        if (isSameSubject(value, code, classIdentifier, subject)) {
            return { key, value };
        }
    }

    return undefined;
}
