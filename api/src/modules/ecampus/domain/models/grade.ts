export interface GradeEvaluation {
    weight: string;
    score: string;
}

export interface AttendanceSummary {
    workload_hours: number | null;
    absences_hours: number;
    max_absences_allowed: number | null;
    minimum_presence_hours: number | null;
    presence_hours: number | null;
    presence_percent: number | null;
    is_absence_risk: boolean | null;
    source: 'computed' | 'missing_workload';
}

export interface Grade {
    code: string;
    subject: string;
    class_identifier: string;
    evaluations: GradeEvaluation[];
    exercise_average: string;
    final_exam: string;
    final_grade: string;
    absences: string;
    attendance: AttendanceSummary;
    status: string;
}
