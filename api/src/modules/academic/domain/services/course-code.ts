/**
 * Pulls the course code (e.g. "IE17") out of a course label. eCampus shows it
 * as "CODE - Nome" both in the student profile ("IE17 - Engenharia de
 * Software") and in the matriz curricular report header ("Curso: IE17 -
 * Engenharia de Software"), so this same extraction works for either source.
 * Returns null when the label carries no recognizable code.
 */
export function extractCourseCode(courseLabel: string): string | null {
    const head = courseLabel.split(/\s*[-–—]\s*/)[0]?.trim() ?? '';
    if (/^[A-Z]{2,3}\d{2,3}[A-Z]?$/i.test(head)) {
        return normalizeCourseCode(head);
    }
    const match = courseLabel.match(/\b([A-Z]{2,3}\d{2,3}[A-Z]?)\b/i);
    return match ? normalizeCourseCode(match[1]!) : null;
}

function normalizeCourseCode(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
