// RU Digital's Next.js build keeps the semantic export name as the 5th
// argument of every `createServerReference(hash, callServer, void 0,
// findSourceMapURL, "actionName")` call in its client bundles — e.g.
// `(0,M.createServerReference)("40b39692...","getUltimoConsumoAction")`.
// That lets a name -> current-build hash map be recovered from plain static
// assets, with no headless browser and no guessing which hash does what.
const ACTION_REFERENCE_PATTERN = /createServerReference\)\("([a-f0-9]{40,44})"[\s\S]{0,80}?,"([A-Za-z0-9_]+)"\)/g;
const CHUNK_URL_PATTERN = /\/_next\/static\/chunks\/[^"]+\.js/g;

export function extractActionsFromChunk(source: string): Record<string, string> {
    const actionMap: Record<string, string> = {};

    for (const match of source.matchAll(ACTION_REFERENCE_PATTERN)) {
        const [, hash, name] = match;
        if (hash && name) {
            actionMap[name] = hash;
        }
    }

    return actionMap;
}

// Every action we call lives in the route's own page/template/layout chunk
// (all served under `/_next/static/chunks/app/...`), never in the large
// numeric-id vendor chunks — restricting discovery to those keeps it to a
// handful of small, content-hashed (safely cacheable) files.
export function extractAppChunkUrls(html: string): string[] {
    const urls = new Set(html.match(CHUNK_URL_PATTERN) ?? []);
    return Array.from(urls).filter((url) => url.includes('/app/'));
}
