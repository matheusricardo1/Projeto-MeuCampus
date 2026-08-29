export interface Course {
    id: number;
    shortName: string;
    fullName: string;
    displayName: string;
    imageUrl: string | null;
    /** 0-100, or null when the course has completion tracking disabled. */
    progress: number | null;
    startDate: number;
    endDate: number | null;
    visible: boolean;
}
