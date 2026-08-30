export interface Course {
    id: number;
    shortName: string;
    fullName: string;
    displayName: string;
    imageUrl: string | null;
    progress: number | null;
    startDate: number;
    endDate: number | null;
    visible: boolean;
}
