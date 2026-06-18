export interface LessonPlanSubject {
    planId: string | null;
    code: string;
    subject: string;
    classIdentifier: string;
    credits: string;
    workload: string;
    professor: string;
    available: boolean;
}
