export interface CurrentAcademicPeriod {
    year: string;
    period: string;
}

export function getCurrentAcademicPeriod(now = new Date()): CurrentAcademicPeriod {
    return {
        year: now.getFullYear().toString(),
        period: now.getMonth() >= 6 ? '2' : '1'
    };
}
