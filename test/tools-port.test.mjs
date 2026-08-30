/**
 * tools-port.test.mjs — the Gate B instruments' static half, inside `npm test`.
 *
 * The capture battery and the provenance probe are Python and drive a browser, so
 * their end-to-end behaviour is not a node:test job. What IS a node:test job is
 * every claim about them that can be checked without a browser — and those are
 * exactly the claims that rot silently:
 *
 *   * the three shadow-DOM adaptations are present (SCOPE Part 10 §13). The capture
 *     agent's prompt lists them as preconditions to VERIFY, never as work to do, so
 *     something has to be verifying them on an ordinary night too;
 *   * the residue guard still BITES — the canary in test/fixtures/canaries/ is the
 *     hack as Slate's battery actually carried it, and the guard must fail on it
 *     ("every guard ships with a canary", Part 8 §2 Gate C);
 *   * fixture parity against tools/FIXTURES.sha256 (Part 10 §13 precondition), and
 *     the mock's contract check (Gate B change 4);
 *   * the Python side and the Gate A harness agree about the geometry matrix,
 *     because tools/geometry.py PARSES test/harness/geometry.js rather than
 *     restating it, and a parser is only as good as the last time it ran.
 *
 * These shell out to python3. If Python is missing the tests fail loudly rather
 * than skipping: a green suite that quietly stopped covering the capture rig is the
 * precise failure mode Gate C's canary rule exists to prevent.
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

/**
 * The gallery's importmap and index.html's must carry the SAME KEYS.
 *
 * "Kept in step by hand" failed the first time it mattered: the gallery's map was
 * missing the `src/` prefix, so the bare-specifier import CONVENTIONS.md documents
 * four times (`import { UiElement } from 'src/components/base.js'`) resolved in the
 * app and in the Gate A harness — which parses index.html's map at serve time — and
 * THREW in the gallery. Measured in headless Chrome, both documents from the repo
 * root: index.html RESOLVED, /tools/gallery/index.html
 * `Failed to resolve module specifier 'src/components/base.js'`.
 *
 * It is invisible today only because the one gallery entry imports a relative path.
 * Gate B takes its whole subject list from the gallery, so the first Wave 1 component
 * written the documented way would pass Gate A and be unphotographable by Gate B —
 * surfacing not as an error but as `gallerySettled` never being set and the battery
 * writing `unsettled` after 45 s per state, per theme, per geometry.
 *
 * Keys, not values: the gallery is two levels down, so every value is re-rooted.
 */
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

/**
 * GATE B WALKS THE SCREEN THIS TREE HAS.
 *
 * `--subjects app` used to return before the theme loop with "Decal has no screens yet
 * (Waves 2–4), so this path photographs nothing" — true when it was written, false since
 * wave 5.1 built the Live screen, and the consequence was a manifest that declared the
 * screen unverified while its states were captured by hand (finding cross-3). The claim
 * this test defends is the cross-file one: every state names a mock the battery actually
 * starts, and a state that names one it does not would surface only as a 120 s timeout
 * per state, per theme, per geometry.
 */
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

    /* SCOPED TO THE HAND-WRITTEN ROWS, because the settings leaves are no longer written
     * down — they are derived from the navigation, and a regex over source text cannot
     * count a state that does not exist until the file runs. Counting `mock:` literals
     * across the whole file against `id:` literals in one array is how this assertion
     * first reported the derivation as a fault (35 mocks, 34 ids) when nothing was wrong.
     * The invariant it exists to hold — every state names a mock the battery starts —
     * applies to both halves, so the derived half is pinned in its own test below. */
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

    /* EVERY SCREEN THIS TREE SHIPS HAS AT LEAST ONE STATE.
     *
     * The count assertion above cannot catch the way this actually fails, and it did fail
     * this way: wave 5.3 built the profile selector, the registry kept its six `live--`
     * rows, `>= 6` stayed green, and `--subjects app` photographed the Live screen at
     * every geometry while the new screen's only images were a reviewer's stopgap script
     * (wave 5.3, cross-3 — wave 5.1's cross-3 reproduced one wave later). So the claim is
     * per SCREEN: a src/screens/<name>-screen.js with no state whose id names it is a
     * screen the battery cannot photograph. The next wave to add a screen fails HERE,
     * which is the point — the alternative is finding out in cross-review again. */
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

/* THE COVERAGE CLAIM THIS REGISTRY MAKES ABOUT SETTINGS, PINNED.
 *
 * The walk photographed settings ARCHETYPES — one leaf standing in for every leaf of the
 * same shape — while the old app photographs one state per leaf, thirty of them. That is
 * not a state this registry was missing; it is a state the registry could not express, so
 * no manifest could report it and no reviewer diffing the set could see it. The fix is a
 * DERIVATION rather than a list, because a list closes today's gap and reopens it on the
 * next leaf anyone adds.
 *
 * BOTH HALVES ARE PINNED, for the same reason the geometry declaration pins both halves
 * below: a derivation nothing photographs is prose, and a push of states nobody derived is
 * a list wearing a loop's clothes. */
test('every settings leaf gets a capture state, derived from the navigation', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');
    const nav = await import(`file://${path.join(REPO, 'src/lib/settings-nav.js')}`);

    assert.match(screens, /import \{[^}]*allLeaves[^}]*\} from 'src\/lib\/settings-nav\.js'/,
        'the registry no longer reads the navigation — its leaf coverage is a hand list again');
    assert.match(screens, /^const LEAF_STATES = allLeaves\(\)\.map\(/m,
        'the leaf states are not derived from allLeaves()');
    /* LINE-ANCHORED, AND THAT IS THE WHOLE ASSERTION. Written unanchored it matched the
     * line commented out — proven by perturbation: `// STATES.push(...)` left this test
     * green while the walk photographed no leaf at all. A pin that a comment satisfies is
     * not a pin. */
    assert.match(screens, /^STATES\.push\(\.\.\.LEAF_STATES\);$/m,
        'the derived leaf states are never added to the walk');

    const derived = screens.slice(screens.indexOf('const LEAF_STATES'));
    assert.match(derived, /mock: 'park'/, 'a derived leaf state names no mock');
    assert.match(derived, /geometries: \['desktop'\]/,
        'the leaf states no longer declare desktop — they would be captured at geometries '
        + 'where the old app has no counterpart, which is coverage that cannot be paired');
    assert.match(derived, /id: `settings--leaf-\$\{leaf\.id\}`/,
        'a derived state id no longer names its leaf');

    /* THE CAPABILITY ARRAY IS SERVED, AND IT IS READ OFF THE STORE (parity surface 3).
     *
     * The mock answers /machine/capabilities 503 by design, so a drive that serves
     * nothing photographs four gated leaves — cup warmer, lighting, load cells, sleep &
     * wake — as an eyebrow, a title and nothing else. Those four states exist to be
     * PAIRED against the old app's capture of the same leaf, and a fail-closed blank
     * pairs with nothing; the row was present and green while the coverage it claimed was
     * hollow, which is the same failure mode the derivation above exists to prevent one
     * level down. BOTH HALVES PINNED for the same reason as every other claim in this
     * test: a served array nobody derives is a hand list, and a derivation nothing calls
     * is prose. */
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

    /* THE POINT OF THE DERIVATION, not just its shape: there are far more leaves than
     * there are hand-written settings rows, and every one of them now has a state. If
     * these ever match, the archetypes have quietly become the coverage again. */
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

/* Wave 5.4, cross-3. `settings--search-narrowed` wrote a floor PNG byte-identical to
 * `settings--browse` in both themes, because the 1100px collapse hides the nav column the
 * search field is slotted into: two named states, one image, and a manifest that said
 * nothing. The state now declares where it is meaningful. BOTH HALVES ARE PINNED — a
 * declaration the battery does not read is prose, and a battery filter no state uses is
 * dead code, and either half alone silently restores the false photograph. */
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

/* THE UNVERIFIED LIST IS DERIVED NOW, SO THE PIN DRIVES IT INSTEAD OF READING IT.
 *
 * This test used to read `UNWALKED = [...]` out of the battery as TEXT and assert three
 * things about the sentences in it: that the retired claims were gone (wave 5.4's
 * "Decal has no screens yet" and cross-6's "settings do not exist") and that the
 * genuinely-unbuilt screen was still named. The third assertion is how the same defect
 * came back a third time: it pinned the sentence "the PROFILE EDITOR does not exist yet",
 * wave 5.5 built the editor and gave it seven registry rows, and the pin then REQUIRED
 * the manifest to keep denying a screen the battery was photographing. A test that pins a
 * hand-written claim about what exists inherits the staleness it was written to catch.
 *
 * Fix run 7 (Ben's call) made the screen half of the list DERIVED — `capture_battery`
 * reads the route table and the walk registry — so the pin drives the derivation instead,
 * BOTH WAYS ROUND, which is what the old comment wanted and text matching could not give:
 * with the tree's own files no built screen may be called missing, and with a registry
 * that is missing one, that screen must be named. `python3 -B` because importing the
 * battery writes a `.pyc` beside seven tracked ones, and a test must not dirty the tree.
 */
test('the manifest derives its unverified list, and cannot deny a screen it photographs', async () => {
    const fsp = await import('node:fs/promises');
    const battery = await fsp.readFile(path.join(REPO, 'tools/capture_battery.py'), 'utf8');

    // The derivation exists and names both of its sources, so neither can be swapped for
    // a restatement without this failing.
    assert.match(battery, /def unwalked\(/, 'the unverified list is no longer derived — '
        + 'silence is not coverage (Part 8 §2), and a typed claim goes stale');
    assert.match(battery, /"unverified": unwalked\(\)/,
        'the manifest no longer takes the derived list');
    assert.match(battery, /tools\/screens\/screens\.js/, 'the walk registry is not a source');
    assert.match(battery, /src\/lib\/app-routes\.js/, 'the route table is not a source');

    const drive = (kwargs = '') => JSON.parse(py(['-B', '-c',
        'import sys, json; sys.path.insert(0, "tools"); import capture_battery as cb; '
        + `print(json.dumps(cb.unwalked(${kwargs})))`]));

    // WAY ONE: against this tree. Every screen in the route table has registry rows, so
    // not one of them may appear as missing, and the walked line must count them all.
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

    // WAY TWO: against a registry missing a screen. This is the case the old hand-written
    // sentence existed for, now proven by execution rather than by spelling.
    const stripped = JSON.stringify(screens.replace(/^ {8}id: 'editor--[^']+',$/gm,
        "        id: 'zzz--dropped',"));
    const holed = drive(`screens_js=json.loads(${JSON.stringify(stripped)})`).join('\n');
    assert.match(holed, /'editor' is in the route table .* NO row in the walk registry/,
        'a screen with no registry row is not named — the derivation does not bite');

    // And the one claim no source can derive is still written down, as Ben asked.
    assert.match(real, /states the old corpus never reached/,
        'the corpus line is gone: steam mode, a rendered GHC strip and the DYE2 paths are '
        + 'subjects no registry row can be missing for, so nothing else would say so');
});

/* Wave 5.4, cross-5. `#40 ui-tile-grid` is one of the ten bespoke components this wave
 * composes and `units-language-select-language` is the ONLY screen it ships on, so a
 * registry with no row for that leaf photographs #40 in situ NOWHERE — while
 * `settings--bespoke-cards` looks like it covers the case and is the SKINS grid, `#51
 * ui-card-grid`, a different component. It is also the one bespoke leaf whose layout is
 * genuinely responsive, which is the property two stills at two geometries pin and no
 * source read can. The claim is cross-file on purpose: the leaf id in the registry must
 * be the leaf id the render suite drives, or the two have forked and the picture is of
 * something no test asserts. */
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

    /* The grid is only a grid when it has tiles to place, and the list is the render
     * suite's own — the registry law is "driving the fixture its own render suite
     * drives", and an input the suite never uses makes it a second driver. */
    const tiles = screens.slice(screens.indexOf(`selectLeaf('${LEAF}')`));
    assert.match(tiles.slice(0, 1200), /api\.languages\(\[/,
        'the tile-grid state hands the grid no language list: v1 ships English only (D2), '
        + 'so the frame would be one tile and would pin nothing about the reflow');

    /* And it must NOT decline a geometry. This is the opposite case to
     * settings--search-narrowed: the leaf exists everywhere and the column count is a
     * container answer, so the floor frame is the most informative one in the set. */
    const row = screens.slice(screens.indexOf("id: 'settings--bespoke-tiles'"));
    assert.doesNotMatch(row.slice(0, row.indexOf('\n    },')), /geometries:/,
        'the tile-grid state declares itself out of a geometry — the reflow IS the claim, '
        + 'and the narrow frame is the one that carries it');
});

/* Wave 5.4, cross-8. Each cluster reported its own DELTA correctly and its BASE wrongly
 * ("13 -> 15" for the leaves cluster after the skeleton cluster had already added three;
 * "15 -> 19" chained off that), which is how the next wave inherits a wrong base for the
 * fourth time running. The registry was never wrong — the REPORTED NUMBER was — so this
 * pins the report to the array: the header's ledger must add up and must equal what is
 * actually registered. A wave that adds a row and not a ledger line turns this red. */
test('the registry states its own count, and the count is measured', async () => {
    const fsp = await import('node:fs/promises');
    const screens = await fsp.readFile(path.join(REPO, 'tools/screens/screens.js'), 'utf8');

    const ids = [...screens.matchAll(/^ {8}id: '([^']+)'/gm)].map((m) => m[1]);
    const declared = /REGISTRY STATE COUNT:\s*(\d+)/.exec(screens);
    assert.ok(declared, 'the registry no longer states how many states it holds — the '
        + 'number a wave report copies has to live beside the rows it counts');
    assert.equal(Number(declared[1]), ids.length,
        `the header says ${declared[1]} states and the array holds ${ids.length}`);

    /* The chain, line by line: each row is `<running total>  <who>  (+<delta>)`, and the
     * running totals must be the deltas accumulated onto the first. This is what catches
     * a stale base — the failure was arithmetic, not counting. */
    const block = screens.slice(declared.index, screens.indexOf('CAPTURE FILES ARE A DIFFERENT'));
    assert.ok(block.length > 0 && block.length < 2000, 'the count ledger block is unbounded');
    const ledger = [...block.matchAll(/^ \* {5}(\d+) {2}(.+)$/gm)].map((m) => ({
        total: Number(m[1]),
        who: m[2].replace(/\s{2,}[\s\S]*$/, '').trim(),
        delta: /\(\+(\d+)\)/.test(m[2]) ? Number(/\(\+(\d+)\)/.exec(m[2])[1]) : null,
    }));
    assert.ok(ledger.length >= 2, 'the count ledger in the header is gone or unparseable');
    assert.equal(ledger[0].delta, null, 'the first ledger line is a BASE, not a delta');
    for (let i = 1; i < ledger.length; i += 1) {
        assert.ok(ledger[i].delta !== null, `ledger line ${i} ("${ledger[i].who}") states no delta`);
        assert.equal(ledger[i].total, ledger[i - 1].total + ledger[i].delta,
            `the ledger does not add up at "${ledger[i].who}": ${ledger[i - 1].total} + `
            + `${ledger[i].delta} is ${ledger[i - 1].total + ledger[i].delta}, not ${ledger[i].total}`);
    }
    assert.equal(ledger[ledger.length - 1].total, ids.length,
        'the ledger ends on a number the array does not hold');

    /* The clusters, so the ledger cannot balance while the rows moved between screens. */
    const per = (prefix) => ids.filter((id) => id.startsWith(prefix)).length;
    assert.equal(per('live--'), 6, 'the Live screen no longer has its six rows');
    assert.equal(per('selector--'), 7, 'the profile selector no longer has its seven rows');
    assert.equal(per('settings--'), 10,
        'the Settings cluster is not ten rows — three skeleton, two leaves, five bespoke');
});

test('the token perturbation covers every token it parses', () => {
    const out = JSON.parse(py(['tools/selfcheck.py', '--json']));
    const check = out.checks.find((c) => c.name.includes('token perturbation'));
    assert.ok(check, 'selfcheck no longer reports the perturbation');
    assert.equal(check.ok, true, check.detail.join('\n'));
    // A skipped token makes every property it drives read FROZEN, which is a
    // manufactured theming hole — the exact finding the measurement exists to make.
    assert.ok(!check.detail.some((d) => d.startsWith('UNPERTURBED:')), check.detail.join('\n'));
});
