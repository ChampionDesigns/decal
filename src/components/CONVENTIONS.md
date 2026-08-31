# Component conventions

**Read this file.** Everything a component author has to know about the substrate is
here. Each rule states the measurement or the decision it rests on, so a rule that
surprises you can be checked rather than guessed at.

The mechanism is `src/components/base.js` (Lit base class + the shared `css`
fragments) and `src/lib/base-conventions.js` (its DOM-free half: registries,
normalisation, the adopted-sheet merge).

Why any of this exists, in one sentence: a component library can be well designed *and*
well documented and still end up with five focus treatments, thirteen selection looks and
three copies of the hit-area trick, because **discipline without enforcement decays**. Shadow DOM is the wall. This file is what is inside the wall by default, so the
correct thing is also the free thing.

---

## 1. Extend `UiElement`, never `LitElement`

```js
import { UiElement } from 'src/components/base.js';

class UiKeycap extends UiElement {
 static styles = [css`...your rules...`];
 render() { return html`<kbd class="hit-overlay"><slot></slot></kbd>`; }
}
customElements.define('ui-keycap', UiKeycap);
```

Every component is a Lit element with Shadow DOM. Theming crosses the boundary
through custom properties **only**.

`static styles` does **not** spread `UiElement.styles`. The base overrides Lit's
`finalizeStyles()` hook, so the base rules are prepended for every subclass
automatically — forgetting to spread is not a failure mode that exists. Write only
your own rules.

If you spread `UiElement.baseStyles` anyway it is harmless — the base strips the
duplicate before Lit sees the list, so the base rules stay first in either position —
but it buys nothing. **Do not "fix" `finalizeStyles` to hand the duplicate to Lit.**
Lit dedupes on the *reversed* array and keeps the **last** occurrence, so
`[BASE, [own, BASE]]` comes back `[own, BASE]`: base last, and every `:host` opt-out
in rule 2 silently stops working. Measured against `vendor/lit.js`; pinned by
`test/base-conventions.test.mjs` (`composeStyles`) and by the rendered case in
`test/render/base-fixture.render.test.mjs`.

---

## 2. A component reads its own container, never the viewport

The base puts `container-type: inline-size` and
`display: block` on `:host`, so your `@container` queries resolve against your own
host — the nearest container ancestor of everything in your shadow tree.

**No component writes `@media (width…)`.** The only global queries are the two height
bands, and they live on `:root` in `styles/tokens.css`. This is what makes the
excluded phone-landscape layout cheap to add later.

**The one thing to know:** `container-type: inline-size` applies inline-size
*containment*, so the host's inline size can no longer depend on its contents. That
is right for anything filling a slot and wrong for a control that must shrink to fit
its glyph. Opt out in one line, in your own styles:

```css
:host { container-type: normal; display: inline-grid; }
```

and query an ancestor container instead. `display: block` is in the base for the same
reason: a custom element defaults to `display: inline`, and an inline box with size
containment is a 0×0 box — the failure looks like "my component vanished".

---

## 3. One focus ring

The reference skin ships **five** treatments for one skin
and the component layer's ring reaches only four
classes, so most focusable things have no ring at all.

You get the ring for free. The base applies it to `:host(:focus-visible)`, to
every `:any-link, button, input, select, textarea, summary, [tabindex]` inside your
shadow tree, and to `::slotted(:focus-visible)` — the three places a focusable can be
(rule 3a) — from `--ui-focus-w` / `--ui-focus-offset` with `--ui-steel` as the ink.
**Do not author a second one.**

**Two offsets, one treatment.** A control inside an `overflow: hidden` parent needs
the ring drawn *inside* its own box, or it is clipped — "focus rings
clipped on all four sides by the components they sit inside". Switch a whole
component with the host attribute, or one subtree with the private property:

```html
<ui-stepper focus-ring="inset">
```
```css
.band { overflow: hidden; --_ui-focus-offset: var(--ui-focus-offset-inset); }
```

`UiElement#focusVariant` reports `'outset'` or `'inset'`; an unrecognised attribute
falls back to `outset` rather than blanking the ring — an invisible ring is an
accessibility defect, a wrong offset is a cosmetic one.

**Reusing the ring on something the selector list does not reach** — a wrapper that
should show the ring while an inner input takes focus:

```js
import { focusRing } from 'src/components/base.js';
css`
 .field-wrap:has(:focus-visible) { ${focusRing} }
 .field-wrap input:focus-visible { outline: none; }
`
```

That second line is also the whole story of rule 6: a plain higher-specificity selector,
no `!important` anywhere.

### 3a. The slot contract — a focusable you did not write still gets the ring

A focusable can be in exactly three places, and the base rings all three: the **host**
(`:host(:focus-visible)`), the **shadow tree** (the `:where(:any-link, button, input,
select, textarea, summary, [tabindex])` list), and **slotted in from the light tree**
(`::slotted(:focus-visible)`).

The third one is a rule and not an accident. Neither of the first two can see slotted
content — the selector list is scoped to the shadow tree, and `:has()` walks the DOM
tree rather than the flattened tree, so `.wrap:has(:focus-visible)` never matches a
slotted descendant. Measured before the rule existed (review finding **cross-3**): a
bare `<button>` slotted into `<ui-card>` took Chrome's own `outline: auto` /
`rgb(16, 16, 16)` / `1px` — **a sixth treatment, inside the layer that exists to end the
five**. Twelve of the fourteen elements expose a slot; every one had the hole.

**What this means for you.**

* **Slotting a bare `<button>`, `<a>` or `<input>` is fine.** It gets the one ring, at
 the offset the host is carrying. Nothing is required of the consumer.
* **Slotting a `ui-*` control is also fine, and does not double-ring it.** For two
 normal declarations in different tree contexts the outer tree wins whatever the
 specificity (the CSS Scoping standard, §3.3), so the child takes these declarations rather than its
 own — and they are the identical exported fragment. Its *offset* still follows the
 child, because `--_ui-focus-offset` resolves on the child: a slotted `ui-card` keeps
 `-3px`, and `focus-ring="inset"` keeps working.
* **`::slotted()` matches only top-level assigned nodes.** A focusable buried inside a
 slotted wrapper — `<div slot="trail"><button></button></div>` — is *not* reached, and
 is the light tree's own business. If you slot a wrapper, ring what is inside it in
 your own sheet, or slot the focusable directly.
* **A document rule on the child still wins**, because the document is the outermost
 tree. A consumer that has stated a treatment keeps it.

**Do not re-declare this per component.** `ui-text-field` carries its own copy of the
rule for the adornment slots and that copy is now redundant, not exemplary.

---

## 4. The four selection dials are the only selection treatment

Carried unchanged — the one genuinely re-themable
idea in it. Four values,
zero rule changes, and that only holds because there is **one** selection component:
a bank that bypasses the dials entirely is exactly the decay these rules exist to stop.

```js
import { selectionSurface } from 'src/components/base.js';
static styles = [hitArea, css`...own...`, selectionSurface];
```

| Dial | Painted as |
|---|---|---|---|
| `--ui-selected-face` | the accent, solid | a seated slice | `background-color` |
| `--ui-selected-ink` | on-accent | the channel colour | `color`, and therefore `currentColor` |
| `--ui-selected-led` | `0px` — off | `var(--ui-toggle-led)` | inset `box-shadow` in `currentColor` |
| `--ui-selected-glow` | `0%` — none | ~55 % | `text-shadow` mixed toward transparent |

The state contract is `aria-pressed` /
`aria-selected` / `aria-checked` / `aria-current` / `.is-selected`
Accessibility state and visual
state are the same state, so they cannot drift. In Lit these are reflected reactive
properties.

**Two usage rules, and the second is not optional.**

1. **Put `selectionSurface` last** in `static styles`, after your own rules.
 Structural fragments (`hitArea`) go first; state fragments go last — selection has
 to beat the resting paint. Unlike the base rules it is deliberately *not* wrapped
 in `:where()`: it carries a real (0,1,0) and needs to win.
2. **Paint the resting state with a class, never an id.** An id selector is (1,0,0)
 and beats every attribute selector in the fragment, so a component that writes
 `#tab { background-color: var(--ui-key) }` silently never turns selected —
 measured on the fixture before it was corrected. **Ids are for tests to query by;
 classes are for the cascade.**

**A resting shadow goes in the composition slot, or selection eats it.** `face` and
`ink` are dials replacing dials, but `box-shadow` and `text-shadow` are whole-value
properties: the fragment's declaration replaces your entire shadow list. The first
component that hits this is `ui-bank` (#2), because the seam between two items in a
one-piece bank **is** an inset shadow — `--ui-seam-ink`, measured as
`rgba(30,42,50,0.11) 1px 0px 0px 0px inset`,
winning rule on the adjacent-sibling pair. Declare it
once in the private slot and paint from the slot:

```css
.item + .item {
 --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
 box-shadow: var(--_ui-rest-shadow);
}
```

`selectionSurface` prepends that slot to its own LED, so the seam survives selection
with the LED drawn over it. `--_ui-rest-text-shadow` is the same slot for the glow's
property. Both default to a transparent no-op, so a component that has no resting
shadow is unaffected. They are private (`--_ui-`) and are **not** a fifth dial: they
carry your resting paint, not a theme value. Set them on the element that draws the
shadow — custom properties inherit, so a wrapper would hand the seam to every selected
descendant.

**Disabled is the other state the base paints**: one dial,
`--ui-opacity-disabled`, settling on .38. It reaches
both spellings — `[disabled]` / `[aria-disabled="true"]` inside your shadow tree **and**
the same attributes on the host, which is where the ordinary Lit spelling puts them:

```js
@property({ type: Boolean, reflect: true }) disabled = false;
```

Paint only. Whether the control still *accepts* input is your business, expressed with
the native `disabled` attribute on the real control — the host attribute dims, it does
not disable.

---

## 5. One hit-area utility — ink is separate from the hit floor

Good patterns; make them one
utility rather than three copies." The three copies are components #15 (keycap),
#23 (slider) and #35 (favourite slot); they consume this instead.

`--ui-hit-min: 48px` is physically justified, not taste — "a wet fingertip is about
9 mm; at this panel's density that is ~48px".

```js
import { hitArea } from 'src/components/base.js';
static styles = [hitArea, css`...`];
```

**`.hit-overlay`** — a **leaf** control whose ink is smaller than the floor. A
transparent `::before` centred on the element grows the hit box without moving one
pixel of paint; a pseudo-element's hits belong to its originating element. Both axes
reach the floor by default. Per-axis escape hatches for a control in a
shoulder-to-shoulder row: `--_ui-hit-inline: 100%`, `--_ui-hit-block`.
*Leaf only* — the overlay sits above the element's own content, so an element with
interactive children uses `.hit-pad`.

**`.hit-pad`** — an element whose ink **is** its background (a slider track). The box
becomes the floor, the padding comes out of it (`box-sizing: border-box`), and the
paint is clipped back to the content box, so the track reads as 8 px while the whole
48 px accepts a press. Set `--_ui-hit-ink` to the ink's thickness;
`--_ui-hit-box` overrides the floor where a control needs a taller one.

> **The one trap**:
> *"AFTER the shorthand, which resets it to border-box — that is what turned the
> track into a 32px slab the first time."* `background-clip` is a longhand of the
> `background` shorthand. On a `.hit-pad` element paint with `background-image` /
> `background-color`, **never the `background` shorthand** — or re-declare
> `background-clip: content-box` after it. Base rules cannot defend against this by
> ordering: they come first by design.

The oracle is **disqualified** for two of the three consumers, and that is the point
of the utility. A slot measured at 64×64 with the floor silently not applied, numpad
targets at 32×35 against a 48px floor, and a 32px rating slider are all the same defect.
The keycap is the one that does
reach the floor: the keycap measured 6 elements in 1 state,
five at 48×48, one at 68×48.

### 5a. One visually-hidden treatment — same argument, one section later

```js
import { visuallyHidden } from 'src/components/base.js';
static styles = [visuallyHidden, css`...`];
render() { return html`<span id="a11y" class="a11y">${this.label}</span>`; }
```

`.a11y` is the class; the fragment is structural, so it goes **first**. It labels an
icon-only or ellipsised control for a screen reader without painting anything: a 1px
box with `clip-path: inset(50%)`, still laid out and still announced. Never
`display: none`, `visibility: hidden` or `width: 0` — all three take the text out of
the accessibility tree, which is the one thing it must not do.

The same nine declarations were written three times (`ui-badge`, `ui-keycap`,
`ui-locked-value`) before this export existed. All three were correct; three copies
of correct is the defect, and it is the shape named one section up.
There is no measurement to carry here: `clip-path` and `position` were never captured.

---

## 6. Zero `!important` — and the two mechanisms that make it unnecessary

The reference skin's shell sheet carries **268** and
The old component sheet carries **96**, and every one exists because some other sheet could
reach the same element. Nothing can reach into a shadow root, so the only remaining
reason to write one would be to beat the base rules. Both are removed:

* **Zero specificity.** Every base rule targeting an element inside your shadow tree
 is authored inside `:where(…)`, which contributes nothing. A bare element selector
 already outranks it.
* **Guaranteed order.** `finalizeStyles()` prepends the base rules, so your rules are
 always later and win every tie. This leg is the load-bearing one for the five `:host`
 declarations that *cannot* be wrapped in `:where()` — `display`, `box-sizing`,
 `container-type`, `-webkit-tap-highlight-color` and the private focus offset all
 carry a real (0,1,0) and therefore **tie** with your own `:host` rule. Order is the
 whole difference between rule 2's opt-out working and doing nothing, which is why
 `composeStyles` in `src/lib/base-conventions.js` makes it position-independent
 rather than trusting Lit's dedupe (see rule 1).

**To override a base rule, write the rule.** That is the whole escape hatch. If you
find yourself reaching for `!important`, the cause is one of three things: you are
painting a state at lower specificity than the resting paint (rule 4), you are
fighting your own earlier rule (reorder), or you are trying to style *another*
component from outside — which is not a thing this architecture does. Screens style
components through tokens and each component's documented custom properties, and
there is no mechanism for more.

---

## 7. Tokens in, nothing out

* **Consume `--ui-*`; declare none of your own palette.** Custom properties are the
 only styling that crosses a shadow boundary — that is not a preference, it is the
 mechanism the whole theming story rests on.
* **No private token namespaces shadowing the public ones** — the pattern that
 produced a triple-declared copy of the public palette.
* **Internal geometry uses `--_ui-*`.** The leading underscore is what keeps the
 token-integrity check honest: it scans for `var(--ui-`, and `var(--_ui-` cannot
 match, so a component's internals can never be mistaken for a missing token. A
 private property may reference a public token; it may never carry a colour value.
* **No raw colour literals in authored component CSS** (guard 3). The token
 sheets are the single exempted home.
* **Never declare `@font-face` in a component**, measured: canvas
 text resolves fonts against the *document's* registry, and a shadow-declared face
 never registers — `measureText('0123456789.')` at 20 px gave 105.00 (the
 unknown-family fallback) against 118.50 for the same face in the document, with
 `document.fonts.size === 0`. Use `var(--ui-font-family)`; `styles/document.css` is
 the one place a face may be declared.

The base itself names exactly ten tokens — `--ui-focus-w`, `--ui-focus-offset`,
`--ui-focus-offset-inset`, `--ui-steel`, `--ui-opacity-disabled`, `--ui-hit-min`, and
the four dials. `test/base-conventions.test.mjs` asserts that list against both
`base.js` and `styles/tokens.css`, so a rename on either side is a red test.

---

## 8. Adopting a vendor stylesheet (charts, the notes editor)

The **preferred** form needs nothing from `base.js` — Lit's `static styles` compiles
to `adoptedStyleSheets` and accepts a native `CSSStyleSheet`, and a CSS module import
is static, so the sheet is present before the first render:

```js
import uplotSheet from '../../vendor/uPlot.min.css' with { type: 'css' };
static styles = [uplotSheet, css`...`];
```

This matters more than it looks. A **missing** uPlot sheet does not produce a broken
chart — it produces a chart that is pixel-identical in a screenshot and *completely
dead to the touch* (`cursor.idx = null`, `.u-cursor-x` computing
`position: static; height: 0`, the legend collapsing 900×31 → 80×106;
measured). Any form that *fetches* the sheet has a window in which
the chart has already rendered without it, and that window is invisible to every test
that asserts on pixels.

The fallback, for a WebView without import attributes, is
`loadStyleSheet(url)` + `adoptStyleSheet(root, sheet)` from `base.js`, called in
`firstUpdated` and awaited **before** the first `new uPlot(...)`. It merges rather
than assigns (Lit owns that array), is idempotent, and puts the vendor sheet first so
your rules win ties. `hasAdoptedSheet(root, sheet)` is what your test should assert
on, so "the sheet is adopted" is checked rather than assumed.

---

## 9. Two small rules that will bite you once each

* **No backticks inside a `css` template — including in comments.** A backtick
 terminates the template literal, and the resulting syntax error points at a word in
 your prose, not at the quote.
 (Cost while building this file: two syntax errors.)
* **Ids for querying, classes for the cascade**. Ids in a shadow root are
 cheap and unique, which is exactly why they are tempting and exactly why they break
 state treatments.

---

## 10. Testing your component

* **Pure logic → `node:test`.** DOM-free modules in `src/lib/` test without a
 browser. `src/components/*.js` cannot be imported under node at all: they import
 `lit`, which needs a DOM and is resolved by the served document's importmap, not by
 node.
* **Anything rendered → the render harness** (headless Chrome over CDP,
 computed styles and box geometry, never source text). Standard geometry is the
 bench truth — **1281×801 @ deviceScaleFactor 1.5**, plus the 1000×600 floor.
* **Browser-only files under `test/` need the node-safe shape** —
 `if (typeof HTMLElement !== 'undefined') { … }` with dynamic imports. Node's test
 runner treats *every* `.js` under `test/` as a test file and Node 20 has no
 `--test-exclude`. See `test/fixtures/canaries/README.md`.
* **Two measured facts the rig has to respect**, both found building this:
 1. **Headless Chrome does not focus its own page.** Without CDP
 `Emulation.setFocusEmulationEnabled`, `shadowRoot.activeElement` is correct while
 `el.matches(':focus')` is `false`, so every focus-ring assertion silently reads
 the *initial* outline (`none`, `currentColor`) and a broken ring looks like a
 passing test.
 2. **At dsf 1.5, lengths snap to device pixels.** A 3 px outline computes to
 `2.66667px` (4 device px ÷ 1.5) at the bench geometry and to `3px` at the desk.
 Compare rendered lengths as whole CSS px, not by string equality.
* `test/fixtures/base-fixture.js` is the worked example: every convention above on
 screen at once, with stable ids and a comment per assertion.

---

## 11. What is deliberately *not* in the base

* **No `font-family` / `font-size` / `color` on `:host`.** They are inherited and
 already cross the boundary from `styles/document.css`; restating them would break a
 screen's ability to set them locally.
* **No `--ui-density` arithmetic.** Density multiplies *vertical rhythm only* — band
 heights and row gaps — and never `--ui-control-h` or `--ui-hit-min`, because
 ergonomics is physical. It belongs to whatever lays rows out, not to every leaf.
* **No `touch-action`.** The reason is no longer the one this line used to give
 ("whether pinch-zoom is reachable in the tablet WebView is an open measurement …
 the viewport meta deliberately does not restrict it"). That question was closed on
 A panel once ended up zoomed with no chrome to escape it:
 `index.html`'s viewport meta now says `user-scalable=no, minimum-scale=1,
 maximum-scale=1`, and browser scaling is settled there, in one place, with the
 measurement beside it. `touch-action` stays out of the base for the ordinary
 reason — it is a per-surface answer about which axis a gesture belongs to, not a
 global one. The library has exactly one (`ui-chart-card`'s plot well,
 `touch-action: pan-y`) and it is there because a horizontal scrub was measurably
 being stolen as a pan.
* **No `delegatesFocus`.** Opt in per component where a wrapper should hand focus
 inward: `static shadowRootOptions = { ...UiElement.shadowRootOptions, delegatesFocus: true }`.
 As a global default it produces two rings on one control.
* **No reduced-motion rule.** The honest implementation needs `!important`, which
 rule 6 forbids; when the motion tokens get real consumers this belongs in
 `styles/document.css` or in each animating component.

---

## 12. Checklist before you open a component for review

- [ ] extends `UiElement`; `static styles` carries only your own rules
- [ ] structural fragments first, `selectionSurface` last
- [ ] no `@media (width…)`; container queries only
- [ ] no `!important`; no raw colour literal; no `@font-face`
- [ ] every colour, length and duration is a `--ui-*` token or derived from one
- [ ] internals named `--_ui-*`
- [ ] selection expressed as the aria state; resting paint on a class, not an id
- [ ] hit targets reach `--ui-hit-min` — check the *rendered* box, not the rule
- [ ] a screen-reader-only label uses the `visuallyHidden` fragment, never a fourth copy
- [ ] no second focus ring, and no `::slotted` copy of the base's one (rule 3a)
- [ ] `.hit-pad` painted with background longhands
- [ ] a divider is the seam utility (rule 13), never a per-cell border
- [ ] cleans up on disconnect: observers disconnected, uPlot instances destroyed
- [ ] scroll regions have an explicit floor and a stated overflow;
 hiding the scrollbar is banned

---

## 13. One seam utility — a divider is a gap, not a border

Item #14, which
ships **no element**: *"the good pattern is a 1px grid `gap` over a coloured grid
background, so this becomes a documented layout utility, not an element."*
The per-screen **Separator** maps onto this utility too. The mechanism is
`src/components/seams.js`; this is what is in it.

```js
import { seams } from 'src/components/seams.js';
static styles = [seams, css`...own rules...`]; // structural fragment: FIRST
```

```html
<div class="seam-grid seam-rows seam-line"> <!-- the grid draws the seams -->
 <div class="seam-cell">…</div>
 <div class="seam-cell">…</div>
</div>
```

| Class | What it does |
|---|---|
| `.seam-grid` | `display: grid` + `gap: var(--ui-seam)` + the ground. The gap **is** the divider. |
| `.seam-cols` | Column gap only — the editor matrix's *"column gap as the only vertical rule"* (see). |
| `.seam-rows` | Row gap only — a settings list. |
| `.seam-zone` | Ink `--ui-zone-seam` — the ground **between zones**. The default. |
| `.seam-line` | Ink `--ui-line` — the weight that encloses a control, used between controls. |
| `.seam-strong` | Ink `--ui-line-strong` — the emphasised divider: rail edge, header underline, band top. |
| `.seam-cell` | `--ui-fascia` on a **plain** cell. A cell that is a component paints itself. |

**When the component *is* the grid.** The screen skeletons put the seamed grid on
the **host** — `<live-screen> display:grid; gap:
var(--ui-seam); background: var(--ui-line-strong)`, `:701-703` `<master-detail>
display:grid; gap: var(--ui-seam)` — and a `.seam-grid` rule inside that component's own
shadow styles **can never match its own host**. The fragment therefore ships each of the
seven rules a second time as `:host(…)`; put the classes on the host and they apply:

```js
static styles = [seams, css`...own rules...`];
connectedCallback() { // NOT the constructor — a custom element
 super.connectedCallback(); // constructor must not gain attributes
 this.classList.add('seam-grid', 'seam-strong');
}
```

The parent may set them instead (`<master-detail class="seam-grid seam-line">` in the
parent's template), in which case the **parent's** copy of the fragment paints the host,
because the host element lives in the parent's tree. Both routes are supported and can
never disagree — same declarations, one fragment. Two things to know: for normal
declarations the **outer** tree wins over `:host()` (CSS Scoping), and `:host(.x)` is
**(0,2,0)**, one step above the light-DOM copies — so a bare `:host { display: flex }` in
your own styles does *not* beat `:host(.seam-grid)` even though it is written later. A
component that means to override writes `:host(.seam-grid) { … }` itself.

**Three weights, and this utility owns two.** Seams, edges and zone grounds are three
different weights: one divides a box, one encloses it, and one is the ground between
zones. The last two are this utility's, as `--ui-line` and `--ui-zone-seam`. The first is
not: `--ui-seam-ink` is the inset shadow between segments of a one-piece bank, and a gap
between two panes and a shadow inside one control are different mechanisms. In its place
this utility ships `--ui-line-strong` — a `gap: var(--ui-seam)` over a
`background: var(--ui-line-strong)`.

**Why a gap and not a border.** A border is drawn per cell, so a rule that means "between
cells" has to exclude the first or the last one. Every sibling selector that tries is one
edge case from wrong, and two neighbouring cells can each draw their own, giving a
two-pixel line of two different greys. A grid gap has neither problem: N cells give N-1
seams with no selector at all, and the ink is one value.

The width stays tokenised as `--ui-hairline` so it can become `0.5px`/dpr later.

**Three traps, all measured in `test/render/seams.render.test.mjs`.**

1. **A cell that paints nothing is a hole.** The ground shows through everything not
 painted over it, so a seamed grid of transparent cells is a slab of divider colour.
2. **Leftover track space is also ground.** Fill the tracks, or make the leftover right —
 the page ground is usually the right answer.
3. **A nested seam grid is a cell**, so it names its weight. A weight class is (0,2,0) and
 `.seam-cell` is (0,1,0), so the nested grid wins whatever the source order.

**What this is not.** Not the hairline that *encloses* a box — that is `--ui-border-w`
(itself `var(--ui-hairline)`) with `--ui-line`, declared by whichever component
draws the box; a gap draws lines *between* cells and never around the outside. Not a
spacing utility either: gutters are `--ui-space-*`, and one gap cannot be two widths.

**Outside a shadow root** — the gallery, or any root Lit does not own:

```js
import { adoptSeams } from 'src/components/seams.js';
adoptSeams(); // the document
adoptSeams(shadowRoot); // one root — idempotent, merges, never assigns
```

