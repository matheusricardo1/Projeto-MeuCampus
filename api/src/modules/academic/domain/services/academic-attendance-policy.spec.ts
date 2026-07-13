import { describe, expect, it } from 'vitest';
import { buildAttendanceSummary } from '@academic/domain/services/academic-attendance-policy';
import type { AttendanceSummary } from '@academic/domain/entities/grade.entity';

describe('buildAttendanceSummary', () => {
    it('returns "missing_workload" when workloadHours is null', () => {
        const summary = buildAttendanceSummary(null, null, '5h');
        expect(summary).toEqual({
            workload_hours: null,
            absences_hours: 5,
            max_absences_allowed: null,
            minimum_presence_hours: null,
            presence_hours: null,
            presence_percent: null,
            is_absence_risk: null,
            source: 'missing_workload'
        });
    });

    it('returns "missing_workload" when workloadHours is zero or negative', () => {
        expect(buildAttendanceSummary(null, 0, '0h').source).toBe('missing_workload');
        expect(buildAttendanceSummary(null, -10, '0h').source).toBe('missing_workload');
    });

    it('computes max allowed absences as 25% of workload, floored', () => {
        const summary = buildAttendanceSummary(null, 45, '0h');
        expect(summary.max_absences_allowed).toBe(11);
        expect(summary.minimum_presence_hours).toBe(34);
    });

    it('computes presence percent from workload and absences', () => {
        const summary = buildAttendanceSummary(null, 60, '15h');
        expect(summary.presence_hours).toBe(45);
        expect(summary.presence_percent).toBe(75);
        expect(summary.source).toBe('computed');
    });

    it('clamps presence hours at zero when absences exceed workload', () => {
        const summary = buildAttendanceSummary(null, 60, '999h');
        expect(summary.presence_hours).toBe(0);
        expect(summary.presence_percent).toBe(0);
    });

    it('flags absence risk once absences reach (maxAllowed - 4)', () => {
        // 60h workload -> maxAbsencesAllowed = 15 -> risk threshold = 11
        const belowThreshold = buildAttendanceSummary(null, 60, '10h');
        const atThreshold = buildAttendanceSummary(null, 60, '11h');
        expect(belowThreshold.is_absence_risk).toBe(false);
        expect(atThreshold.is_absence_risk).toBe(true);
    });

    it('never lets the risk threshold go negative for small workloads', () => {
        // 4h workload -> maxAbsencesAllowed = 1 -> threshold = max(1-4, 0) = 0
        const summary = buildAttendanceSummary(null, 4, '0h');
        expect(summary.is_absence_risk).toBe(true);
    });

    it('parses non-numeric absence strings by stripping non-digit characters', () => {
        const summary = buildAttendanceSummary(null, 60, '5 faltas');
        expect(summary.absences_hours).toBe(5);
    });

    it('defaults absences to 0 when the string has no digits', () => {
        const summary = buildAttendanceSummary(null, 60, 'nenhuma');
        expect(summary.absences_hours).toBe(0);
    });

    it('short-circuits and returns the current summary when already computed with a known workload', () => {
        const current: AttendanceSummary = {
            workload_hours: 60,
            absences_hours: 3,
            max_absences_allowed: 15,
            minimum_presence_hours: 45,
            presence_hours: 57,
            presence_percent: 95,
            is_absence_risk: false,
            source: 'computed'
        };

        const summary = buildAttendanceSummary(current, 999, '999h');
        expect(summary).toBe(current);
    });

    it('recomputes when the current summary is "missing_workload" even if a workload is now available', () => {
        const current: AttendanceSummary = {
            workload_hours: null,
            absences_hours: 3,
            max_absences_allowed: null,
            minimum_presence_hours: null,
            presence_hours: null,
            presence_percent: null,
            is_absence_risk: null,
            source: 'missing_workload'
        };

        const summary = buildAttendanceSummary(current, 60, '3h');
        expect(summary.source).toBe('computed');
        expect(summary.workload_hours).toBe(60);
    });

    it('reuses the current absences_hours instead of reparsing when recomputing', () => {
        const current: AttendanceSummary = {
            workload_hours: null,
            absences_hours: 7,
            max_absences_allowed: null,
            minimum_presence_hours: null,
            presence_hours: null,
            presence_percent: null,
            is_absence_risk: null,
            source: 'missing_workload'
        };

        // The raw absences string disagrees with current.absences_hours; the
        // already-known computed value should win over reparsing the string.
        const summary = buildAttendanceSummary(current, 60, '999h');
        expect(summary.absences_hours).toBe(7);
    });
});
