/**
 * live-dimming.js — the PAINT half of Live's one dimming owner. Bug L11.
 *
 * The map, the reasoning, the two Slate owners and the one-line reversal are all in
 * `src/lib/live-dimming.js`, which is DOM-free and therefore testable under `node --test`.
 * This file is one declaration block and the re-export that lets `<live-screen>` reach
 * both halves through one import.
 *
 * THE MECHANISM, in three lines:
 *   the map      `liveDim(machineState)` — the lib half, the only place it is written
 *   the carrier  ONE reflected attribute on `<live-screen>`, `dim="…"` (Appendix 15:
 *                state travels as an attribute a selector can name)
 *   the paint    the ONE block below
 *
 * NO INLINE STYLE IS WRITTEN ANYWHERE. `test/live-connection-gates.test.mjs` asserts that
 * over this cluster's source and over `live-screen.js` and `live-rail.js`; the render
 * suite's drill is the mechanical proof — `--ui-opacity-dim` is re-pointed at a marker
 * value and the dimmed row's computed opacity has to follow it. An inline `opacity`
 * anywhere in the chain would pin the row and the drill would not land, which is exactly
 * the failure L11 describes turned into a test that bites.
 *
 * THE VALUES ARE NOT NEW. `--ui-opacity-dim` already exists (`styles/tokens.css:474`, .62)
 * and is already re-pointed in the dark band (`:944` → `--ui-opacity-dim-dark`, .42),
 * carrying owner A's per-theme answer and its reasoning verbatim. This file writes no
 * number, and owner B's undesigned `0.25` does not come along.
 */

import { css } from 'lit';

export {
    DIM_BLIND_STATUSES, DIM_KEEPS_INPUT, LIVE_DIM, LIVE_DIM_ACTIVE, LIVE_DIM_ATTR,
    LIVE_DIM_GROUP, LIVE_DIM_GROUPS, LIVE_DIM_GROUP_ATTR, LIVE_DIM_KEEPS_INPUT_ATTR,
    RAIL_DIM_GROUP, dimStateFor, groupDimmed, liveDim, railDimGroup, railKeepsInput,
} from '../lib/live-dimming.js';

/**
 * THE ONE DECLARATION BLOCK. Included by `<live-screen>`'s `static styles`.
 *
 * Four selectors, one block, one owner. The rows it paints are the screen's own light-DOM
 * children (the rail's rows are written in `live-screen.js` and slotted into
 * `<live-rail>`), so the screen's stylesheet reaches them directly and no component has to
 * expose a part or accept a dim property of its own — which would be a second dim owner
 * under another name.
 */
export const liveDimming = css`
    :host([dim='all']) [data-dim-group],
    :host([dim='except-steam']) [data-dim-group]:not([data-dim-group='steam']),
    :host([dim='except-hotwater']) [data-dim-group]:not([data-dim-group='hotwater']),
    :host([dim='except-flush']) [data-dim-group]:not([data-dim-group='flush']) {
        opacity: var(--ui-opacity-dim);
        pointer-events: none;
    }

    /* ===================================================================
     * AND THE ROWS THAT RECEDE WITHOUT GOING DEAF (audit F-038)
     * ===================================================================
     * Ben, 30 August 2026: "A defect — make them pressable."
     *
     * The rule above writes ONE state in two declarations, and Wave 3 measured what that
     * cost: during a live espresso shot both preset banks went pointer-events: none, the
     * press fell through them to <live-rail> — which paints --ui-fascia and therefore
     * answers the hit test — and eight cells were silently unreachable for the length of
     * every shot. Nothing was disabled and nothing said so.
     *
     * WHICH ROWS THESE ARE IS NOT WRITTEN HERE. The set is DIM_KEEPS_INPUT in the lib half
     * (the map's own rule: an id vocabulary is a contract another module owns), the rows
     * carry it as an attribute exactly as they carry their group, and this is the one
     * declaration that reads it. So the paint still has ONE owner and the exemption is
     * still a table rather than a selector naming a component.
     *
     * THE OPACITY IS DELIBERATELY NOT UNDONE. A preset bank on a mode the machine is not
     * using SHOULD read as "not now" — that is owner A's designed answer and F-038 is not
     * a complaint about the look. What the paint may not do is decide, silently, that the
     * control cannot be pressed.
     *
     * SPECIFICITY, STATED SO NOBODY HAS TO COUNT: the rule above is at most
     * (0,3,0) — :host([dim='...']) plus one attribute — and this one is (0,4,0), so it
     * wins on its own merits and not merely by coming second. No importance flag is used;
     * this file's own suite forbids one by name, and so does Gate C. */
    :host([dim]) [data-dim-group][data-dim-keeps-input] {
        pointer-events: auto;
    }
`;
