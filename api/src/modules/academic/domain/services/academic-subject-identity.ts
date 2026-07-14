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

/**
 * A deliberately generous "could this be the same subject" check for
 * matching a student's free-text mention of a subject against a real subject
 * name from a PAST period, where there's no code/classIdentifier to anchor
 * on like isSameSubject has. False positives are fine here — the caller
 * (the AI) still confirms the match against the student before treating it
 * as authoritative, exactly like it already does for same-period matches.
 */
export function subjectNameLooselyMatches(subjectName: string, query: string): boolean {
    const normalizedSubject = normalizeSubjectText(subjectName);
    const normalizedQuery = normalizeSubjectText(query);
    if (!normalizedSubject || !normalizedQuery) {
        return false;
    }

    if (normalizedSubject.includes(normalizedQuery) || normalizedQuery.includes(normalizedSubject)) {
        return true;
    }

    const subjectWords = new Set(normalizedSubject.split(/[^a-z0-9]+/).filter((word) => word.length >= 3));
    return normalizedQuery.split(/[^a-z0-9]+/).some((word) => word.length >= 3 && subjectWords.has(word));
}
