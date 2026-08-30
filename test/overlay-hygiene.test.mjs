/**
 *.2, ITEMS rows overlay-style-hygiene and the static half of screensaver-d10.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { runGuards, formatReport, GUARDS } from '../scripts/guards.js';
import {
    collectAuthoredCss, listAuthoredFiles, stripCssComments, REPO_ROOT, DEFAULT_SCAN_ROOTS,
} from '../scripts/lib/authored-css.js';

const OVERLAY_FILES = [
    'src/components/ui-dialog.js',
    'src/components/ui-confirm-dialog.js',
    'src/components/ui-sheet.js',
    'src/components/ui-sheet-header.js',
    'src/components/ui-numeric-keypad.js',
    'src/components/ui-time-picker.js',
    'src/components/ui-notes-editor.js',
    'src/components/ui-menu.js',
    'src/components/ui-toast.js',
    'src/components/ui-screensaver.js',
];

const OVERLAY_TAGS = OVERLAY_FILES.map((f) => path.basename(f, '.js'));

const read = (rel) => fsp.readFile(path.join(REPO_ROOT, rel), 'utf8');

describe('O16 / A8: Gate C covers the overlay surfaces', () => {
    test('every overlay file is in the scanned set, with real declarations in it', async () => {
        const { blocks, files } = await collectAuthoredCss({});
        for (const file of OVERLAY_FILES) {
            assert.ok(files.includes(file), `${file} is not in Gate C's file list`);
            const mine = blocks.filter((b) => b.file === file);
            assert.ok(mine.length > 0, `${file} contributed no CSS block — the css\`\` template was not extracted`);
            const declarations = mine.reduce((n, b) => n + b.declarations.length, 0);
            assert.ok(declarations >= 3,
                `${file} parsed to ${declarations} declarations, which is too few to be its real sheet`);
        }
        const total = blocks
            .filter((b) => OVERLAY_FILES.includes(b.file))
            .reduce((n, b) => n + b.declarations.length, 0);
        assert.ok(total >= 400,
            `the nine overlay sheets parsed to ${total} declarations in total — the extractor has stopped `
            + 'reading most of them and every guard below would pass on nothing');
    });

    test('and none of them is exempt from any guard', () => {
        for (const guard of GUARDS) {
            for (const exempt of guard.exempt) {
                assert.ok(!OVERLAY_FILES.includes(exempt),
                    `${guard.id} exempts ${exempt} — an overlay sheet must be under the guard, not beside it`);
            }
        }
    });

    test('the shipping overlay files raise no violation of any kind', async () => {
        const report = await runGuards({});
        const mine = report.violations.filter((v) => OVERLAY_FILES.includes(v.file));
        assert.deepEqual(mine, [], `\n${formatReport(report)}`);
    });

    describe('each guard fires on each overlay file when it is broken', () => {
        /** `:host {` opens every one of these components' sheets — the base's convention. */
        const INJECT = {
            'colour-literal': ['color: #ff00ff;', /colour literal/],
            important: ['color: var(--ui-ink) !important;', /!important/],
            'private-palette': ['--ui-ink: red;', /re-declares the public token/],
            /* Closed and re-opened around the at-rule: @font-face is a top-level rule and
             * the point is to prove the scan reads this file's block, not to test CSS
             * nesting. */
            'font-face': ['} @font-face { font-family: Probe; src: local("Probe"); } :host {', /@font-face declared outside/],
        };

        for (const file of OVERLAY_FILES) {
            test(file, async () => {
                const source = await read(file);
                const at = source.indexOf(':host {');
                assert.ok(at > 0, `${file} has no ":host {" to inject into — update this canary, do not delete it`);

                for (const [guard, [snippet, message]] of Object.entries(INJECT)) {
                    const dir = await fsp.mkdtemp(path.join(tmpdir(), 'overlay-canary-'));
                    try {
                        const target = path.join(dir, file);
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        const broken = `${source.slice(0, at + ':host {'.length)}\n${snippet}\n${source.slice(at + ':host {'.length)}`;
                        await fsp.writeFile(target, broken);

                        const report = await runGuards({
                            root: dir,
                            roots: [path.dirname(file)],
                            only: [guard],
                            checkExemptions: false,
                        });
                        const hits = report.violations.filter((v) => v.file === file);
                        assert.ok(hits.length > 0,
                            `${guard} did not fire on a broken ${file} — Gate C is not reading this sheet`);
                        assert.match(hits[0].message, message);
                    } finally {
                        await fsp.rm(dir, { recursive: true, force: true });
                    }
                }
            });
        }
    });
});

const HOST_LAYOUT = /^(display|(inline|block)-size|width|height|(min|max)-(inline-size|block-size|width|height)|margin(-\w+)*|flex(-\w+)*|grid-\w+|order|(align|justify|place)-self)$/;

describe('O1 / O2 / O15: one overlay, one sheet', () => {
    /** Selector preludes only, comments stripped — a class name in prose is not a rule. */
    const preludes = (block) => stripCssComments(block.text)
        .split('{')
        .slice(0, -1)
        .map((chunk) => chunk.split('}').pop().trim())
        .filter(Boolean);

    /** Every (prelude, body) pair in a block, at any nesting depth. */
    const rules = (block) => {
        const text = stripCssComments(block.text);
        const out = [];
        let depth = 0;
        let start = 0;
        const opens = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                opens.push({ prelude: text.slice(start, i).split('}').pop().split(';').pop().trim(), at: i });
                depth += 1;
                start = i + 1;
            } else if (text[i] === '}') {
                const open = opens.pop();
                depth -= 1;
                if (open) out.push({ prelude: open.prelude, body: text.slice(open.at + 1, i) });
                start = i + 1;
            }
        }
        assert.equal(depth, 0, `${block.file}: unbalanced braces, the scan below would be wrong`);
        return out;
    };

    test('no sheet names another component\'s element for anything but a custom property', async () => {
        const { blocks } = await collectAuthoredCss({});
        const offences = [];
        for (const block of blocks) {
            for (const { prelude, body } of rules(block)) {
                for (const tag of OVERLAY_TAGS) {
                    if (block.file === `src/components/${tag}.js`) continue;
                    if (!new RegExp(`(^|[^\\w-])${tag}([^\\w-]|$)`).test(prelude)) continue;
                    const painted = body
                        .split(';')
                        .map((d) => d.split(':')[0].trim())
                        .filter((p) => p && !p.startsWith('--') && !p.includes('{'))
                        .filter((p) => !HOST_LAYOUT.test(p));
                    if (painted.length) {
                        offences.push(`${block.file}: ${prelude.replace(/\s+/g, ' ').slice(0, 60)} { ${painted.join(', ')} }`);
                    }
                }
            }
        }
        assert.deepEqual(offences, [],
            'O1 is one file undoing another file\'s fix and O2 is one file re-declaring another\'s component; '
            + 'both need a sheet that paints another component\'s box from outside it');
    });

    const PART_CONSUMERS = Object.freeze([
        'src/screens/editor-screen.js',
        'src/screens/step-matrix.js',
    ]);

    test('only the two argued files reach in through a ::part', async () => {
        const { blocks } = await collectAuthoredCss({});
        const parts = [...new Set(
            blocks.filter((b) => /::part\s*\(/.test(stripCssComments(b.text))).map((b) => b.file),
        )].sort();
        assert.deepEqual(parts, [...PART_CONSUMERS],
            '::part is the ONE way an outside sheet can style a shadow box. Two files are argued for it '
            + 'in the comment above this test; a third has to be argued there before it is added here');
    });

    test('O15: no document-level :has() reaches down into a component', async () => {
        const { blocks } = await collectAuthoredCss({});
        const offences = [];
        for (const block of blocks) {
            for (const prelude of preludes(block)) {
                if (!/:has\s*\(/.test(prelude)) continue;
                if (/^\s*(html|body|:root)\b/.test(prelude)) {
                    offences.push(`${block.file}: ${prelude.replace(/\s+/g, ' ').slice(0, 80)}`);
                }
            }
        }
        assert.deepEqual(offences, [], 'a :has() anchored on the document is O15\'s exact mechanism');
    });

    test('the guarded scan roots still include everywhere a second sheet could live', () => {
        assert.deepEqual([...DEFAULT_SCAN_ROOTS], ['src', 'styles', 'tools', 'index.html']);
    });

    test('no authored CSS file exists outside those roots', async () => {
        const files = await listAuthoredFiles();
        const css = files.filter((f) => f.endsWith('.css'));
        for (const file of css) {
            assert.match(file, /^styles\//, `${file} is a stylesheet outside styles/ — three sheets start as two`);
        }
        assert.ok(css.length >= 3, `only ${css.length} stylesheets found; the collector is not looking`);
    });
});

describe('O13: sheet-actions means one thing, and it is not two', () => {
    test('the name that meant two things is not used for anything', async () => {
        for (const file of OVERLAY_FILES) {
            const source = await read(file);
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
            assert.ok(!/sheet-actions/.test(code),
                `${file} uses the name "sheet-actions" outside a comment — it is the one name §7.7 O13 `
                + 'names as broken, and it is kept only as a citation');
        }
    });

    test('exactly one overlay declares an `actions` slot, and it is the dialog', async () => {
        const declared = [];
        for (const file of OVERLAY_FILES) {
            const source = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            for (const match of source.matchAll(/<slot\s[^>]*name=["']([\w-]+)["']/g)) {
                declared.push({ file, name: match[1] });
            }
        }
        const actions = declared.filter((d) => d.name === 'actions').map((d) => d.file);
        assert.deepEqual(actions, ['src/components/ui-dialog.js'],
            'the footer is #18\'s slot and only #18\'s: a body that declared its own `actions` is the shell '
            + 'and the library meaning the same word differently, which is O13');

        const header = declared.filter((d) => d.file === 'src/components/ui-sheet-header.js').map((d) => d.name);
        assert.deepEqual(header, ['trail'], `#16's cluster slot is ${JSON.stringify(header)}`);
    });

    test('no two overlay components declare the same slot name', async () => {
        const owner = new Map();
        const collisions = [];
        for (const file of OVERLAY_FILES) {
            const source = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            for (const match of source.matchAll(/<slot\s[^>]*name=["']([\w-]+)["']/g)) {
                const name = match[1];
                if (owner.has(name) && owner.get(name) !== file) {
                    collisions.push(`${name}: ${owner.get(name)} and ${file}`);
                }
                owner.set(name, file);
            }
        }
        assert.deepEqual(collisions, []);

        /* And #18's four are #18's. A body re-declaring `body` or `actions` would be the
         * same word meaning "the shell's region" and "my own region" at once. */
        for (const name of ['header', 'header-trail', 'body', 'actions']) {
            assert.equal(owner.get(name), 'src/components/ui-dialog.js',
                `"${name}" is declared by ${owner.get(name)}, not by the one dialog`);
        }
    });
});

describe('D10: the skin is the single owner of screen blanking', () => {
    const srcFiles = async () => (await listAuthoredFiles(['src'])).filter((f) => f.endsWith('.js'));

    test('exactly one file consumes the blackout ground and the blackout layer', async () => {
        const blackout = [];
        const layer = [];
        for (const file of await srcFiles()) {
            const source = await read(file);
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
            if (/var\(\s*--ui-blackout/.test(code)) blackout.push(file);
            if (/var\(\s*--ui-z-blackout/.test(code)) layer.push(file);
        }
        assert.deepEqual(blackout, ['src/components/ui-screensaver.js'],
            'a second consumer of --ui-blackout is a second blanker with a different name');
        assert.deepEqual(layer, ['src/components/ui-screensaver.js']);
    });

    test('the blanking policy has one home and one consumer', async () => {
        const importers = [];
        for (const file of await srcFiles()) {
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            if (/from\s+['"][^'"]*screensaver-policy(\.js)?['"]/.test(code)) importers.push(file);
        }
        assert.deepEqual(importers, [
            'src/components/app-root.js',
            'src/components/ui-screensaver.js',
            'src/screens/live-screen.js',
        ], 'the port returns paint instructions and is incapable of asking for a machine command '
            + '(SCOPE:2755); an importer not argued in the comment above is a second thing '
            + 'deciding when the screen goes dark');
    });

    test('only the slider\'s own path names the brightness command', async () => {
        const senders = [];
        for (const file of await srcFiles()) {
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            if (/setBrightness/.test(code)) senders.push(file);
        }
        assert.deepEqual(senders, [
            'src/components/app-root.js',
            'src/data/rea-ws-channels.js',
            'src/screens/settings-model.js',
            'src/stores/live-stores.js',
            'src/stores/settings-leaf-model.js',
        ], 'Q13: only one side may drive brightness on the WAKE EDGE, and the skin stands '
            + 'back there. A file on this list that is neither the slider\'s own path nor the '
            + 'screensaver\'s dim — a boot path, a policy — is that decision being reversed '
            + 'by accident');
    });

    test('the shell FORWARDS the dim and never picks a brightness of its own', async () => {
        const code = (await read('src/components/app-root.js'))
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        /* `?.(` IS THE CALL SHAPE HERE — the shell reaches through two optionals, because a
         * boot with no live stores is a state (a fixture, a gallery page) and not an error. */
        const calls = [...code.matchAll(/setBrightness\??\.?\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
        assert.deepEqual(calls, ['brightness'],
            'one call, and its argument is the value the dim event carried');
        assert.match(code, /#onSaverDim\s*=\s*\(event\)\s*=>\s*\{[^}]*event\?\.detail\?\.brightness/,
            'the value comes off the event and from nowhere else');
        assert.doesNotMatch(code, /lastBrightness/,
            'the shell reads no remembered brightness — a restore needs a value, and this is where it would come from');
    });

    test('the display route is on the Gate D table with the handler\'s own command set', async () => {
        const table = JSON.parse(await read('src/data/CONTRACTS.json'));
        const row = table.sockets.find((r) => r.path === '/ws/v1/display');
        assert.ok(row, '/ws/v1/display has no contract-table row');
        assert.equal(row.handlerFile, 'lib/src/services/webserver/display_handler.dart');
        assert.equal(row.handlerSymbol, 'DisplayHandler._handleWebSocket');
        assert.equal(row.status, 'consumed');
        assert.deepEqual([...row.commands], ['setBrightness', 'requestWakeLock', 'releaseWakeLock'],
            're-read against the handler at the pinned commit: the switch in _handleWebSocket has exactly '
            + 'these three cases and drops a bad setBrightness with a log line and no reply');
        assert.equal(row.checkedCommit, table.pinnedCommit);
    });

    test('the retired screensaver booleans stay retired, and nothing reads them', async () => {
        const routes = await read('src/lib/storage-routes.js');
        for (const key of ['blackScreenSaver', 'screensaverClock', 'screensaverImages']) {
            assert.ok(routes.includes(key), `${key} is not even named in storage-routes.js`);
        }
        for (const file of await srcFiles()) {
            if (file === 'src/lib/storage-routes.js') continue;
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            assert.ok(!/blackScreenSaver|screensaverClock/.test(code),
                `${file} still reads a retired screensaver setting — the type row carries all three `
                + 'answers, and a boolean beside it would be a second store for one question');
        }
    });
});
