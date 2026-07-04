import type { AttendanceSummary } from '@academic/domain/entities/grade.entity';

/**
 * Business rule for attendance risk: 25% of the subject's workload is the
 * maximum allowed absence before the student is at risk of failing by
 * attendance. Independent of where workloadHours/absences came from.
 */
export function buildAttendanceSummary(
    current: AttendanceSummary | null,
    workloadHours: number | null,
    absences: string
): AttendanceSummary {
    if (current?.source === 'computed' && current.workload_hours !== null) {
        return current;
    }

    const absencesHours = current?.absences_hours ?? parseAbsenceHours(absences);
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

function parseAbsenceHours(value: string): number {
    const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}
