/**
 * The pure half of the base-element conventions (Wave 0a item #2).
 *
 * `src/components/base.js` imports `lit`, and the vendored Lit bundle throws
 * `HTMLElement is not defined` under node - so the base CLASS and its `css`
 * fragments are the rig's subject (item #4, Gate A, headless Chrome over CDP,
 * against test/fixtures/base-fixture.js), not this file's. What is testable here is
 * the logic in `src/lib/base-conventions.js`, plus two cross-checks that hold the
 * base rules and item #1's token file in step.
 *
 * Executing tests only (A8). Nothing below describes code it does not import, and
 * the two file-reading tests read PRODUCED ARTIFACTS - base.js's CSS and
 * tokens.css's declarations - against an imported registry, which is the whole
 * point of them: a token renamed on one side and not the other is a red test rather
 * than a control that silently loses its focus ring.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    BASE_TOKENS,
    DEFAULT_FOCUS_VARIANT,
    FOCUS_TOKENS,
    FOCUS_VARIANTS,
    HIT_TOKENS,
    PRIVATE_PROPERTY_PREFIX,
    PUBLIC_TOKEN_PREFIX,
    SELECTION_DIALS,
    composeStyles,
    isPrivateProperty,
    isPublicToken,
    mergeAdoptedSheets,
    resolveFocusVariant,
} from '../src/lib/base-conventions.js';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Block comments carry citations that name tokens the RULES do not use. */
const stripBlockComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ---------------------------------------------------------------------- *
 * The focus-ring variant
 * ---------------------------------------------------------------------- */

test('focus variants are exactly the two offsets the spec names', () => {
    assert.deepEqual([...FOCUS_VARIANTS], ['outset', 'inset']);
    assert.equal(DEFAULT_FOCUS_VARIANT, 'outset');
    assert.ok(Object.isFrozen(FOCUS_VARIANTS));
});

test('resolveFocusVariant normalises case and whitespace', () => {
    assert.equal(resolveFocusVariant('inset'), 'inset');
    assert.equal(resolveFocusVariant('  INSET '), 'inset');
    assert.equal(resolveFocusVariant('Outset'), 'outset');
});

test('an unrecognised focus variant falls back rather than blanking the ring', () => {
    // An invisible focus ring is an accessibility defect; a wrong offset is a
    // cosmetic one. A typo must cost the cosmetic failure, never the a11y one.
    for (const bad of ['insett', '', '   ', 'none', 'true', 3, {}, [], null, undefined, NaN]) {
        assert.equal(resolveFocusVariant(bad), 'outset');
    }
});

/* ---------------------------------------------------------------------- *
 * The registries
 * ---------------------------------------------------------------------- */

test('there are exactly five selection dials — Slate\'s four values, plus the weight its RULES carry', () => {
    // Four from slate-tokens.css:188-191, carried unchanged (LAYOUT_SPEC_DRAFT.md §3.9).
    // The fifth is parity surface 2's, and it is what finally makes the fork claim
    // TRUE. Slate writes its selected weight in three rules and no token —
    // slate-components.css:392 (.slate-bank-item, var(--slate-weight-medium)),
    // slate-components.css:265 (.slate-nav-selected, the same with !important) and
    // slate-shell.css:310 (the selected profile-list row, a hardcoded 500) — so a fork
    // that retargets all four dials STILL gets Slate's bolder selected label. That is
    // the rule change in disguise; making the weight a value is the removal of it.
    // ORACLE, all 49 baseline states: Slate paints 100 elements with
    // --slate-selected-face and 95 render 500, the sole exception being .hv-pick-btn /
    // .slate-hv-pick-tag at 600 — which are 600 RESTING too, so their weight is the
    // component's own paint and rides --_ui-rest-weight (base.js), not this dial.
    assert.deepEqual([...SELECTION_DIALS], [
        '--ui-selected-face',
        '--ui-selected-ink',
        '--ui-selected-led',
        '--ui-selected-glow',
        '--ui-selected-weight',
    ]);
    assert.equal(SELECTION_DIALS.length, 5);
    assert.ok(Object.isFrozen(SELECTION_DIALS));
});

test('the base names eleven tokens, all public, none repeated', () => {
    assert.equal(new Set(BASE_TOKENS).size, BASE_TOKENS.length);
    assert.equal(BASE_TOKENS.length, FOCUS_TOKENS.length + SELECTION_DIALS.length + HIT_TOKENS.length + 2);
    for (const token of BASE_TOKENS) {
        assert.ok(isPublicToken(token), `${token} is not a public --ui- token`);
        assert.ok(!isPrivateProperty(token), `${token} must not be private`);
    }
});

test('public and private custom properties are told apart mechanically', () => {
    assert.equal(PUBLIC_TOKEN_PREFIX, '--ui-');
    assert.equal(PRIVATE_PROPERTY_PREFIX, '--_ui-');
    assert.ok(isPublicToken('--ui-steel'));
    assert.ok(!isPublicToken('--_ui-focus-offset'));
    assert.ok(isPrivateProperty('--_ui-focus-offset'));
    assert.ok(!isPrivateProperty('--ui-steel'));
    // The token-integrity check scans for `var(--ui-`; a private property must
    // never match it, or every component's internals become missing tokens.
    assert.ok(!'--_ui-hit-ink'.includes(PUBLIC_TOKEN_PREFIX));
    for (const name of ['--slate-steel', 'ui-steel', '', null, undefined, 42]) {
        assert.ok(!isPublicToken(name));
        assert.ok(!isPrivateProperty(name));
    }
});

/* ---------------------------------------------------------------------- *
 * The two cross-checks: base.js <-> registry <-> tokens.css
 * ---------------------------------------------------------------------- */

test('base.js names exactly the tokens the registry declares it may', () => {
    const rules = stripBlockComments(read('../src/components/base.js'));
    const referenced = new Set(
        [...rules.matchAll(/var\(\s*(--ui-[a-z0-9-]+)/g)].map((match) => match[1]),
    );
    assert.deepEqual([...referenced].sort(), [...BASE_TOKENS].sort());
});

test('every token the base names is declared in styles/tokens.css', () => {
    const tokens = stripBlockComments(read('../styles/tokens.css'));
    const declared = new Set(
        [...tokens.matchAll(/^\s*(--ui-[a-z0-9-]+)\s*:/gm)].map((match) => match[1]),
    );
    for (const token of BASE_TOKENS) {
        assert.ok(declared.has(token), `${token} is named by base.js but not declared in tokens.css`);
    }
});

/* Four of the five dials carry a colour or a length that a theme repaints; the fifth,
 * --ui-selected-weight, is a font-weight and is theme-invariant. Derived from the
 * registry rather than listed, so adding a dial cannot silently escape either check. */
const COLOUR_BEARING_DIALS = SELECTION_DIALS.filter((dial) => dial !== '--ui-selected-weight');

test('the COLOUR-BEARING dials and the ring ink are declared in BOTH theme blocks', () => {
    // The base rules paint selection and focus in every theme, so a colour-bearing
    // token missing from the dark block would leave one theme unpainted. This is
    // the base's slice of guard 4 (SCOPE Part 2 §7) until item #4 generalises it.
    // Comments stripped first: tokens.css quotes `[data-theme="dark"] ...` inside an
    // ORACLE citation in the LIGHT palette, and splitting on the raw text would put
    // half the light block on the dark side of the seam.
    const tokens = stripBlockComments(read('../styles/tokens.css'));
    const darkIndex = tokens.indexOf('[data-theme="dark"]');
    assert.ok(darkIndex > 0, 'tokens.css has no dark block');
    const light = tokens.slice(0, darkIndex);
    const dark = tokens.slice(darkIndex);
    for (const token of [...COLOUR_BEARING_DIALS, '--ui-steel']) {
        const declaration = new RegExp(`^\\s*${token}\\s*:`, 'm');
        assert.match(light, declaration, `${token} missing from the light block`);
        assert.match(dark, declaration, `${token} missing from the dark block`);
    }
});

test('the WEIGHT dial is declared exactly once, because a weight is theme-invariant', () => {
    // tokens.css's own rule, stated at the head of the dark block: "Only
    // colour-bearing tokens are redeclared. Geometry, type, motion, z-index and
    // density are theme-invariant and appear exactly once, above." A font-weight does
    // not change with the ground it sits on, so redeclaring --ui-selected-weight in
    // both palettes to satisfy the symmetry check above would be two copies of one
    // number — the thing §2.3 bans — dressed up as theme support.
    const tokens = stripBlockComments(read('../styles/tokens.css'));
    const declarations = [...tokens.matchAll(/^\s*--ui-selected-weight\s*:/gm)];
    assert.equal(declarations.length, 1, '--ui-selected-weight is declared more than once');
    assert.ok(declarations[0].index < tokens.indexOf('[data-theme="dark"]'),
        '--ui-selected-weight must be declared above the dark block, with the other '
        + 'theme-invariant tokens');
});

/* ---------------------------------------------------------------------- *
 * Adopted stylesheets
 * ---------------------------------------------------------------------- */

const sheetA = { id: 'lit-own' };
const sheetB = { id: 'uplot' };
const sheetC = { id: 'easymde' };

test('a vendor sheet lands before the component\'s own so the component wins ties', () => {
    assert.deepEqual(mergeAdoptedSheets([sheetA], [sheetB]), [sheetB, sheetA]);
    assert.deepEqual(mergeAdoptedSheets([sheetA], [sheetB], { position: 'after' }), [sheetA, sheetB]);
});

test('adopting the same sheet twice is a no-op, in both positions', () => {
    // adoptStyleSheet may be called on every update. An array that grows by one
    // sheet per render is a leak nothing on the page reports.
    const once = mergeAdoptedSheets([sheetA], [sheetB]);
    const twice = mergeAdoptedSheets(once, [sheetB]);
    assert.deepEqual(twice, once);
    const after = mergeAdoptedSheets([sheetA, sheetB], [sheetB], { position: 'after' });
    assert.deepEqual(after, [sheetA, sheetB]);
});

test('merging never mutates what Lit already put in the root', () => {
    const existing = [sheetA];
    const merged = mergeAdoptedSheets(existing, [sheetB]);
    assert.deepEqual(existing, [sheetA]);
    assert.notEqual(merged, existing);
});

test('merging tolerates an absent or array-like adoptedStyleSheets', () => {
    assert.deepEqual(mergeAdoptedSheets(undefined, [sheetB]), [sheetB]);
    assert.deepEqual(mergeAdoptedSheets(null, [sheetB]), [sheetB]);
    assert.deepEqual(mergeAdoptedSheets([sheetA], undefined), [sheetA]);
    // ObservableArray in Chrome: array-LIKE, not an Array.
    const arrayLike = { length: 1, 0: sheetA, [Symbol.iterator]: Array.prototype[Symbol.iterator] };
    assert.deepEqual(mergeAdoptedSheets(arrayLike, [sheetB]), [sheetB, sheetA]);
});

test('duplicates within one incoming batch collapse, and order is kept', () => {
    assert.deepEqual(mergeAdoptedSheets([], [sheetB, sheetC, sheetB]), [sheetB, sheetC]);
    assert.deepEqual(mergeAdoptedSheets([sheetA], [null, undefined, sheetC]), [sheetC, sheetA]);
});

test('an unknown position is refused rather than silently guessed', () => {
    assert.throws(() => mergeAdoptedSheets([], [sheetB], { position: 'first' }), RangeError);
});

/* ---------------------------------------------------------------------- *
 * Style order — the second leg of zero-!important
 *
 * Five base declarations cannot be wrapped in :where() because they are :host
 * rules, and :host carries a real (0,1,0). A component's own :host rule TIES with
 * them, so source order is the entire difference between the documented opt-out
 * (`:host { container-type: normal }`) working and doing nothing.
 * ---------------------------------------------------------------------- */

const BASE = { id: 'base' };
const ownA = { id: 'ownA' };
const ownB = { id: 'ownB' };

test('the base styles come first, and stay first however the subclass spelled it', () => {
    assert.deepEqual(composeStyles(BASE, [ownA, ownB]), [BASE, ownA, ownB]);
    // Belt and braces, spread LAST — the spelling Lit's own dedupe inverts.
    assert.deepEqual(composeStyles(BASE, [ownA, ownB, BASE]), [BASE, ownA, ownB]);
    // Belt and braces, spread FIRST.
    assert.deepEqual(composeStyles(BASE, [BASE, ownA, ownB]), [BASE, ownA, ownB]);
    // In the middle, and twice.
    assert.deepEqual(composeStyles(BASE, [ownA, BASE, ownB, BASE]), [BASE, ownA, ownB]);
});

test('composeStyles is the fix for Lit\'s reverse-order dedupe, and this is that dedupe', () => {
    // vendor/lit.js, `finalizeStyles`, transcribed: it dedupes on the REVERSED array,
    // so a repeated sheet keeps its LAST original position. The second line is the
    // defect: base LAST, and every :host opt-out in the library silently stops
    // working for the author who spread the base styles at the end of their list.
    const litFinalize = (styles) => {
        const out = [];
        if (Array.isArray(styles)) {
            for (const entry of new Set(styles.flat(Infinity).reverse())) out.unshift(entry);
        } else if (styles !== undefined) out.push(styles);
        return out;
    };
    assert.deepEqual(litFinalize([BASE, [ownA, ownB]]), [BASE, ownA, ownB]);
    assert.deepEqual(litFinalize([BASE, [ownA, ownB, BASE]]), [ownA, ownB, BASE], 'base LAST — the defect');

    // Composed first, Lit's dedupe has nothing to reorder: base first in both.
    assert.deepEqual(litFinalize([composeStyles(BASE, [ownA, ownB])]), [BASE, ownA, ownB]);
    assert.deepEqual(litFinalize([composeStyles(BASE, [ownA, ownB, BASE])]), [BASE, ownA, ownB]);
});

test('composeStyles flattens and tolerates the shapes Lit tolerates', () => {
    assert.deepEqual(composeStyles(BASE, [[ownA], [[ownB]]]), [BASE, ownA, ownB]);
    assert.deepEqual(composeStyles(BASE, ownA), [BASE, ownA], 'a bare CSSResult, not an array');
    assert.deepEqual(composeStyles(BASE, undefined), [BASE], 'a component with no styles of its own');
    assert.deepEqual(composeStyles(BASE, []), [BASE]);
    assert.deepEqual(composeStyles(BASE, [ownA, null, undefined, ownB]), [BASE, ownA, ownB]);
    assert.deepEqual(composeStyles([BASE], [ownA]), [BASE, ownA], 'the base may itself be a list');
});

test('composeStyles never mutates what the subclass declared', () => {
    const declared = [ownA, BASE];
    const composed = composeStyles(BASE, declared);
    assert.deepEqual(declared, [ownA, BASE]);
    assert.notEqual(composed, declared);
});

test('base.js routes finalizeStyles through composeStyles, not through Lit\'s dedupe', () => {
    // A source read, deliberately: the class itself cannot be imported under node
    // (it imports lit). The RENDERED consequence is pinned in
    // test/render/base-fixture.render.test.mjs against <base-fixture-spread>.
    const source = read('../src/components/base.js');
    assert.match(source, /finalizeStyles\(styles\)\s*\{\s*\n\s*return super\.finalizeStyles\(composeStyles\(baseStyles, styles\)\);/);
});
