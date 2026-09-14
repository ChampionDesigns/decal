/**
 * The gallery page and the screens page: the claims about them that hold without a
 * browser. Both importmaps must carry index.html's keys, every settings leaf must get a
 * capture state derived from the navigation, and the fixture set the mock serves must
 * match its recorded digests.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { allLeaves, categoryOf } from '../src/lib/settings-nav.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

const read = (rel) => readFile(path.join(REPO, rel), 'utf8');

/** The import keys a document declares, sorted. Each page re-roots the values; the keys are shared. */
function importmapKeys(html, where) {
    const found = /<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/i.exec(html);
    assert.ok(found, `${where} declares no importmap`);
    return Object.keys(JSON.parse(found[1]).imports ?? {}).sort();
}

test('the mock refuses to serve a drifted fixture set', () => {
    let out;
    try {
        out = execFileSync('python3', ['tools/mock_rea.py', '--check-fixtures'], { cwd: REPO, encoding: 'utf8' });
    } catch (err) {
        throw new Error(`the fixture parity check failed:\n${err.stdout ?? ''}${err.stderr ?? ''}`);
    }
    assert.match(out, /fixture parity OK/);
});

test('the gallery importmap carries the same keys as index.html', async () => {
    const app = importmapKeys(await read('index.html'), 'index.html');
    const gallery = importmapKeys(await read('tools/gallery/index.html'), 'tools/gallery/index.html');

    assert.deepEqual(gallery, app,
        'the two importmaps have drifted — a bare specifier that resolves in the app throws in the gallery');
    assert.ok(app.includes('src/'), "index.html's importmap no longer declares the src/ prefix");
});

test('the screens importmap carries the same keys as index.html', async () => {
    const app = importmapKeys(await read('index.html'), 'index.html');
    const screens = importmapKeys(await read('tools/screens/index.html'), 'tools/screens/index.html');

    assert.deepEqual(screens, app,
        'the screens page and index.html have drifted — the fixtures it drives import src/ bare, '
        + 'and the failure is a state that never settles');
});

test('every settings leaf gets a capture state, derived from the navigation', async () => {
    const screens = await read('tools/screens/screens.js');

    assert.match(screens, /import \{[^}]*allLeaves[^}]*\} from 'src\/lib\/settings-nav\.js'/,
        'the registry no longer reads the navigation — its leaf coverage is a hand list again');
    assert.match(screens, /^const LEAF_STATES = allLeaves\(\)\.map\(/m,
        'the leaf states are not derived from allLeaves()');
    /* Line-anchored: unanchored, a commented-out push satisfies the match. */
    assert.match(screens, /^STATES\.push\(\.\.\.LEAF_STATES\);$/m,
        'the derived leaf states are never added to the walk');

    const derived = screens.slice(screens.indexOf('const LEAF_STATES'));
    assert.match(derived, /mock: 'park'/, 'a derived leaf state names no mock');
    assert.match(derived, /geometries: \['desktop'\]/,
        'the leaf states no longer declare desktop, and are captured where nothing pairs with them');
    assert.match(derived, /id: `settings--leaf-\$\{leaf\.id\}`/, 'a derived state id no longer names its leaf');
    assert.match(screens, /import \{[^}]*SERVED_CAPABILITIES[^}]*\} from 'src\/stores\/capabilities-store\.js'/,
        'the walk no longer reads the capability list off the store — it is a hand list again');
    assert.match(derived, /await api\.capabilities\(\[\.\.\.SERVED_CAPABILITIES\]\);/,
        'the derived leaf states serve no capability array, so every gated leaf photographs its refusal');

    const handWritten = screens.slice(screens.indexOf('const STATES = ['), screens.indexOf('const LEAF_STATES'));
    assert.match(handWritten, /await api\.capabilities\(null\);/,
        'no hand-written state serves null, so nothing photographs a gated leaf refusing');

    const leaves = allLeaves();
    const rows = [...handWritten.matchAll(/^ {8}id: '(settings--[^']+)'/gm)].length;
    assert.ok(leaves.length > rows,
        `${leaves.length} settings leaves against ${rows} hand-written settings states — the derivation is doing no work`);
    for (const leaf of leaves) {
        assert.ok(categoryOf(leaf.id), `leaf ${leaf.id} belongs to no category, and its drive() would throw mid-walk`);
    }
});

test('the language tile grid has a capture state on the one leaf it ships on', async () => {
    const screens = await read('tools/screens/screens.js');
    const suite = await read('test/render/settings-bespoke.render.test.mjs');
    const LEAF = 'units-language-select-language';

    assert.match(suite, new RegExp(`'${LEAF}'`),
        `the render suite no longer names ${LEAF}, so the capture state below drives a leaf nothing asserts`);
    assert.match(screens, new RegExp(`selectLeaf\\('${LEAF}'\\)`),
        `no capture state drives ${LEAF}, so the tile grid is photographed in situ nowhere`);

    const tiles = screens.slice(screens.indexOf(`selectLeaf('${LEAF}')`));
    assert.match(tiles.slice(0, 1200), /api\.languages\(\[/,
        'the tile-grid state hands the grid no language list, so the frame would be one tile and pin nothing about the reflow');

    const row = screens.slice(screens.indexOf("id: 'settings--bespoke-tiles'"));
    assert.doesNotMatch(row.slice(0, row.indexOf('\n    },')), /geometries:/,
        'the tile-grid state declares itself out of a geometry, and the reflow is the claim the narrow frame carries');
});
