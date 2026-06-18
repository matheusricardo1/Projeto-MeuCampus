export interface StudentProfile {
    academic: {
        admission_type: string;
        admission_term: string;
        admission_date: string;
        course: string;
        shift: string;
        enrollment_number: string;
    };
    personal: {
        full_name: string;
        birth_date: string;
        gender: string;
        marital_status: string;
        nationality: string;
        ethnicity: string;
        father_name: string;
        mother_name: string;
    };
    contact: {
        email: string;
        cellphone: string;
        home_phone: string;
    };
    address: {
        zip_code: string;
        street: string;
        number: string;
        neighborhood: string;
        state: string;
        city: string;
    };
}
