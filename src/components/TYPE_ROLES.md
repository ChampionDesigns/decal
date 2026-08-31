# Type roles — the six, and how to use them

Component **#13** of the 57-component inventory, and one of the two wave-1 rows that
ships **no element**:

> Title / heading / caption / body / microcap / numeric. **Dissolves into the token
> layer plus a shared style module rather than an element** — recorded here so the
> inventory stays 57-for-57.

So there is no `<ui-title>`, and one appearing later is a defect, not a convenience.
The two halves of the row are:

* **the token layer** — `styles/tokens.css`: ten fixed UI steps, five fluid
  display steps, FOUR weights (light 300, regular 400, medium 500,
  semibold 600, restored at parity surface 1), `--ui-tracking-cap`, `--ui-measure`, and the
  one family token. This row added none and changed none.
* **the shared style module** — `src/components/type-roles.js`, a `css` fragment
  carrying six classes.

This file is the reference for the second half. `src/components/CONVENTIONS.md` is
still the file to read first; this one is what it points at for type.

---

## Using them

```js
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

class SettingsLeaf extends UiElement {
    static styles = [typeRoles, css`.stack { display: grid; gap: var(--ui-space-4); }`];

    render() {
        return html`
            <div class="stack">
                <h1 class="ui-title">Water</h1>
                <h2 class="ui-heading">Refill kit</h2>
                <p class="ui-caption">What this setting does, in one sentence.</p>
            </div>`;
    }
}
```

Three rules, and they are the whole contract:

1. **Put `typeRoles` first**, with the structural fragments. It is a default layer;
   every rule in it is written to lose a tie (`CONVENTIONS.md` rule 4 — structural
   fragments first, state fragments last).
2. **Use the right element.** A role is paint. A heading is structure, and a screen
   reader reads `<h2>`, not `.ui-heading`. Never fake a heading with a styled `<span>`,
   and never pick a role by size — pick it by what the text *is*, then override the
   size if a screen genuinely needs a different one.
3. **Spacing is the layout's job.** The block roles zero the UA's margins on purpose,
   so a role reads the same on an `<h1>` as on a `<div>`. Space rows with
   `gap: var(--ui-space-*)` on the container.

---

## The six

| Class | Size | Weight | Ink | Also |
|---|---|---|---|---|
| `.ui-title` | `--ui-text-xl` 28px | `--ui-weight-medium` 500 | `--ui-text` | line-height 1.2, margin 0 |
| `.ui-heading` | `--ui-text-lg` 20px | `--ui-weight-medium` 500 | `--ui-text` | line-height 1.3, margin 0 |
| `.ui-caption` | `--ui-text-note` 16px | `--ui-weight-regular` 400 | `--ui-muted` | line-height 1.5, `display: block`, capped at `--ui-measure` (70ch), margin 0 |
| `.ui-body` | `--ui-text-base` 17px | `--ui-weight-regular` 400 | *inherited* | line-height 1.5, margin 0 |
| `.ui-microcap` | `--ui-text-sm` 15px | `--ui-weight-semibold` 600 | `--ui-muted` | line-height 1.2, `text-transform: uppercase`, `letter-spacing: var(--ui-tracking-cap)` |
| `.ui-numeric` | — | — | — | `font-variant-numeric: tabular-nums lining-nums` |

**`.ui-numeric` is a modifier, not a step.** It sets no size, weight, colour or family,
so it composes: `<span class="ui-body ui-numeric">` or, on a big readout, a component's
own font-size rule plus `.ui-numeric`. The numeric class it replaces behaved the same way —
measurement finds its font-size, font-weight and color all "(no declaration — inherited
or initial value)".

**The old ink classes are not carried.** They are ink
switches, not type roles; the ink comes from `styles/document.css` (`--ui-text` on
`html`) and the two roles that deliberately speak quietly carry `--ui-muted`
themselves.

---

## Big numbers: the display scale, which is *not* a seventh role

```css
.readout { font-size: var(--ui-display-md); }   /* your component's own rule */
```
```html
<span class="ui-numeric readout">9.0</span>
```

The five display steps are the **only fluid type in the system**:

```css
--ui-display-xs: clamp(22px, 2.2cqi, 27px);
--ui-display-sm: clamp(24px, 2.5cqi, 30px);
--ui-display-md: clamp(32px, 3.4cqi, 42px);
--ui-display-lg: clamp(34px, 3.6cqi, 45px);
--ui-display-xl: clamp(38px, 4.2cqi, 52px);
```

`cqi` resolves against **the component's own container**, which is why this is not a
shared class: a class would resolve against whatever container happened to be nearest,
and the point of the fluid step is that the gauge cluster sizes its own numbers
Upper bounds are the values in use today; the lower bounds are
a proposal and want a look on the bench.

**The UI scale is never fluid.** Legibility is a floor, and the bench tablet
already renders text ~10 % larger than the desk harness, so that margin is spoken for.

---

## Five declared departures

Each is asserted **as a departure** in `test/render/type-roles.render.test.mjs`, with
both numbers named, so drifting back is a red test rather than a quiet regression.

1. **Zero `!important`.** The reference skin carries one on nearly every declaration in
   Nothing outside a shadow root can reach these rules,
   so the reason is gone.
2. **Every rule is wrapped in `:where()`, and no role declares an alignment.** Two
   mechanisms, because "the loading/empty states are authored centred and
   rendered left-aligned by three shell rules — four call sites affected"
   — needs both.

   `:where()` makes a role (0,0,0), the same mechanism the base uses, so a component's
   own rule always wins, including a bare element selector. (Author origin beats the UA
   stylesheet regardless of specificity, so an `<h1>` still renders at 28px and not at
   the UA's `2em`.)

   **Specificity is the wrong tool against inheritance**, which is why the alignment is
   gone rather than merely de-specified. `text-align` inherits, and *any* declaration on
   the element — (0,0,0) included — beats an inherited value, because inheritance is
   only consulted when nothing applies. `:where(.ui-caption) { text-align: start }`
   therefore rendered a caption **left** inside a container the component had centred:
   that exact symptom, with nothing to out-specify. The roles now declare no alignment
   at all. `start` is the initial value, so LTR copy is unchanged; the difference is
   that centring an ancestor reaches the type.
3. **Microcap weight 600 → 700 — CLOSED at parity surface 1.** It read `--ui-weight-bold`
   (700) while the token sheet carried three weights, because the token sheet enumerates
   regular/medium/bold". The old token sheet declares FOUR —
   regular 400, medium 500, **semibold 600**, light 300 — and 600 renders on 496
   elements against 51 at 700, all of which are one Tailwind `font-bold` utility on a modal
   title. The role is `--ui-weight-semibold` (600), which is the value it was derived from.
4. **Microcap tracking .12em → .04em — CLOSED at parity surface 0**, for the same reason
   in the same sentence: one place writes `.04em` while another declares `.12em`.
   A 15px microcap tracks 1.8px again.
5. **The block roles zero the UA margin.** The sheet they replace reset `margin: 0` on its caption
   only, because its titles and headings are `div`s. See rule 3 above.

One smaller one, recorded for the same reason:
`.ui-numeric` no longer restates the font family —
the numeric family token was already defined as the UI family and
`styles/tokens.css:346-348` collapsed the two, so restating it would stop numbers
inheriting a family their own component chose.

---

## Accessibility

* **`text-transform` is paint.** `.ui-microcap` renders uppercase while `textContent`
  keeps the case the author wrote, so the accessible name is announced as *Pressure*,
  not *P-R-E-S-S-U-R-E*. Write the markup in sentence case; never uppercase the source.
* **Roles carry no semantics.** Heading level, landmark and label are the element's job.
  Row #13 cites no rule — the appendix it would cite is the
  `aria-*`-driven *state* selector, and type has no state.
* **The measure is an accessibility feature**, not decoration: `--ui-measure` (70ch)
  keeps help text off a 155-character line, which is what the old caption comment
  records as the failure it was written to end.

---

## Where the values came from

Queried mechanically with
A provenance query, by state, class and property, against
`prov-baseline` (dark); every citation is quoted verbatim in the header of
`src/components/type-roles.js`. Measured reach: title 38 elements in
38 states, heading 88/30, caption 77/30, microcap 31/7, body 12/3, numeric 19/6.

**Two properties have no oracle answer and the tool says so**: `line-height` and
`text-align` are outside the probe's 18-property appearance surface — *"property not
probed … The measurement covered an 18-property appearance surface and nothing
else."* `line-height` was read from the source, read-only, at
the carve-out's documented fallback.
`text-align` is the one source read this module declines: the old value there is bug
the same mechanism (departure 2), so no role declares it.

**No line-height tokens exist**, because the token sheet names none and this row may add
a token only where the sheet names it. The three ratios (1.2 / 1.3 / 1.5) live in the fragment. If a
`--ui-leading-*` family is ever agreed it replaces five values in one file.

---

## Testing

* `test/render/type-roles.render.test.mjs` — both geometries: the six roles on
  their tokens, a twelve-token drill, the five departures, the zero-specificity
  mechanism, the fixed-vs-fluid split measured against the *container*, and the
  `text-transform` a11y case.
* `test/fixtures/type-roles-fixture.js` — the subject. A fixture, not a shipping
  component, in the same sense as `base-fixture`: the roles are classes on
  plain markup inside a shadow root, so the render harness needs a host and the gallery needs
  something to photograph.
* `test/type-roles-gallery-entry.test.mjs` — the entry shape, plus the two structural
  invariants: `type-roles.js` defines no custom element, and every `--ui-*` it reads is
  declared in `styles/tokens.css`.
