export interface LessonPlanSubject {
    planId: string | null;
    code: string;
    subject: string;
    classIdentifier: string;
    professor: string;
    workloadHours: number | null;
    available: boolean;
}
