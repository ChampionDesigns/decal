# test/harness/ — the rendering-test harness

Headless Chrome over CDP, turned from a measurement rig into a test runner.


A rendering test **mounts a component in a real engine and asserts on
`getComputedStyle`, box geometry and behaviour — never on source text**. Logic tests
stay plain `node:test` with no browser.

## The five-line version

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, BENCH, FLOOR } from './harness/index.js';        // from test/
import { assertTokenDrill, assertFocusUnclipped } from './harness/assertions.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('the ring is the token ring', () => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount('<ui-button>go</ui-button>', ['/src/components/ui-button.js']);
    await assertFocusUnclipped(page, 'ui-button >>> button');
}));
```

One `launch()` per test file, one page per test. Run the file with `node --test`
like any other suite.

## What you get

| | |
|---|---|
| `launch({ geometry, theme })` | a `Browser` — its own Chrome, its own static server |
| `browser.newPage({ geometry, theme })` / `withPage(opts, fn)` | a `Page` |
| `page.mount(markup, [modules])` | import the modules, put the markup in `#mount`, wait for it to settle |
| `page.goto('/tools/gallery/index.html')` | any page on the served repo root |
| `page.computed(sel, props, { pseudo })`, `page.prop(sel, prop)` | `getComputedStyle` |
| `page.box(sel)`, `page.metrics(sel)` | `getBoundingClientRect`; scroll/overflow numbers incl. the scrollbar gutter |
| `page.focusGeometry(sel)` | the ring's numbers plus every clipping ancestor, through shadow roots |
| `page.tokenValue(n)`, `page.resolveToken(n, prop)`, `page.setToken(n, v)` | the token drill's two halves |
| `page.click(sel)`, `page.press(key)`, `page.focusVisible(sel)` | **real** input, through Chrome's own hit test |
| `page.dispatch(sel, type, init)` | a synthetic in-page event, when that is what you mean |
| `page.recordEvents(sel, types)` / `page.recordedEvents()` | what a component EMITTED |
| `page.setStyle(sel, props)` | shrink a container, force a state |
| `page.evalFn(fn, ...args)`, `page.eval(expr)` | the escape hatch |
| `page.screenshot()` | a PNG — the battery's primitive, not the harness's |

### The selector dialect

Shadow DOM means `document.querySelector('#plain')` finds nothing. Every selector is
a piercing path, one `>>>` per shadow boundary:

```
'base-fixture >>> #plain'
'live-screen >>> chart-card >>> canvas'
```

This is the same identity the capture battery records as an *anchor path*
(adaptation 1); `page.anchorPath(sel)` produces one from an element.

### Geometry

`BENCH` = **1281×801 @ deviceScaleFactor 1.5** — the bench truth, and the default.
`FLOOR` = **1000×600 @ dsf 1** — for container behaviour.
`DESKTOP` = 1920×1200 @ dsf 1 — the capture matrix and the geometry the earlier
measurements were taken at. Not a harness default.

"The old probes ran 1920×1200 at dpr 1, which is precisely how every dpr-1.5 raster
surprise stayed invisible until the tablet."

## The four standing assertions

In `assertions.js`, each answering a recorded failure:

* `assertTokenDrill(page, { token, value, selector, property })` — set a token on
  `:root`, assert the rendered value **moves**, lands on the token's new value, and
  **comes back** when the override is removed. Pass `read` for anything
  `getComputedStyle` cannot see (a canvas pixel, for the chart-channel drill);
  pass `expectLanding: false` when the token is only a component of the property (a
  length inside a `box-shadow`).
* `assertOneSelectionTreatment(page, { selected, unselected })` — face, ink, LED and
  glow all come from the four dials, the element really carries a selection state,
  and moving the face does not touch the unselected sibling. The LED and glow are read
  from the **last** shadow segment, via the exported `shadowSegments(value)`:
  `selectionSurface` composes rather than replaces, so anything in front of the dial's
  own segment is the component's resting paint arriving through `--_ui-rest-shadow`.
* `assertScrollFloor(page, { selector, squeeze, minBlockSize })` — squeeze it, assert
  it overflows, does **not** clip silently, shows a real scrollbar gutter, and stops
  at its floor.
* `assertFocusUnclipped(page, selector)` — the ring is `--ui-focus-w` / `--ui-steel`
  at one of the two token offsets, and no ancestor (through shadow roots) clips it.
  A clipped focus ring, as a computed-style assertion.

Plus `assertHitFloor(page, selector, { mode })` for the shared hit-area utility.

## Parallel safety is a property of the rig, not a builder discipline

Ten or sixteen builders run their suites at once. Every `launch()` takes

* an **ephemeral CDP port** — `--remote-debugging-port=0`, and Chrome's chosen port
  is read back from `DevToolsActivePort`. Stronger than bind-a-socket-and-close-it:
  there is no window in which another process can take the number;
* a **fresh `mkdtemp` user-data-dir**, removed on `close()` and again on process exit;
* an **ephemeral static-server port** (`listen(0)`).

`test/harness-selftest.test.mjs` runs two instances concurrently and asserts all
three differ, that both work at different geometries, and that both profiles are gone
afterwards.

## Three things that are deliberate

**Every page turns focus emulation on** (`Emulation.setFocusEmulationEnabled`, in
`newPage()`). A tab opened through `Target.createTarget` is not reliably the browser's
focused target, and an unfocused document is `:focus` but never `:focus-visible` —
Chrome computes `outline-style: none` and every ring assertion fails for a reason
nothing in the failure names. Measured before the fix: **8 failures in 10 isolated runs
of `base-fixture.render.test.mjs`**, always in the second geometry block, and green
under `node --test test/` where concurrent load happened to hide it. `focusVisible()`
verifies the modality afterwards rather than assuming it, so a lapse is reported where
it happens.

**Chrome is not launched with `--hide-scrollbars`**, although every capture rig in
this family sets it. The scroll-floor assertion measures the scrollbar by the gutter
it takes; hiding scrollbars would make that assertion pass on a silently clipped
region.

**The mount document is derived from `index.html`, not copied.** `server.js` parses
the importmap and the stylesheet links out of the real document at serve time, so a
rendering test resolves `lit` through the same importmap and reads the same three
global sheets the app will. A copy would drift silently the first time a module is
vendored; if `index.html` loses its importmap this throws instead.

## The dependency budget is zero

No `node_modules`. `ws.js` is a ~150-line RFC 6455 client because Node 20.20 has
`WebSocket` only behind `--experimental-websocket`, and a flag every future
`node --test` has to remember is a worse dependency than the frame handling.

## Files

| | |
|---|---|
| `index.js` | `launch()`, `Browser`, `Page` — the file a test imports |
| `assertions.js` | the four standing assertions |
| `geometry.js` | `BENCH`, `FLOOR`, `DESKTOP`, `CAPTURE_MATRIX` |
| `server.js` | the ephemeral static server and the generated mount document |
| `cdp.js` | Chrome launch (ephemeral port, fresh profile) and the CDP connection |
| `page-helpers.js` | the in-page helper blob, as a string |
| `ws.js` | the WebSocket client |

None of these contains a `node:test` suite; `node --test test/` imports them as
zero-test files, which is why nothing here runs at import time.

## The open question is settled

The harness decision — headless Chrome over CDP — is recorded in
recorded as an open question, fixed before the first component's
tests were written, because a harness swap invalidates the mechanics of every
rendering test after it.
