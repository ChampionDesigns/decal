/**
 * The Gate B instruments' static half, inside npm test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

function py(args, { expectFail = false } = {}) {
    try {
        const stdout = execFileSync('python3', args, { cwd: REPO, encoding: 'utf8' });
        assert.ok(!expectFail, `expected a non-zero exit from python3 ${args.join(' ')}`);
        return stdout;
    } catch (err) {
        if (!expectFail) {
            throw new Error(`python3 ${args.join(' ')} failed:\n${err.stdout ?? ''}${err.stderr ?? ''}`);
        }
        return `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
}

test('tools/selfcheck.py passes — all three adaptations, fixture parity, contract check', () => {
    const out = JSON.parse(py(['tools/selfcheck.py', '--json']));
    assert.equal(out.ok, true, JSON.stringify(out.checks.filter((c) => !c.ok), null, 1));
    const names = out.checks.map((c) => c.name);
    for (const fragment of ['adaptation 1', 'adaptation 2', 'adaptation 3', 'fixture parity']) {
        assert.ok(names.some((n) => n.includes(fragment)), `no check named ${fragment}`);
    }
});

test('the residue guard bites its canary', () => {
    const out = py(['tools/selfcheck.py', '--residue-scan', 'test/fixtures/canaries'],
        { expectFail: true });
    assert.match(out, /banned identifier in code/);
    assert.match(out, /names the canvas element id/);
});

test('the residue guard does not fire on the real tools', () => {
    const out = py(['tools/selfcheck.py', '--residue-scan', 'tools']);
    assert.match(out, /\[OK ?\]/);
});

test('tools/geometry.py parses the same matrix test/harness/geometry.js exports', async () => {
    const { CAPTURE_MATRIX } = await import('./harness/geometry.js');
    const out = py(['tools/geometry.py']);
    for (const g of CAPTURE_MATRIX) {
        const dsf = String(g.deviceScaleFactor);
        assert.ok(
            out.includes(`${g.name}`) && out.includes(`${g.width}x${g.height}@dsf${dsf}`),
            `geometry.py did not report ${g.name} as ${g.width}x${g.height}@dsf${dsf}:\n${out}`,
        );
    }
});

test('the mock refuses to serve a drifted fixture set', () => {
    const out = py(['tools/mock_rea.py', '--check-fixtures']);
    assert.match(out, /fixture parity OK/);
});

test('every capture instrument keeps the original CLI shape', () => {
    for (const tool of ['tools/capture_battery.py', 'tools/probe_provenance.py']) {
        const help = py([tool, '--help']);
        assert.match(help, /--out-dir/, `${tool} lost --out-dir`);
    }
    assert.match(py(['tools/probe_provenance.py', '--help']), /--theme/);
    assert.match(py(['tools/probe_provenance.py', '--help']), /--only/);
});

function importmapKeys(html, where) {
    const m = /<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/i.exec(html);
    assert.ok(m, `${where} has no <script type="importmap">`);
    return Object.keys(JSON.parse(m[1]).imports ?? {}).sort();
}

test('the gallery importmap carries the same keys as index.html', async () => {
    const fsp = await import('node:fs/promises');
    const app = importmapKeys(await fsp.readFile(path.join(REPO, 'index.html'), 'utf8'), 'index.html');
    const gallery = importmapKeys(
        await fsp.readFile(path.join(REPO, 'tools/gallery/index.html'), 'utf8'),
        'tools/gallery/index.html');
    assert.deepEqual(gallery, app,
        'the two importmaps have drifted — a bare specifier that resolves in the app '
        + 'throws in the gallery, and Gate B photographs the gallery');
    assert.ok(app.includes('src/'), "index.html's importmap lost the 'src/' prefix");
});

test('the screens importmap carries the same keys as index.html', async () => {
    /* Same trap as the gallery's, one page along, and Gate B's app subjects are the
     * whole of what that page photographs. */
    const fsp = await import('node:fs/promises');
    const app = importmapKeys(await fsp.readFile(path.join(REPO, 'index.html'), 'utf8'), 'index.html');
    const screens = importmapKeys(
        await fsp.readFile(path.join(REPO, 'tools/screens/index.html'), 'utf8'),
        'tools/screens/index.html');
    assert.deepEqual(screens, app,
        'the screens page and index.html have drifted — the fixtures it drives import '
        + '`src/...` bare, and the failure is a state that never settles');
});

test('the app subjects walk exists, and every state names a mock the battery starts', async () => {
    const fsp = await import('node:fs/promises');
    const battery = await fsp.readFile(path.join(REPO, 'tools/capture_battery.py'), 'utf8');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');

    /* The defect was a RETURN before the theme loop, so that is what is asserted —
     * the old branch's own wording still appears in the comment that records it. */
    const beforeTheWalk = battery.slice(battery.indexOf('mock_rea.start_or_reuse()'),
        battery.indexOf('for theme in themes:'));
    assert.ok(beforeTheWalk.length > 0, 'the walk is gone entirely');
    assert.doesNotMatch(beforeTheWalk, /\n\s+return manifest/,
        'a subjects mode still returns before the theme loop — it would write a manifest '
        + 'with zero PNGs and call the screen unverified');
    assert.match(battery, /SCREENS = "\/tools\/screens\/index\.html"/);

    const started = [...battery.matchAll(/^SCREEN_SCRIPTS = \{$|^ {4}"(\w+)":/gm)]
        .map((m) => m[1]).filter(Boolean);
    assert.ok(started.includes('park') && started.includes('shot'),
        `the battery starts ${JSON.stringify(started)} — the park is B8's only route to a picker`);

    const literalStates = screens.slice(screens.indexOf('const STATES = ['),
        screens.indexOf('const LEAF_STATES'));
    assert.ok(literalStates.length > 0, 'the STATES array or the derived leaf block moved');

    const ids = [...literalStates.matchAll(/^ {8}id: '([^']+)'/gm)].map((m) => m[1]);
    assert.ok(ids.length >= 6, `only ${ids.length} screen states are registered`);
    assert.equal(new Set(ids).size, ids.length, 'two screen states share a capture filename');

    const named = [...literalStates.matchAll(/^ {8}mock: '([^']+)'/gm)].map((m) => m[1]);
    assert.equal(named.length, ids.length, 'a screen state does not name a mock');
    for (const mock of new Set(named)) {
        assert.ok(started.includes(mock),
            `state mock '${mock}' is never started by tools/capture_battery.py`);
    }

    const screenModules = (await fsp.readdir(path.join(REPO, 'src/screens')))
        .filter((f) => f.endsWith('-screen.js'))
        .map((f) => f.replace(/-screen\.js$/, ''));
    assert.ok(screenModules.length >= 2,
        `only ${screenModules.length} screens found — the glob for src/screens/*-screen.js broke`);
    for (const screen of screenModules) {
        assert.ok(ids.some((id) => id.startsWith(`${screen}--`)),
            `src/screens/${screen}-screen.js ships and no capture state names it: `
            + `the battery walks ${JSON.stringify(ids)} and photographs no frame of it`);
    }

    // And the fixtures those states drive are the suites' own, not a second driver.
    for (const rel of ['test/fixtures/live-gates-fixture.js', 'test/fixtures/live-loop-fixture.js',
        'test/fixtures/selector-loop-fixture.js']) {
        assert.match(screens, new RegExp(rel.replace('test/', '\\.\\./\\.\\./test/')),
            `${rel} is no longer what the screens walk drives`);
        await fsp.access(path.join(REPO, rel));
    }
});

test('every settings leaf gets a capture state, derived from the navigation', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const nav = await import(`file://${path.join(REPO, 'src/lib/settings-nav.js')}`);

    assert.match(screens, /import \{[^}]*allLeaves[^}]*\} from 'src\/lib\/settings-nav\.js'/,
        'the registry no longer reads the navigation — its leaf coverage is a hand list again');
    assert.match(screens, /^const LEAF_STATES = allLeaves\(\)\.map\(/m,
        'the leaf states are not derived from allLeaves()');
    assert.match(screens, /^STATES\.push\(\.\.\.LEAF_STATES\);$/m,
        'the derived leaf states are never added to the walk');

    const derived = screens.slice(screens.indexOf('const LEAF_STATES'));
    assert.match(derived, /mock: 'park'/, 'a derived leaf state names no mock');
    assert.match(derived, /geometries: \['desktop'\]/,
        'the leaf states no longer declare desktop — they would be captured at geometries '
        + 'where the old app has no counterpart, which is coverage that cannot be paired');
    assert.match(derived, /id: `settings--leaf-\$\{leaf\.id\}`/,
        'a derived state id no longer names its leaf');

    assert.match(screens, /import \{[^}]*SERVED_CAPABILITIES[^}]*\} from 'src\/stores\/capabilities-store\.js'/,
        'the walk no longer reads the capability list off the store — it is a hand list again');
    assert.match(derived, /await api\.capabilities\(\[\.\.\.SERVED_CAPABILITIES\]\);/,
        'the derived leaf states no longer serve the capability array: every gated leaf '
        + 'photographs its fail-closed blank and cannot be paired');

    /* And the frame that shows the REFUSAL is still its own row, or the fix above would
     * have deleted A3's only photograph while making the leaves visible. */
    const handWritten = screens.slice(screens.indexOf('const STATES = ['),
        screens.indexOf('const LEAF_STATES'));
    assert.match(handWritten, /await api\.capabilities\(null\);/,
        'settings--bespoke-gated no longer serves null — nothing photographs fail-closed');

    const leaves = nav.allLeaves();
    const literal = screens.slice(screens.indexOf('const STATES = ['),
        screens.indexOf('const LEAF_STATES'));
    const settingsRows = [...literal.matchAll(/^ {8}id: '(settings--[^']+)'/gm)].length;
    assert.ok(leaves.length > settingsRows,
        `${leaves.length} settings leaves against ${settingsRows} hand-written settings `
        + 'states — the derivation is doing no work');
    for (const leaf of leaves) {
        assert.ok(nav.categoryOf(leaf.id),
            `leaf ${leaf.id} belongs to no category — its drive() would throw mid-walk`);
    }
});

test('a state can decline a geometry, and the battery actually honours it', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const battery = await fsp.readFile(path.join(REPO, 'tools/capture_battery.py'), 'utf8');

    // The declaration, on the state that needs it.
    const narrowed = screens.slice(screens.indexOf("id: 'settings--search-narrowed'"));
    const decl = narrowed.slice(0, narrowed.indexOf('},')).match(/geometries:\s*\[([^\]]*)\]/);
    assert.ok(decl, 'settings--search-narrowed no longer declares its geometries — at the '
        + 'floor it photographs a search field the collapse has hidden');
    assert.doesNotMatch(decl[1], /floor/,
        'the floor is back in the declaration: that is the geometry with no search surface');
    assert.match(decl[1], /bench/, 'bench is where the two states genuinely differ');

    // The declaration reaches the battery at all.
    assert.match(screens, /states:\s*\(\)\s*=>\s*STATES\.map\(\{?[^)]*geometries/,
        'states() drops `geometries` on the way out, so the battery can never see it');

    // And the battery reads it rather than capturing regardless.
    assert.match(battery, /st\.get\("geometries"\)/,
        'the battery no longer reads the declaration');
    assert.match(battery, /declined\.append/,
        'a declined state must still be RECORDED — an unlisted skip is the silence the '
        + 'manifest exists to prevent');
    assert.match(battery, /notCapturedHere/,
        'the per-set record of what was deliberately not photographed is gone');
});

test('the manifest derives its unverified list, and cannot deny a screen it photographs', async () => {
    const fsp = await import('node:fs/promises');
    const battery = await fsp.readFile(path.join(REPO, 'tools/capture_battery.py'), 'utf8');

    assert.match(battery, /def unwalked\(/, 'the unverified list is no longer derived — '
        + 'silence is not coverage (Part 8 §2), and a typed claim goes stale');
    assert.match(battery, /"unverified": unwalked\(\)/,
        'the manifest no longer takes the derived list');
    assert.match(battery, /tools\/screens\/screens\.js/, 'the walk registry is not a source');
    assert.match(battery, /src\/lib\/app-routes\.js/, 'the route table is not a source');

    const drive = (kwargs = '') => JSON.parse(py(['-B', '-c',
        'import sys, json; sys.path.insert(0, "tools"); import capture_battery as cb; '
        + `print(json.dumps(cb.unwalked(${kwargs})))`]));

    const real = drive().join('\n');
    const screenModules = (await fsp.readdir(path.join(REPO, 'src/screens')))
        .filter((f) => f.endsWith('-screen.js'))
        .map((f) => f.replace(/-screen\.js$/, ''));
    for (const screen of screenModules) {
        assert.doesNotMatch(real, new RegExp(`'${screen}' is in the route table`),
            `the manifest calls '${screen}' unwalked while the registry has rows for it — `
            + 'that is wave 5.4 cross-6 again, a manifest denying what it photographs');
    }
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const ids = [...screens.matchAll(/^ {8}id: '([^']+)'/gm)].map((m) => m[1]);
    assert.match(real, new RegExp(`${ids.length} states over \\d+ of the \\d+ screens`),
        `the derived line does not count the registry's ${ids.length} rows`);

    const stripped = JSON.stringify(screens.replace(/^ {8}id: 'editor--[^']+',$/gm,
        "        id: 'zzz--dropped',"));
    const holed = drive(`screens_js=json.loads(${JSON.stringify(stripped)})`).join('\n');
    assert.match(holed, /'editor' is in the route table .* NO row in the walk registry/,
        'a screen with no registry row is not named — the derivation does not bite');

    assert.match(real, /states the old corpus never reached/,
        'the corpus line is gone: steam mode, a rendered GHC strip and the DYE2 paths are '
        + 'subjects no registry row can be missing for, so nothing else would say so');
});

test('#40 ui-tile-grid has a battery row, on the one leaf it ships on', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const suite = await fsp.readFile(
        path.join(REPO, 'test/render/settings-bespoke.render.test.mjs'), 'utf8');

    const LEAF = 'units-language-select-language';
    assert.match(suite, new RegExp(`'${LEAF}'`),
        `the render suite no longer names ${LEAF} — the registry row below would drive a `
        + 'leaf nothing asserts');
    assert.match(screens, new RegExp(`selectLeaf\\('${LEAF}'\\)`),
        `no screen state drives ${LEAF}, so #40 ui-tile-grid is photographed in situ `
        + 'nowhere: settings--bespoke-cards is #51 ui-card-grid, a different component');

    const tiles = screens.slice(screens.indexOf(`selectLeaf('${LEAF}')`));
    assert.match(tiles.slice(0, 1200), /api\.languages\(\[/,
        'the tile-grid state hands the grid no language list: v1 ships English only (D2), '
        + 'so the frame would be one tile and would pin nothing about the reflow');

    const row = screens.slice(screens.indexOf("id: 'settings--bespoke-tiles'"));
    assert.doesNotMatch(row.slice(0, row.indexOf('\n    },')), /geometries:/,
        'the tile-grid state declares itself out of a geometry — the reflow IS the claim, '
        + 'and the narrow frame is the one that carries it');
});

test('every screen state in the registry has a unique id', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const ids = [...screens.matchAll(/^ {8}id: '([^']+)'/gm)].map((m) => m[1]);
    assert.ok(ids.length > 0, 'the registry holds no states at all');
    assert.equal(new Set(ids).size, ids.length, 'two states share an id');
});

test('the token perturbation covers every token it parses', () => {
    const out = JSON.parse(py(['tools/selfcheck.py', '--json']));
    const check = out.checks.find((c) => c.name.includes('token perturbation'));
    assert.ok(check, 'selfcheck no longer reports the perturbation');
    assert.equal(check.ok, true, check.detail.join('\n'));
    assert.ok(!check.detail.some((d) => d.startsWith('UNPERTURBED:')), check.detail.join('\n'));
});
