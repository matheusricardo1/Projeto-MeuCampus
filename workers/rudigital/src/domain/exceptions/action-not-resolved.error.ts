/** Thrown when a named Server Action could not be located in any of a route's JS chunks. */
export class ActionNotResolvedError extends Error {
    constructor(route: string, actionName: string) {
        super(`Could not resolve Server Action "${actionName}" for route "${route}". RU Digital may have changed its bundle layout.`);
        this.name = 'ActionNotResolvedError';
    }
}
