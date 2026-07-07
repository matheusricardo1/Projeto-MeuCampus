export interface StudentProfile {
    academic: {
        admission_term: string;
        course: string;
        shift: string;
        enrollment_number: string;
    };
    personal: {
        full_name: string;
    };
    contact: {
        email: string;
        cellphone: string;
        home_phone: string;
    };
}
