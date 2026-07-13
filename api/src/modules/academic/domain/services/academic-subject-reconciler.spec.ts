import { describe, expect, it } from 'vitest';
import { reconcileAcademicSubjects } from '@academic/domain/services/academic-subject-reconciler';
import type { Grade } from '@academic/domain/entities/grade.entity';
import type { LessonPlanSubject } from '@academic/domain/entities/lesson-plan-subject.entity';
import type { ScheduleClass } from '@academic/domain/value-objects/schedule-class.value-object';

function buildGrade(overrides: Partial<Grade> = {}): Grade {
    return {
        code: 'MAT101',
        subject: 'Calculo I',
        class_identifier: 'T01',
        evaluations: [],
        exercise_average: '',
        final_exam: '',
        final_grade: '',
        absences: '0',
        attendance: {
            workload_hours: 60,
            absences_hours: 0,
            max_absences_allowed: 15,
            minimum_presence_hours: 45,
            presence_hours: 60,
            presence_percent: 100,
            is_absence_risk: false,
            source: 'computed'
        },
        status: 'Cursando',
        ...overrides
    };
}

function buildLessonPlanSubject(overrides: Partial<LessonPlanSubject> = {}): LessonPlanSubject {
    return {
        planId: 'PLAN-1',
        code: 'MAT101',
        subject: 'Calculo I',
        classIdentifier: 'T01',
        credits: 4,
        professor: 'Dr. Fulano',
        workloadHours: 60,
        available: true,
        ...overrides
    };
}

function buildScheduleItem(overrides: Partial<ScheduleClass> = {}): ScheduleClass {
    return {
        weekday: 'Monday',
        start_time: '08:00',
        end_time: '10:00',
        code: 'MAT101',
        subject: 'Calculo I',
        class_identifier: 'T01',
        ...overrides
    };
}

describe('reconcileAcademicSubjects', () => {
    it('returns an empty list when given no sources', () => {
        expect(reconcileAcademicSubjects({})).toEqual([]);
    });

    it('builds a subject from grades alone', () => {
        const [subject] = reconcileAcademicSubjects({ grades: [buildGrade()] });
        expect(subject).toMatchObject({
            available: true,
            code: 'MAT101',
            subject: 'Calculo I',
            classIdentifier: 'T01',
            planId: null,
            professor: ''
        });
        expect(subject!.grade).toMatchObject({ code: 'MAT101' });
    });

    it('merges a lesson-plan subject into an existing grade-derived subject with the same code', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade()],
            lessonPlanSubjects: [buildLessonPlanSubject({ professor: 'Dra. Ciclana', credits: 6 })]
        });

        expect(subjects).toHaveLength(1);
        expect(subjects[0]).toMatchObject({
            code: 'MAT101',
            professor: 'Dra. Ciclana',
            credits: 6,
            planId: 'PLAN-1',
            available: true
        });
        // The grade attached earlier must survive the merge.
        expect(subjects[0]!.grade).toMatchObject({ code: 'MAT101' });
    });

    it('merges a schedule item into an existing subject and accumulates scheduleItems', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade()],
            schedule: [buildScheduleItem(), buildScheduleItem({ weekday: 'Wednesday' })]
        });

        expect(subjects).toHaveLength(1);
        expect(subjects[0]!.scheduleItems).toHaveLength(2);
    });

    it('matches a lesson-plan subject to a grade by subject name when the code differs', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade({ code: 'OLD-CODE' })],
            lessonPlanSubjects: [buildLessonPlanSubject({ code: 'NEW-CODE', classIdentifier: 'T99' })]
        });

        // Same subject name should reconcile into a single entry, not two.
        expect(subjects).toHaveLength(1);
        expect(subjects[0]!.grade).toMatchObject({ code: 'OLD-CODE' });
        expect(subjects[0]!.planId).toBe('PLAN-1');
    });

    it('keeps distinct subjects separate when nothing about them matches', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade({ code: 'MAT101', subject: 'Calculo I', class_identifier: 'T01' })],
            lessonPlanSubjects: [buildLessonPlanSubject({ code: 'FIS201', subject: 'Fisica II', classIdentifier: 'T02' })]
        });

        expect(subjects).toHaveLength(2);
    });

    it('creates a subject from a lesson-plan entry with no matching grade', () => {
        const subjects = reconcileAcademicSubjects({
            lessonPlanSubjects: [buildLessonPlanSubject({ available: false, planId: null })]
        });

        expect(subjects).toHaveLength(1);
        expect(subjects[0]).toMatchObject({ available: false, planId: null, grade: null });
    });

    it('creates a subject from a schedule-only entry, marked unavailable with no grade', () => {
        const subjects = reconcileAcademicSubjects({ schedule: [buildScheduleItem()] });

        expect(subjects).toHaveLength(1);
        expect(subjects[0]).toMatchObject({ available: false, grade: null, planId: null });
        expect(subjects[0]!.scheduleItems).toHaveLength(1);
    });

    it('recomputes attendance from workloadHours and the grade absences when merging', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade({ absences: '15h', attendance: {
                workload_hours: null,
                absences_hours: 15,
                max_absences_allowed: null,
                minimum_presence_hours: null,
                presence_hours: null,
                presence_percent: null,
                is_absence_risk: null,
                source: 'missing_workload'
            } })],
            lessonPlanSubjects: [buildLessonPlanSubject({ workloadHours: 60 })]
        });

        expect(subjects[0]!.attendance).toMatchObject({
            workload_hours: 60,
            absences_hours: 15,
            source: 'computed'
        });
    });

    it('sorts the final result alphabetically by subject name', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [
                buildGrade({ code: 'B', subject: 'Zoologia' }),
                buildGrade({ code: 'A', subject: 'Algebra Linear' })
            ]
        });

        expect(subjects.map((subject) => subject.subject)).toEqual(['Algebra Linear', 'Zoologia']);
    });

    it('reconciles all three sources for the same subject into a single entry', () => {
        const subjects = reconcileAcademicSubjects({
            grades: [buildGrade()],
            lessonPlanSubjects: [buildLessonPlanSubject()],
            schedule: [buildScheduleItem(), buildScheduleItem({ weekday: 'Friday' })]
        });

        expect(subjects).toHaveLength(1);
        expect(subjects[0]).toMatchObject({ code: 'MAT101', planId: 'PLAN-1', available: true });
        expect(subjects[0]!.grade).toMatchObject({ code: 'MAT101' });
        expect(subjects[0]!.scheduleItems).toHaveLength(2);
    });
});
