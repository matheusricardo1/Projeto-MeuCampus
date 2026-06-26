export interface LessonPlanSubject {
    planId: string | null;
    code: string;
    subject: string;
    classIdentifier: string;
    credits: number | null;
    professor: string;
    workloadHours: number | null;
    available: boolean;
}
