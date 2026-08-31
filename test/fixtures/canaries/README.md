# test/fixtures/canaries/

**Every file in this directory violates a rule on purpose.** They are the canaries
The CSS guards are tested against: "every guard ships with a canary — a fixture that
deliberately violates the rule and a test asserting the guard fails on it. All three
old-guard failures were guards that silently stopped covering their target"
(the CSS guards).

They are handed forward from the base conventions to item #4 (the
enforcement rig), which owns the guards themselves. Item #4 may add more.

| File | Violates | Guard it feeds |
|---|---|---|
| `colour-literal.js` | a raw colour literal in an authored `css` template | guard 3, the colour-literal guard |
| `important.js` | `!important` in component styles | |
| `font-face.js` | `@font-face` inside a component | guard 2 ( 2) |
| `private-palette.js` | a `--ui-*` colour re-declared inside a component | guard 4 |
| `html-style-literal.html` | colour literals in a `<style>` element **and** in a `css` template inside an inline `<script>` | guard 3, on the HTML scan surface |
| `viewport-unit.js` | a component sizing itself from the viewport (`vh`/`vw`/`dvh`) | guard 5, the viewport-unit guard (the fit's own rule) |
| `lost-stylesheet.js` | a `css` template closed early by a stray backtick, so every rule after it leaves the scan | guard 6, the lost-stylesheet guard |
| `a8-source-text.js` | a test that reads the **source text** of a stylesheet and a component module and asserts on it — in all three shapes the scanner resolves (a literal in the read's own arguments, a local read helper, a local path binding walked by a `for…of`) | `scripts/a8-source-text.js` |

**The scan roots are `src/`, `styles/`, `tools/` and `index.html`.** These files are
outside all of them, and a guard that walks `test/` without excluding this directory
will fail the build on its own canaries — which is itself worth a test.

**The a8 guard does walk `test/`**, because tests are what it is about — so it carries
`DEFAULT_EXCLUDE = ['test/fixtures/canaries']` and `test/a8-source-text.test.mjs` passes
`exclude: []` to point the scan back at this directory. Same rule, stated in the one
place it had to be different.

## The node-safe shape

Every file here — and `../base-fixture.js` — wraps its body in
`if (typeof HTMLElement !== 'undefined')` and imports `lit` dynamically. That is not
style: Node's test runner treats **every** `.js` file under a directory called
`test/` as a test file, and Node 20 has no `--test-exclude`. Without the guard,
`node --test test/` imports each of these, fails to resolve the bare `lit` specifier
(there is no `node_modules` — the importmap in the served document is the whole
module-resolution mechanism) and reports five failing "tests" for files that contain
none. With it they are no-ops under node and unchanged in the browser. Measured both
ways: 158/163 before, 163/163 after.

Every browser-only file a later wave adds under `test/` needs the same shape.

## Two construction notes the guards must honour

1. **Strip comments before scanning.** `src/components/base.js` writes the word
   `!important` a dozen times in prose, explaining why it is never used, and quotes
   The previous skin's `authored ... !important=yes` measurement lines. A guard that greps the raw
   file fails on the file that documents the rule. Same for colour literals: the
   base and the token file both quote measured `rgb(...)` values in citations.
2. **Parse the `css` tagged templates, not just `.css` files** (the guards' wording:
   "scan by construction not by allowlist"). Most of these canaries hide their
   violation inside a `css` template literal in a `.js` file, which is where almost
   all authored CSS lives in this tree. `html-style-literal.html` covers the third
   surface: a hand-written HTML document, where CSS can sit in a `<style>` element or
   in a `css` template inside an inline `<script>`. `.html` is not a `.js` file, so
   node's test runner ignores it and it needs no node-safe wrapper.
