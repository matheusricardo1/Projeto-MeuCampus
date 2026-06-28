import type { AcademicSubject } from '@academic/domain/entities/academic-subject.entity';
import type { AttendanceSummary, Grade, GradeEvaluation } from '@academic/domain/entities/grade.entity';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';

type UnknownRecord = Record<string, unknown>;

export function normalizeAcademicSubjects(input: {
    grades?: unknown;
    lessonPlanSubjects?: unknown;
    schedule?: unknown;
}): AcademicSubject[] {
    const subjects = new Map<string, AcademicSubject>();
    const grades = normalizeGrades(input.grades, input.lessonPlanSubjects);
    const lessonPlanSubjects = normalizeLessonPlanSubjects(input.lessonPlanSubjects);
    const schedule = normalizeSchedule(input.schedule);

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

export function normalizeGrades(raw: unknown, lessonPlanSubjects?: unknown): Grade[] {
    const subjects = normalizeLessonPlanSubjects(lessonPlanSubjects);
    return toArray(raw).map((item) => {
        const record = toRecord(item);
        const code = readString(record, 'code');
        const classIdentifier = readString(record, 'class_identifier') || readString(record, 'classIdentifier');
        const subject = readString(record, 'subject');
        const matchingSubject = findLessonPlanSubject(subjects, code, classIdentifier, subject);
        const attendance = normalizeAttendance(record.attendance);
        const workloadHours = attendance?.workload_hours ?? matchingSubject?.workloadHours ?? null;

        return {
            code,
            subject: subject || matchingSubject?.subject || '',
            class_identifier: classIdentifier || matchingSubject?.classIdentifier || '',
            evaluations: normalizeEvaluations(record.evaluations),
            exercise_average: readString(record, 'exercise_average') || readString(record, 'exerciseAverage'),
            final_exam: readString(record, 'final_exam') || readString(record, 'finalExam'),
            final_grade: readString(record, 'final_grade') || readString(record, 'finalGrade'),
            absences: readString(record, 'absences'),
            attendance: buildAttendanceSummary(attendance, workloadHours, readString(record, 'absences')),
            status: readString(record, 'status')
        };
    });
}

export function normalizeLessonPlanSubjects(raw: unknown): LessonPlanSubject[] {
    return toArray(raw).map((item) => {
        const record = toRecord(item);
        return {
            planId: readNullableString(record, 'planId'),
            code: readString(record, 'code'),
            subject: readString(record, 'subject'),
            classIdentifier: readString(record, 'classIdentifier') || readString(record, 'class_identifier'),
            credits: readNullableNumber(record, 'credits'),
            professor: readString(record, 'professor'),
            workloadHours: readNullableNumber(record, 'workloadHours') ?? readNullableNumber(record, 'workload_hours'),
            available: readBoolean(record, 'available')
        };
    });
}

export function normalizeSchedule(raw: unknown): ScheduleClass[] {
    return toArray(raw).map((item) => {
        const record = toRecord(item);
        return {
            weekday: readString(record, 'weekday'),
            start_time: readString(record, 'start_time') || readString(record, 'startTime'),
            end_time: readString(record, 'end_time') || readString(record, 'endTime'),
            code: readString(record, 'code'),
            subject: readString(record, 'subject'),
            class_identifier: readString(record, 'class_identifier') || readString(record, 'classIdentifier')
        };
    });
}

function upsertSubject(subjects: Map<string, AcademicSubject>, preferredCode: string, subject: AcademicSubject): void {
    subjects.set(subjectKey(preferredCode, subject.classIdentifier, subject.subject), subject);
}

function getSubjectByIdentity(subjects: Map<string, AcademicSubject>, code: string, classIdentifier: string, subject: string): AcademicSubject | undefined {
    return subjects.get(subjectKey(code, classIdentifier, subject))
        ?? Array.from(subjects.values()).find((item) => sameSubject(item, code, classIdentifier, subject));
}

function findLessonPlanSubject(subjects: LessonPlanSubject[], code: string, classIdentifier: string, subject: string): LessonPlanSubject | undefined {
    return subjects.find((item) => sameSubject(item, code, classIdentifier, subject));
}

function sameSubject(item: { code: string; classIdentifier?: string; class_identifier?: string; subject: string }, code: string, classIdentifier: string, subject: string): boolean {
    const itemClassIdentifier = item.classIdentifier ?? item.class_identifier ?? '';
    return Boolean((code && item.code === code) || (classIdentifier && itemClassIdentifier === classIdentifier) || (subject && normalizeText(item.subject) === normalizeText(subject)));
}

function subjectKey(code: string, classIdentifier: string, subject: string): string {
    return normalizeText(code || classIdentifier || subject);
}

function normalizeAttendance(raw: unknown): AttendanceSummary | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as UnknownRecord;
    return {
        workload_hours: readNullableNumber(record, 'workload_hours') ?? readNullableNumber(record, 'workloadHours'),
        absences_hours: readNumber(record, 'absences_hours') || readNumber(record, 'absencesHours'),
        max_absences_allowed: readNullableNumber(record, 'max_absences_allowed') ?? readNullableNumber(record, 'maxAbsencesAllowed'),
        minimum_presence_hours: readNullableNumber(record, 'minimum_presence_hours') ?? readNullableNumber(record, 'minimumPresenceHours'),
        presence_hours: readNullableNumber(record, 'presence_hours') ?? readNullableNumber(record, 'presenceHours'),
        presence_percent: readNullableNumber(record, 'presence_percent') ?? readNullableNumber(record, 'presencePercent'),
        is_absence_risk: readNullableBoolean(record, 'is_absence_risk') ?? readNullableBoolean(record, 'isAbsenceRisk'),
        source: record.source === 'computed' ? 'computed' : 'missing_workload'
    };
}

function buildAttendanceSummary(current: AttendanceSummary | null, workloadHours: number | null, absences: string): AttendanceSummary {
    if (current?.source === 'computed' && current.workload_hours !== null) return current;

    const absencesHours = current?.absences_hours ?? parseAbsences(absences);
    if (!workloadHours || workloadHours <= 0) {
        return {
            workload_hours: workloadHours,
            absences_hours: absencesHours,
            max_absences_allowed: null,
            minimum_presence_hours: null,
            presence_hours: null,
            presence_percent: null,
            is_absence_risk: null,
            source: 'missing_workload'
        };
    }

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
        is_absence_risk: absencesHours >= Math.max(maxAbsencesAllowed - 4, 0),
        source: 'computed'
    };
}

function normalizeEvaluations(raw: unknown): GradeEvaluation[] {
    return toArray(raw).map((item) => {
        const record = toRecord(item);
        return {
            weight: readString(record, 'weight'),
            score: readString(record, 'score')
        };
    });
}

function parseAbsences(value: string): number {
    const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toArray(raw: unknown): unknown[] {
    return Array.isArray(raw) ? raw : [];
}

function toRecord(raw: unknown): UnknownRecord {
    return raw && typeof raw === 'object' ? raw as UnknownRecord : {};
}

function readString(record: UnknownRecord, key: string): string {
    const value = record[key];
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
}

function readNullableString(record: UnknownRecord, key: string): string | null {
    const value = readString(record, key);
    return value ? value : null;
}

function readNumber(record: UnknownRecord, key: string): number {
    const value = readNullableNumber(record, key);
    return value ?? 0;
}

function readNullableNumber(record: UnknownRecord, key: string): number | null {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function readBoolean(record: UnknownRecord, key: string): boolean {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
}

function readNullableBoolean(record: UnknownRecord, key: string): boolean | null {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return null;
}

function normalizeText(value: string): string {
    return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
