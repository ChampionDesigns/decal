/**
 * editor-dialog-parts.js — what the profile editor's two dialog INSTANCES share: the
 * row rhythm their bodies are built from, and the one way either of them reaches a
 * bound. No tag, no element, no modality.
 * SCOPE Part 5 §5 "Components" ("`<x-dialog>` (exit condition, lever)"); wave 5.5,
 * row `editor-dialogs`.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS AT ALL
 * ===========================================================================
 * A screen module defines AT MOST ONE custom element and it is named after the file —
 * the rule `test/live-screen.test.mjs` keeps for the whole of `src/screens/`. The two
 * dialogs are therefore two files, and two files' worth of the same three declarations
 * is how a screen ends up with two field rows that disagree about a gap. So the rhythm
 * and the door-reading are stated once, here, in a module that defines no tag (the same
 * shape as `live-gates.js` and `live-dimming.js`).
 *
 * ===========================================================================
 * B2 — NOT ONE BOUND IS WRITTEN IN EITHER DIALOG
 * ===========================================================================
 * Every min/max/step/unit arrives through `src/lib/editor-ranges.js`, injected as the
 * `ranges` property, and is handed straight to #4. A refused field renders the control
 * DISABLED carrying the door\'s own reason (A7) — never a plausible band. `resolveRange`
 * is the whole of that reading, and it invents nothing: an absent door and a refused
 * field are DIFFERENT states, and neither is a default.
 */

import { css } from 'lit';

/**
 * The rows both dialogs are made of: a label, a control, and nothing between them. Shared
 * because two files' worth of the same three declarations is how a screen ends up with
 * two field rows that disagree about a gap.
 */
export const dialogRows = css`
    /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template where
     * it stands and the file stops parsing as JavaScript some way further on. */
    #body {
        display: flex;
        flex-direction: column;
        gap: var(--ui-space-5);
        min-inline-size: 0;
    }

    .row {
        display: flex;
        flex-direction: column;
        gap: var(--ui-space-2);
        min-inline-size: 0;
    }

    /* A control never widens the dialog past its cell; #18 owns the card's width. */
    .row > * {
        min-inline-size: 0;
    }

    .note {
        margin: 0;
    }
`;

/**
 * What both dialogs do with the ranges door, written once.
 *
 * Returns `{range, refusal}`: a resolved table entry, or the door's own developer-facing
 * sentence. Absent door and refused field are DIFFERENT states and neither is a default.
 */
export function resolveRange(ranges, field, ctx = {}) {
    if (!ranges || typeof ranges.rangeFor !== 'function') {
        return {
            range: null,
            refusal: 'editor-dialogs: no ranges door was injected, so no bound has an owner. '
                + 'Inject createEditorRanges({machineLimits}).',
        };
    }
    try {
        return { range: ranges.rangeFor(field, ctx), refusal: null };
    } catch (error) {
        return { range: null, refusal: error?.message ?? String(error) };
    }
}

