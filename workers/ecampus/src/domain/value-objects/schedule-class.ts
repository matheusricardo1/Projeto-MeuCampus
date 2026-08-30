export interface ScheduleClass {
    weekday: string;
    start_time: string;
    end_time: string;
    code: string;
    subject: string;
    class_identifier: string;
    professor_email: string | null;
    virtual_classroom_url: string | null;
}
