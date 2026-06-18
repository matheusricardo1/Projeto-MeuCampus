export interface GradeEvaluation {
    label: string;
    weight: string;
    score: string;
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
    status: string;
    history_effective: string;
}
