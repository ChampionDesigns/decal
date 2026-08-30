/**
 * What the profile editor's two dialog INSTANCES share: the row rhythm their bodies are built from, and the one way either of them reaches a bound.
 */

import { css } from 'lit';

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

