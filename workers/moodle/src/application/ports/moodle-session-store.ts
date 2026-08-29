export interface MoodleSessionStore {
    markActive(identity: string): Promise<void>;
    markInvalid(identity: string, reason: string): Promise<void>;
    assertActive(identity: string): Promise<void>;
}
