# vendor/

Pinned third-party code. **Vendored means pinned, licensed, and re-derivable**
(SCOPE Part 2 §2): every file sits beside its licence, and the table below records
exactly where each byte came from so a reader can re-derive it.

**One file is a FORK and is edited on purpose**: `reconnecting-websocket.js` carries
two local bug fixes that predate this tree (A11 — the patches are the value) and, since
wave 0b, three mechanical changes that make it an ES module and DOM-free. Every one of
the five is named in the file itself and again below. Nothing else here is hand-edited,
and `iro.js` may never be (MPL-2.0, see the licence section).

## What is here

| File | Upstream | Version | Licence | sha256 |
|---|---|---|---|---|
| `lit.js` | [lit](https://lit.dev) | 3.3.3 | BSD-3-Clause (`lit.LICENSE`) | `42c9acdb6a2635f53fb2b90062219e0383ea4db46f495688bdc83587db3d6c07` |
| `uPlot.esm.js` | [uPlot](https://github.com/leeoniya/uPlot) | 1.6.32 | MIT (`uPlot.LICENSE`) | `5dd9b3281aa64b461b42d9945f6adb2649d346502b12281a9ae0d46599a80eba` |
| `uPlot.min.css` | uPlot | 1.6.32 | MIT (`uPlot.LICENSE`) | `df630c6a8d6f8eeaff264b50f73ce5b114f646ffd9a0bb74f049b0a00135fa04` |
| `iro.js` | [@jaames/iro](https://iro.js.org) | 5.5.2 | **MPL-2.0** (`iro.LICENSE`) | `772d6f275735fa4de822873e4cfcb18bf7e5a75604d08a0a3fed241bc4c04d4d` |
| `easymde.min.js` | [easymde](https://github.com/Ionaru/easy-markdown-editor) | 2.21.0 | MIT (`easymde.LICENSE`) | `2c06bddfd0c89176db08ccf9d42e2beaa9b4f1a4ff8fb2ec0bf1bed25ce08e05` |
| `easymde.min.css` | easymde | 2.21.0 | MIT (`easymde.LICENSE`) | `6eee36340432776d682e7372ec4a7eb29be4fdb3ffada32c0bfa5e31a5ef34a2` |
| `reconnecting-websocket.js` | Joe Walnes, 2010-2012, **+2 local patches, +3 mechanical changes (wave 0b)** | n/a (vendored fork) | MIT (`reconnecting-websocket.LICENSE`) | `f1ff2959142234a9cbeb6f4739080b1b12a9fa7bd8858bb45faa889e98fee1d8` |

The font is not here: `fonts/Geist-Variable.ttf` (OFL 1.1, `fonts/GEIST_LICENSE.txt`).

## Provenance, file by file

**`lit.js`** - a single-file ESM bundle, because lit@3 publishes no such artifact:
its npm `index.js` re-exports `lit-element`, `lit-html` and `@lit/reactive-element` by
bare specifier, and jsDelivr's `+esm` and esm.sh's bundle both leave at least one
external `import` behind, which would make the app fetch a CDN at run time. Built
locally instead, from the published tarballs, and verified to contain no `import`
of anything:

```
npm install lit@3.3.3 esbuild@0.25.0
echo 'export * from "lit";' > entry.js
esbuild entry.js --bundle --format=esm --minify --target=es2022 \
        --legal-comments=none --outfile=lit.js
```

15,361 bytes. Bundles `lit-html@3.3.3`, `lit-element@4.2.2`,
`@lit/reactive-element@2.1.2` - all BSD-3-Clause, same copyright holder, so
`lit.LICENSE` (lit's own, byte-identical to lit-element's and reactive-element's)
covers the whole bundle. It exports lit's core entry only: `LitElement`, `html`,
`css`, `svg`, `render`, `nothing`, `noChange` and friends. It does **not** carry
`lit/directives/*` (`classMap`, `styleMap`, `repeat`, `ifDefined` ...). The first
component that needs one adds `vendor/lit-directives.js` and one importmap line;
nothing here has to change.

**`uPlot.esm.js`** - the **ESM** build, not the global-installing `uPlot.min.js` the
current skin loads with a bare `<script>` (`CARRY_FORWARD.md` Gate 5). Byte-identical
to `uplot@1.6.32`'s `dist/uPlot.esm.js` on npm (verified by sha256 against the
tarball).

**`uPlot.min.css`** - byte-identical to the same tarball's `dist/uPlot.min.css`.
**It is deliberately NOT linked from `index.html`.** It must be adopted into each
chart component's shadow root via `static styles`; without it the chart renders
pixel-perfectly and is **completely dead to the touch** (`cursor.idx = null`) - the
defect that survives review, measured in `layout/uplot-shadow-spike.md` Rule 1.

**`iro.js`** - the **ESM** build (`dist/iro.es.js` from `@jaames/iro@5.5.2`), not the
UMD `iro.min.js` the current skin loads as a global. Self-contained: it bundles its
own preact and imports nothing. The npm package's `dist/iro.min.js` is byte-identical
to the current skin's `src/vendor/iro.min.js`, which is how the version was pinned.
Kept because the LED live preview stays (D7).

**`easymde.min.js` / `.css`** - byte-identical to `easymde@2.21.0`'s dist files on
npm, which are in turn byte-identical to the current skin's copies. Still a **UMD
build that installs a global `EasyMDE`**; importing the specifier evaluates it for
that side effect. The notes editor (component #55) keeps it.

**`reconnecting-websocket.js`** - copied out of the current skin's `src/modules/`,
which is where it should never have been: it is third-party code with local edits,
filed as if it were app code (A11; `CARRY_FORWARD.md` UNCLEAR #4 records the
misfiling). It arrived here in wave 0a byte-identical to the skin's copy
(`b61355bf4e8717b01eb7324f76c4b8b52fc3d8e0158a8c7708732e903fa4e786`), and **wave 0b
made the three mechanical changes that were owed** — they are edits to vendored code,
so they are listed here rather than left to be rediscovered by diff:

1. **UMD -> `export default`.** The wrapper (`global.ReconnectingWebSocket = factory()`)
   is gone; the module exports the constructor as `default` and as a named
   `ReconnectingWebSocket`, plus the four readyState constants. This was a hard
   prerequisite, not tidy-up: as UMD the file **threw on import** (measured below).
2. **DOM-free.** `document.createElement('div')`-as-EventTarget and
   `document.createEvent('CustomEvent')` are replaced by a ~20-line listener registry
   over plain event objects. The public surface is unchanged — `addEventListener`,
   `removeEventListener`, `dispatchEvent`, the five `on*` properties, `isReconnect` on
   the open event — and a listener that throws still does not abort the dispatch, which
   the DOM used to guarantee for free. This is what makes the file importable under
   `node --test` and safe inside a shadow root.
3. **The WebSocket implementation is injectable** (`options.WebSocket`, defaulting to
   `globalThis.WebSocket`), and **absence is now an explicit throw**. Upstream's
   `if (!('WebSocket' in window)) return;` made the *factory* return undefined, so the
   failure surfaced later as "X is not a constructor" somewhere unrelated. Injection is
   also what lets `test/reconnecting-websocket.test.mjs` drive the two patches with a
   fake socket, and what removes the last `window` reference.

The two behavioural patches are **untouched** and are pinned by tests; nothing else in
the file's logic changed. `var` became `const`/`let` and the anonymous callbacks became
arrows where that was purely mechanical, so the diff against upstream reads as the five
changes above and nothing more.

### Measured, not assumed: what each specifier does today

Run `realine-run/waves/0a/verify_repo_layout.py` to reproduce. Loading `index.html`
in headless Chrome at 1281x801 @ dsf 1.5 and at the 1000x600 floor and dynamically
importing every importmap specifier gives:

| Specifier | Result |
|---|---|
| `lit` | named exports (`LitElement`, `ReactiveElement`, `CSSResult`, `css`, `html` ...) |
| `uplot` | `default` |
| `iro` | `default` |
| `easymde` | evaluates for side effect; installs `window.EasyMDE` |
| `reconnecting-websocket` | **threw** at wave 0a - `default` since the 0b conversion |

**`import 'reconnecting-websocket'` threw at wave 0a — FIXED in 0b by mechanical
change 1, and recorded because the failure mode is instructive.** The message was worth
reading literally: `Cannot set properties of undefined (setting 'ReconnectingWebSocket')`.
The UMD wrapper is invoked as `})(this, function () {...})`, and top-level `this` in
an ES module is `undefined`, not the global object - so the `global.ReconnectingWebSocket
= factory()` branch assigns to `undefined`. EasyMDE's wrapper takes a different route
and survives; this one does not. **The `export default` conversion is therefore a hard
prerequisite for the data layer, not tidy-up.** The importmap entry is kept because it
is the stable address either way, and because the alternative - a `<script>` tag - is
exactly the misfiling A11 exists to end.

### The two local patches (A11) - they must survive any replacement

The behaviour is not optional: a browser socket that closes - tablet sleep, wifi
drop, ReaPrime restarting - can only be re-opened by the client, and ReaPrime's own
docs put that responsibility on the client (`doc/Api.md:492-493`). Both patches are
correct bug fixes, both are marked `LOCAL PATCH` in the file:

1. **`LOCAL PATCH 1`, in `open()` - a `close()`d socket must stay closed.** `close()` sets
   `forcedClose` but only calls `ws.close()` `if (ws)`, and between reconnect
   attempts `ws` is null (onclose nulls it and arms a `setTimeout -> self.open(true)`).
   A `close()` landing in that window therefore closed nothing and cancelled nothing,
   and `open()` never consulted `forcedClose` - so the pending timer opened a
   brand-new socket on behalf of an instance its owner had already discarded and
   could no longer reach: a permanently-open, silenced, unownable socket. The patch
   makes `open()` return early when `forcedClose` is set.
2. **`LOCAL PATCH 2`, in `close()` - `readyState` must not lie.** In the same window
   there is no underlying socket whose `onclose` can move the instance to `CLOSED`, so
   it reported `CONNECTING` for ever - now doubly untrue, since patch 1 means it will
   never reconnect. The patch sets `self.readyState = CLOSED`.

Line numbers are deliberately not quoted here any more (they moved with the 0b
conversion, and would move again): **grep `LOCAL PATCH`**.

If this module is ever swapped for a maintained library, **re-apply both behaviours
as tests first** (`CARRY_FORWARD.md` UNCLEAR #4). Those tests now exist and are
executable: `test/reconnecting-websocket.test.mjs` fails against stock upstream on both
patches, drives everything through an injected fake socket, and additionally asserts
that the code (comments stripped) contains no `document.`/`window.` — so a future
"tidy-up" that reinstates the DOM event target trips a test rather than a tablet.

**One thing deliberately NOT fixed**, because it is neither patch and vendored code is
not a place to improvise: `open(reconnectAttempt)` constructs the socket **before** it
checks `maxReconnectAttempts`, so the cap leaks one socket per attempt past the limit.
Decal never sets `maxReconnectAttempts` — the bounded-attempt policy for endpoints
that can never open (a plugin that is not loaded) lives in `src/data/rea-sockets.js`
rule G, which counts attempts itself and calls `close()`. If a future change does want
the option, fix the ordering here and add the test in the same commit.

## Licence compatibility (E3)

The template is MIT (`../LICENSE`). Every vendored dependency is compatible with
distributing this tree under MIT, and with ReaPrime's GPL-3.0 (see below):

- **MIT** - uPlot, EasyMDE, reconnecting-websocket. Permissive, no conditions beyond
  attribution, which the per-file licences here satisfy.
- **BSD-3-Clause** - Lit. Permissive; the third clause forbids using the copyright
  holder's name to endorse, which nothing here does.
- **MPL-2.0** - iro. **SCOPE Part 2 §2 says "all MIT/BSD-3/OFL"; that is wrong about
  iro, which is Mozilla Public License 2.0.** It is still fine, and the reason is
  worth writing down rather than re-deriving: MPL-2.0 is *file-scoped* copyleft.
  §3.3 explicitly permits distributing the covered file as part of a Larger Work
  under different terms, provided the covered file itself stays under MPL-2.0 and
  its source is available - which is exactly what `vendor/iro.js` is: unmodified,
  in source form, beside `iro.LICENSE`. It carries no Exhibit B
  "Incompatible With Secondary Licenses" notice, so it is also GPL-compatible.
  The obligation this creates is small but real: **do not edit `iro.js` in place**;
  if it ever has to be patched, the patched file stays MPL-2.0 and its source must
  ship, exactly as it does now.
- **OFL 1.1** - Geist (`../fonts/`). Bundling the font with the app is permitted;
  it may not be sold on its own and must keep its copyright notice, which
  `fonts/GEIST_LICENSE.txt` is.

**ReaPrime is GPL-3.0** (`LICENSE.txt`, "Decent - A gateway application for Decent
Espresso machines", Copyright (C) 2025-2026 Decent Espresso). MIT is a GPL-compatible
permissive licence, so even the strictest reading - Decal treated as part of a
combined work with ReaPrime - is fine: MIT code may be distributed inside a GPL-3.0
work. In practice the coupling is looser than that. Decal is served as static files
over HTTP and talks to ReaPrime over REST and WebSocket only; it links nothing, and
ships in its own release archive installed through ReaPrime's install-by-URL route.
This is the E3 check that SCOPE Part 8 Risk 11 / Part 9 M15 records as owed, and
its verdict is **clear on both halves: the vendored set is compatible, and so is
ReaPrime's own licence.**
