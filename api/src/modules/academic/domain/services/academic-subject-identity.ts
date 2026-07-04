/**
 * Domain rule for when two subject references — possibly coming from
 * different eCampus resources (grades, lesson plan, schedule) — refer to
 * the same academic subject. Operates on already-typed fields only; callers
 * are responsible for having parsed raw data before reaching this.
 */
export function isSameSubject(
    item: { code: string; classIdentifier?: string; class_identifier?: string; subject: string },
    code: string,
    classIdentifier: string,
    subject: string
): boolean {
    const itemClassIdentifier = item.classIdentifier ?? item.class_identifier ?? '';
    return Boolean(
        (code && item.code === code)
        || (classIdentifier && itemClassIdentifier === classIdentifier)
        || (subject && normalizeSubjectText(item.subject) === normalizeSubjectText(subject))
    );
}

export function subjectIdentityKey(code: string, classIdentifier: string, subject: string): string {
    return normalizeSubjectText(code || classIdentifier || subject);
}

export function normalizeSubjectText(value: string): string {
    return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
