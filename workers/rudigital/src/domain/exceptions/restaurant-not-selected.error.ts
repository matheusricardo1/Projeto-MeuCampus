/**
 * RU Digital redirects (HTTP 303, via a server-side `redirect()` call) to
 * `/restaurante/select` whenever a fresh session has no default restaurant
 * chosen yet — a legitimate first-login state, not a broken/stale action.
 */
export class RestaurantNotSelectedError extends Error {
    constructor() {
        super('O aluno ainda nao selecionou um restaurante padrao no RU Digital.');
        this.name = 'RestaurantNotSelectedError';
    }
}
