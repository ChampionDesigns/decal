/**
 * editor-settings-panel.js — <editor-settings-panel>, the editor's Settings panel.
 * `LAYOUT_SPEC_DRAFT.md` §4.3 ("settings: grid 1fr 1fr 2fr -> @container collapses to
 * 2-up then 1-up; overflow-y: auto"); SCOPE Part 5 §5 "Skeleton and what flexes" and
 * "Scroll regions and floors"; wave 5.5 (wf-w5p5-editor), row `settings-panel`.
 *
 * ===========================================================================
 * THIS IS A LAYOUT, AND IT IS ONLY A LAYOUT
 * ===========================================================================
 * The panel owns four things and no fifth: the three tracks, the two collapses, the
 * scroll region, and the floor. It authors no field, no label, no control, no default
 * and — this is the one that matters — NO RANGE. B2: exactly one ranges table, and this
 * wave does not write it. A stepper's min/max/step arrive from the authoring table
 * (`profile-modes.js` AUTHORING_RANGES) or the machine's own (`machine-limits.js`),
 * through whoever mounts the row. A second hand-written table here — even a "sensible
 * default" on one control — is a BLOCK.
 *
 * So the rows arrive as light-DOM children and this element is a grid over them:
 *
 *     <editor-settings-panel>
 *       <div class="field">…label + control…</div>     one grid item per field row
 *       …
 *     </editor-settings-panel>
 *
 * ===========================================================================
 * WHY THERE IS NO <editor-field-row> COMPONENT
 * ===========================================================================
 * Part 5 §5 lists "settings field row · toggle row · textarea" inside a run-on sentence
 * of components. NONE of the three carries an inventory number, and Part 10 §9 is
 * explicit: a component not on the 57-item inventory is scope invention. They are
 * composition targets — a label and a control, built from primitives that already
 * exist (#6 ui-text-field, #5 ui-switch — including its shape="pill" form, which is
 * what #56 became — #7 ui-select, #4 ui-stepper) — not components to author here.
 *
 * AND #29 ui-settings-row IS NOT THE ONE TO REACH FOR. It is the SETTINGS SCREEN's row:
 * its own header binds it to that screen's 37 leaves, `src/lib/settings-leaves.js` is
 * its registry and `test/settings-leaves.test.mjs` pins it. Reusing it here would be a
 * category error — the two rows consume the same primitives and answer to different
 * registries. Nothing in this file imports it.
 *
 * ===========================================================================
 * THE COLLAPSES ARE CONTAINER QUERIES ON THIS PANEL'S OWN BOX
 * ===========================================================================
 * Part 2 §5 rule 1: a component reads its own container, never the viewport. There is
 * no `@media (width…)` in this file and there is no JavaScript that reads a width. The
 * queries below ask THIS element's inline size, so a panel put in a narrow region
 * collapses whether or not the window is narrow — which is the whole difference between
 * a responsive component and a screen-width table.
 *
 * NO ORACLE ANSWER EXISTS FOR THE THRESHOLDS, and none is sought. Slate's rects are
 * frozen 1920x1200 captures and every id in §7.4 is a disqualifier; §4.3 gives the
 * track lists and says "collapses" without a number. So each threshold is DERIVED, from
 * the one width fact this screen has, and the derivation is written out below. Both are
 * recorded as deferred questions: each is one literal, in one file, and moving it moves
 * nothing else.
 *
 * THE DERIVATION. A field row's control is the widest thing in a track, and the widest
 * control the row set can hold is #4 ui-stepper, whose band is
 *
 *     2 * --ui-stepper-cap (78) + --_ui-value-min (110) + 2 * --ui-border-w (1) = 268
 *
 * — the stepper's own arithmetic (`ui-stepper.js:289`), not a number picked here. A
 * track narrower than that clips a control rather than reflowing a layout, so the
 * threshold for each branch is "the narrowest track still holds one band":
 *
 *     3-up   1fr 1fr 2fr  -> narrowest track is C/4;  C = 4 * 268 = 1072
 *            + 2 gaps (2 * --ui-space-4 = 36) + 2 pads (2 * --ui-space-6 = 56) = 1164
 *     2-up   1fr 1fr      -> narrowest track is C/2;  C = 2 * 268 = 536
 *            + 1 gap (18) + 2 pads (56) = 610
 *
 * THE TRACKS ARE SPELLED minmax(0, Nfr), WHICH IS THE SAME RATIO AND A DIFFERENT
 * MINIMUM. A bare `1fr` is `minmax(auto, 1fr)`, so a wide row would push its track past
 * its share and the collapse thresholds would be advisory rather than binding — the
 * container would stop owning the track. §2.3: one owner per dimension, and the owner
 * of a track's minimum is the track.
 *
 * A CONTAINER QUERY CONDITION CANNOT CONTAIN var(), which is why these are literals at
 * all and why they are not tokens: `@container (inline-size < var(--x))` never matches,
 * silently. Each is written ONCE, here, and exported so the suite sweeps the number the
 * CSS was written beside rather than a copy of it.
 *
 * NEITHER BRANCH FIRES AT THE BENCH GEOMETRY BY CONSTRUCTION (1281 > 1164), so the
 * suite drives the panel's own box across both thresholds rather than reporting whatever
 * the window happened to give it.
 *
 * ===========================================================================
 * THE SCROLL REGION AND ITS FLOOR  (§2.4, M18)
 * ===========================================================================
 * §2.4's three, together: an explicit overflow, a floor, and a scrollbar you can see.
 *
 *   - `overflow-y: auto` — stated, so nothing clips silently;
 *   - `min-block-size: var(--ui-editor-field-min-h)` — Part 5 §5's floors table, "one
 *     field row", as a TOKEN whose value is arithmetic over rows this skin already has
 *     (see styles/tokens.css). A floor that is a frozen number is the thing Part 10 §9's
 *     screen review looks for;
 *   - no `scrollbar-width` anywhere (T16 is both nav columns hiding a live scrollbar).
 *
 * When the cell is shorter than the floor this panel overflows <editor-body> visibly
 * rather than being cut — <editor-body> declares no overflow for exactly that reason.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

/**
 * The narrowest a field-row track may be: one #4 ui-stepper band, 268px, which is
 * `2 * --ui-stepper-cap + --_ui-value-min + 2 * --ui-border-w` as ui-stepper.js:289
 * writes it. Exported because both thresholds below are computed from it and the suite
 * checks the arithmetic rather than the answers.
 */
export const EDITOR_FIELD_TRACK_MIN_PX = 268;

/** Below this, `1fr 1fr 2fr` becomes `1fr 1fr`. 4 * 268 + 2 * 18 + 2 * 28. */
export const EDITOR_SETTINGS_COLLAPSE_2UP_PX = 1164;

/** Below this, `1fr 1fr` becomes `1fr`. 2 * 268 + 18 + 2 * 28. */
export const EDITOR_SETTINGS_COLLAPSE_1UP_PX = 610;

export class EditorSettingsPanel extends UiElement {
    static styles = [css`
        /* NO BACKTICK ANYWHERE IN THIS TEMPLATE, comment or not: one ends the tagged
         * template where it stands and the file then fails to parse as JavaScript some
         * way further on.
         *
         * THE HOST IS THE CONTAINER, NOT THE GRID. container-type: inline-size comes
         * from the base, and an element is never its own container — so every rule the
         * queries below govern has its subject INSIDE this root, on #panel, and never
         * on :host. A collapse written on :host would ask the box OUTSIDE this
         * component, which is the trap settings-master-detail.js is shaped around. */
        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE SCROLL REGION, THE TRACKS AND THE FLOOR, all on one box.
         *
         * align-content: start so the rows keep their own heights instead of being
         * stretched to fill a tall panel — a field row's height is its control's, and a
         * stretched row is a control cluster that has silently grown. */
        #panel {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr);
            align-content: start;
            gap: var(--ui-space-4);
            padding: var(--ui-space-6);
            block-size: 100%;
            min-block-size: var(--ui-editor-field-min-h);
            min-inline-size: 0;
            overflow-y: auto;
        }

        /* The slot is not the grid item — the slotted row is. See editor-body.js for
         * why that matters to a floor. */
        slot {
            display: contents;
        }

        ::slotted(*) {
            min-inline-size: 0;
        }

        /* =======================================================================
         * THE TWO COLLAPSES. Written widest-first so the narrower rule, which is
         * also true below the wider threshold, is the later of the two and wins on
         * order at equal specificity.
         *
         * < is exclusive as §4.3's neighbours write it, so 1164 belongs to the
         * 3-up branch; the suite pins each flip at N/N-1 rather than assuming.
         * ======================================================================= */
        @container (inline-size < 1164px) {
            #panel {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            }
        }

        @container (inline-size < 610px) {
            #panel {
                grid-template-columns: minmax(0, 1fr);
            }
        }
    `];

    render() {
        return html`
            <div id="panel" part="panel">
                <slot></slot>
            </div>
        `;
    }
}

customElements.define('editor-settings-panel', EditorSettingsPanel);
