export class EcampusResourcePendingError extends Error {
    constructor(public readonly resource: string) {
        super(`O recurso ${resource} esta sendo atualizado.`);
        this.name = 'EcampusResourcePendingError';
    }
}
