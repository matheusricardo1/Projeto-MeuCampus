// Runs after `expo export --platform web`. The project stays on Expo Router's
// "single" web output (one shared index.html + client-side routing) because
// that's what vercel.json's catch-all rewrite is built for — switching to
// "static" output (Expo's own way to customize the HTML head via +html.tsx)
// would mean regenerating per-route HTML files and rewriting the Vercel
// routing config to match, which is a much bigger, riskier change than "add
// a PWA manifest and some meta tags". So instead this patches the exported
// index.html directly and copies the PWA assets over.
const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2] || 'web-build';
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, outputDir);
const publicDir = path.join(projectRoot, 'public');
const indexHtmlPath = path.join(outputPath, 'index.html');

const HEAD_ADDITIONS = `
    <meta name="theme-color" content="#10372f" />
    <meta name="description" content="Notas, faltas, horarios e assistente de IA integrados ao eCampus da UFAM. Projeto nao oficial." />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Meu Campus" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <style id="app-like-web">
      html, body, #root { overscroll-behavior: none; }
      body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
      * { -webkit-tap-highlight-color: transparent; }
    </style>
`;

function copyPublicAssets() {
    if (!fs.existsSync(publicDir)) return;

    for (const entry of fs.readdirSync(publicDir)) {
        fs.cpSync(path.join(publicDir, entry), path.join(outputPath, entry), { recursive: true });
    }
}

function patchIndexHtml() {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    if (html.includes('id="app-like-web"')) {
        return;
    }

    html = html.replace('lang="en"', 'lang="pt-BR"');

    const viewportPattern = /<meta name="viewport"[^>]*>/;
    html = html.replace(
        viewportPattern,
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
    );

    html = html.replace('</head>', `${HEAD_ADDITIONS}  </head>`);

    fs.writeFileSync(indexHtmlPath, html);
}

if (!fs.existsSync(indexHtmlPath)) {
    console.error(`postbuild-web: ${indexHtmlPath} not found, skipping.`);
    process.exit(1);
}

copyPublicAssets();
patchIndexHtml();
console.log(`postbuild-web: patched ${indexHtmlPath} and copied public/ assets into ${outputDir}/`);
