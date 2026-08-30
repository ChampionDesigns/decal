/**
 * editor-body.js — <editor-body>, row 2 of the profile editor.
 * `LAYOUT_SPEC_DRAFT.md` §4.3; SCOPE Part 5 §5 "Skeleton and what flexes";
 * wave 5.5 (wf-w5p5-editor), row `editor-skeleton`.
 *
 * ===========================================================================
 * WHAT §4.3 ASKS FOR, AND WHAT THAT MAKES THIS FILE
 * ===========================================================================
 *
 *     └─ <editor-body>     one of three panels
 *          ├─ steps:    <step-matrix>   overflow: auto (BOTH axes)
 *          ├─ settings: grid 1fr 1fr 2fr -> 2-up -> 1-up; overflow-y: auto
 *          └─ review:   grid 1fr 1fr    -> 1-up;          each column overflow-y: auto
 *
 * "One of three panels" is the whole specification, and it is a specification about
 * PLACEMENT, not about visibility. All three panels occupy the same single cell; which
 * one is showing is #32 ui-tab-bar's, through its `panels` map. So this file owns:
 *
 *   - one cell, minmax(0,1fr) in both axes, filling row 2;
 *   - the three panels stacked into it, placed explicitly;
 *   - and nothing else.
 *
 * ONE OWNER PER DIMENSION (E2/E3/E5/E8). There is no JavaScript in this component at
 * all: no ResizeObserver, no matchMedia, no measured width written back as a style, no
 * exported scale. E8's cautionary tale is a layout engine that was declared, documented,
 * exported and TESTED and consulted by nothing; the shortest way not to build one is not
 * to compute layout in a language that cannot see the box.
 *
 * ===========================================================================
 * THIS BOX DECLARES NO OVERFLOW, DELIBERATELY
 * ===========================================================================
 * §4.3 gives an overflow to each of the three panels and none to the box that holds
 * them: both axes to the matrix, `y` to the settings panel, `y` to each review column.
 * An `overflow` here would be a SECOND owner of the same behaviour, and the failure mode
 * is the one §2.4 names — a region that clips silently. Slate clips at
 * `slate-components.css:51` and that is what made chart-C3's 32px overflow invisible.
 *
 * The consequence is intended and is what the suite asserts: when a panel's floor is
 * taller than this cell, the panel overflows this box VISIBLY rather than being cut.
 *
 * ===========================================================================
 * THE SLOTS ARE NOT THE GRID ITEMS — THE SLOTTED PANELS ARE
 * ===========================================================================
 * `display: contents` on each slot hands the cell straight to the panel, so a floor
 * declared on a panel still binds. A wrapper box would take the cell and then have to
 * hand its height on, which is how a floor stops binding (the same construction, and
 * the same reason, as `settings-master-detail.js`).
 *
 * AND NO `display` IS WRITTEN IN A `::slotted()` RULE. The panels live in
 * <editor-screen>'s shadow tree, which is the OUTER tree relative to this one, so for
 * normal declarations their own tree wins over `::slotted()` here. A `display` written
 * here would therefore be inert for the custom-element panels and — worse — would be a
 * second, losing owner of the one property that makes `hidden` work. Visibility is
 * ui-tab-bar's, expressed as `hidden` + `inert`, and this file does not touch it.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

/**
 * The panel slot names, in §4.3's order. Exported so the screen, the tab bar's value
 * list and the suite all name them once rather than four times.
 */
export const EDITOR_PANEL_SLOTS = Object.freeze(['steps', 'settings', 'review']);

export class EditorBody extends UiElement {
    static styles = [css`
        /* NO BACKTICK ANYWHERE IN THIS TEMPLATE, comment or not: one ends the tagged
         * template where it stands and the file then fails to parse as JavaScript some
         * way further on, at whatever the CSS happens to look like.
         *
         * THE HOST IS THE CONTAINER, NOT THE GRID. container-type: inline-size comes
         * from the base; what is added here is a box that fills its grid area in both
         * axes with both minimums at 0, so the screen's row-2 track decides the room and
         * this box asks for none of its own. */
        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* ONE CELL. Every panel is placed into it below, so the showing panel gets the
         * whole box and the hidden ones cost no track. minmax(0,1fr) in both axes is
         * what lets a panel be SMALLER than its content and scroll; an auto track
         * would size to the content's minimum and the scroll region would never have a
         * reason to scroll (spec §2.3). */
        #stack {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        slot {
            display: contents;
        }

        /* PLACEMENT IS EXPLICIT FOR ALL THREE. Auto-placement would give three ROWS the
         * moment two panels are visible at once — which is exactly the state a
         * mis-wired tab bar produces, and the state a test needs to be able to see as a
         * broken layout rather than as a plausible one. */
        slot[name="steps"]::slotted(*),
        slot[name="settings"]::slotted(*),
        slot[name="review"]::slotted(*) {
            grid-column: 1;
            grid-row: 1;
            min-inline-size: 0;
            min-block-size: 0;
        }
    `];

    render() {
        return html`
            <div id="stack">
                <slot name="steps"></slot>
                <slot name="settings"></slot>
                <slot name="review"></slot>
            </div>
        `;
    }
}

customElements.define('editor-body', EditorBody);
