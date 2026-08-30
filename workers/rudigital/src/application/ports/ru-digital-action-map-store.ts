/**
 * Shared cache of resolved `{ actionName: serverActionHash }` maps per route,
 * so every worker replica reuses the same discovery instead of re-fetching
 * and re-parsing the same JS chunks independently.
 */
export interface RuDigitalActionMapStore {
    get(route: string): Promise<Record<string, string> | null>;
    save(route: string, actionMap: Record<string, string>): Promise<void>;
    invalidate(route: string): Promise<void>;
}
