/** Maps RU Digital's "discente" (student) resource, keyed by `queryKey: ["discente","session"]`. */
export interface Student {
    studentId: number;
    courseEnrollmentId: number;
    cpf: string;
    fullName: string;
    enrollmentNumber: string;
    courseCode: string;
    courseName: string;
}
