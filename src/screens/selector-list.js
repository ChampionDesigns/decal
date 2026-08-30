/**
 * The profile listbox's STYLESHEET, and only that.
 */

import { css } from 'lit';

export const listboxStyles = css`

    .listbox {
        min-inline-size: 0;
        border-inline: var(--ui-hairline) solid transparent;
        margin-inline: calc(-1 * var(--ui-hairline));
        background-clip: padding-box;
    }

    .listbox:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--ui-focus-offset-inset);
    }

    .group {
        min-inline-size: 0;
    }

    .family-row {
        font-weight: var(--ui-weight-semibold);
    }

    .family-row .fold-mark {
        display: inline-block;
        inline-size: var(--ui-space-5);
        color: var(--ui-muted);
        font-size: var(--ui-text-sm);
    }

    .group > ui-list-row {
        padding-inline-start: var(--ui-space-5);
    }

    .listbox:focus-visible ui-list-row[data-active] {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--ui-focus-offset-inset);
    }

    /* The empty answer. Not an error: a filter that matches nothing is a real result. */
    .list-empty {
        color: var(--ui-text-2);
        padding: var(--ui-space-4) var(--ui-space-3);
    }
`;
