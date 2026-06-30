export interface EcampusSessionStore {
    markActive(cpf: string): Promise<void>;
    markInvalid(cpf: string, reason: string): Promise<void>;
    assertActive(cpf: string): Promise<void>;
}
