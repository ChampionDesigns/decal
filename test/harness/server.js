/**
 * server.js — the ephemeral static server the Gate A harness mounts against.
 *
 * The repo root IS the served root (SCOPE Part 2 §2), so the harness serves the repo
 * root and nothing else. That is not a convenience: it means a rendering test loads
 * `lit` through the same importmap, the same `vendor/lit.js`, the same
 * `styles/tokens.css` and the same `fonts/Geist-Variable.ttf` that ReaPrime will
 * serve. A harness that stubbed any of those would be testing a tree that does not
 * ship.
 *
 * PORT 0 — one server per harness invocation, on a kernel-assigned port. Same
 * parallel-safety argument as cdp.js: nothing here may collide with a concurrent
 * builder's rig.
 *
 * THE MOUNT DOCUMENT is generated at `/__harness__.html`, at the root, so that every
 * relative URL in it resolves exactly as it does from `index.html` — `./vendor/lit.js`,
 * `styles/tokens.css`. It is NOT index.html, because index.html mounts <app-root>
 * and a rendering test wants an empty body to put one component in. What it does
 * take from index.html, by parsing it at serve time rather than by copying, is:
 *
 *   - the importmap, verbatim;
 *   - the three stylesheet <link>s, verbatim;
 *   - the pre-paint theme stamp's default.
 *
 * By construction rather than by copy, because a copy drifts silently: the day
 * someone vendors a fifth module or adds a fourth global sheet, every rendering test
 * would keep passing against the old document. If index.html stops having an
 * importmap this throws instead.
 */

import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const HARNESS_PAGE = '/__harness__.html';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
};

/**
 * Pull the parts of index.html the mount document has to share with the real one.
 * Throws rather than falling back: a silent fallback is how a harness starts testing
 * a document the app does not serve.
 */
export async function readDocumentShell(root = REPO_ROOT) {
    const html = await fsp.readFile(path.join(root, 'index.html'), 'utf8');

    const importmap = /<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/i.exec(html);
    if (!importmap) {
        throw new Error('index.html has no <script type="importmap"> — the harness page cannot resolve bare specifiers');
    }
    try {
        JSON.parse(importmap[1]);
    } catch (err) {
        throw new Error(`index.html's importmap is not valid JSON: ${err.message}`);
    }

    const links = [...html.matchAll(/<link\s+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]);
    if (links.length === 0) {
        throw new Error('index.html links no stylesheets — tokens would not exist in the harness page');
    }

    /* THE VIEWPORT META IS READ, NOT RE-TYPED. It used to be a literal in
     * `mountDocument` below, and on 27 August 2026 that literal went stale the moment
     * index.html's own line changed: the app declared `user-scalable=no,
     * minimum-scale=1, maximum-scale=1` to close the zoom trap Ben hit, and every
     * mounted component carried on being laid out in a page where browser scaling was
     * still permitted. A harness whose document differs from the served one in a way
     * that changes engine behaviour is testing something nobody ships — which is the
     * same reason the importmap and the stylesheet links above are read rather than
     * copied. Throws rather than defaulting, for that reason. */
    const viewport = /<meta\s+name="viewport"[^>]*>/i.exec(html);
    if (!viewport) {
        throw new Error('index.html has no <meta name="viewport"> — the harness page would '
            + 'lay out under different viewport rules from the app');
    }

    const theme = /setAttribute\('data-theme',\s*stored\s*\|\|\s*DEFAULT_THEME\)/.test(html)
        ? (/DEFAULT_THEME\s*=\s*'([a-z]+)'/.exec(html)?.[1] ?? 'dark')
        : 'dark';

    return { importmap: importmap[1].trim(), links, viewport: viewport[0], defaultTheme: theme };
}

/**
 * The mount document. Body is empty on purpose — `page.mount()` fills it.
 * `#mount` is a plain block with no styling of its own so it cannot influence the
 * geometry of whatever is put inside it.
 */
export function mountDocument(shell, { theme }) {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
${shell.viewport}
<title>Decal Gate A harness</title>
<link rel="icon" href="data:,">
<script type="importmap">
${shell.importmap}
</script>
${shell.links.join('\n')}
</head>
<body>
<div id="mount"></div>
</body>
</html>
`;
}

/**
 * Start the server. Resolves once it is listening, with the origin to navigate to.
 */
export async function startServer({ root = REPO_ROOT, theme = null } = {}) {
    const shell = await readDocumentShell(root);
    const pageTheme = theme ?? shell.defaultTheme;

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        const pathname = decodeURIComponent(url.pathname);

        if (pathname === HARNESS_PAGE) {
            const t = url.searchParams.get('theme') || pageTheme;
            const body = mountDocument(shell, { theme: t });
            res.writeHead(200, {
                'content-type': MIME['.html'],
                'cache-control': 'no-store',
            });
            res.end(body);
            return;
        }

        // Path containment: resolve, then require the result to still be under root.
        const target = path.resolve(root, '.' + path.posix.normalize(pathname));
        if (target !== root && !target.startsWith(root + path.sep)) {
            res.writeHead(403).end('forbidden');
            return;
        }

        try {
            const stat = await fsp.stat(target);
            const file = stat.isDirectory() ? path.join(target, 'index.html') : target;
            const data = await fsp.readFile(file);
            res.writeHead(200, {
                'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
                'cache-control': 'no-store',
                'content-length': data.length,
            });
            res.end(data);
        } catch {
            res.writeHead(404, { 'content-type': MIME['.txt'] }).end(`not found: ${pathname}`);
        }
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();
    return {
        port,
        origin: `http://127.0.0.1:${port}`,
        shell,
        close: () =>
            new Promise((resolve) => {
                server.closeAllConnections?.();
                server.close(() => resolve());
            }),
    };
}
