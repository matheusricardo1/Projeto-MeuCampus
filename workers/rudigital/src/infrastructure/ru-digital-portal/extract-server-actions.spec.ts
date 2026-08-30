import { describe, expect, it } from 'vitest';
import { extractActionsFromChunk, extractAppChunkUrls } from '@/infrastructure/ru-digital-portal/extract-server-actions';

// Real snippets captured from RU Digital's production bundles during discovery.
const LOGIN_CHUNK_SNIPPET = 'let j=(0,f.createServerReference)("60289b072ce34eaca70b5740beb9e596487a8b3a10",f.callServer,void 0,f.findSourceMapURL,"loginAction");';

const DASHBOARD_CHUNK_SNIPPET = `
let q=(0,M.createServerReference)("40b39692db111598a6fe098e82ee2d0fad07213432",M.callServer,void 0,M.findSourceMapURL,"getUltimoConsumoAction");
let r=(0,M.createServerReference)("0009c2887b5a7751dd0d56a070409862078712e947",M.callServer,void 0,M.findSourceMapURL,"getDiscenteAction");
let s=(0,M.createServerReference)("0035d8b6a4b9e2cccd792e59a2ae5c0f2b1d5c050a",M.callServer,void 0,M.findSourceMapURL,"getRestauranteDefaultAction");
let t=(0,M.createServerReference)("0065c7b90535fc8ade112f4ddd083a2070e495ef75",M.callServer,void 0,M.findSourceMapURL,"getSaldoAction");
let u=(0,M.createServerReference)("406aaedf0364854137a38cc5bd0cdeabd55f429855",M.callServer,void 0,M.findSourceMapURL,"getCardapioAction");
`;

describe('extractActionsFromChunk', () => {
    it('extracts the semantic name -> hash mapping from a real login chunk', () => {
        expect(extractActionsFromChunk(LOGIN_CHUNK_SNIPPET)).toEqual({
            loginAction: '60289b072ce34eaca70b5740beb9e596487a8b3a10'
        });
    });

    it('extracts every action referenced in a real dashboard chunk', () => {
        expect(extractActionsFromChunk(DASHBOARD_CHUNK_SNIPPET)).toEqual({
            getUltimoConsumoAction: '40b39692db111598a6fe098e82ee2d0fad07213432',
            getDiscenteAction: '0009c2887b5a7751dd0d56a070409862078712e947',
            getRestauranteDefaultAction: '0035d8b6a4b9e2cccd792e59a2ae5c0f2b1d5c050a',
            getSaldoAction: '0065c7b90535fc8ade112f4ddd083a2070e495ef75',
            getCardapioAction: '406aaedf0364854137a38cc5bd0cdeabd55f429855'
        });
    });

    it('returns an empty map when the chunk has no Server Action references', () => {
        expect(extractActionsFromChunk('var a = 1; function b() { return a + 1; }')).toEqual({});
    });
});

describe('extractAppChunkUrls', () => {
    it('keeps only app-route chunks and drops shared vendor chunks', () => {
        const html = `
            <script src="/_next/static/chunks/webpack-3fb91ea4c246cffc.js"></script>
            <script src="/_next/static/chunks/9400-5dad1e15e64913bc.js"></script>
            <script src="/_next/static/chunks/app/(auth)/login/page-f40e9610ba117cab.js"></script>
            <script src="/_next/static/chunks/app/layout-34e75dd3bf234bf8.js"></script>
        `;

        expect(extractAppChunkUrls(html)).toEqual([
            '/_next/static/chunks/app/(auth)/login/page-f40e9610ba117cab.js',
            '/_next/static/chunks/app/layout-34e75dd3bf234bf8.js'
        ]);
    });

    it('deduplicates repeated chunk references', () => {
        const html = `
            <script src="/_next/static/chunks/app/layout-34e75dd3bf234bf8.js"></script>
            <link rel="preload" href="/_next/static/chunks/app/layout-34e75dd3bf234bf8.js" as="script" />
        `;

        expect(extractAppChunkUrls(html)).toEqual(['/_next/static/chunks/app/layout-34e75dd3bf234bf8.js']);
    });

    it('returns an empty array when there are no chunk references', () => {
        expect(extractAppChunkUrls('<html><body>no scripts here</body></html>')).toEqual([]);
    });
});
