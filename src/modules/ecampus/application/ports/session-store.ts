export interface SessionStore {
    saveSession(userCpf: string, cookies: object): Promise<void>;
    getSession(userCpf: string): Promise<object | null>;
    deleteSession(userCpf: string): Promise<void>;
}
