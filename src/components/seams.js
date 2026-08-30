/**
 * The shared seam fragments — the hairlines that divide a grid without adding to a cell's height.
 */

import { css } from 'lit';
import { adoptStyleSheet } from 'src/components/base.js';

export const seams = css`
    .seam-grid {
        display: grid;
        gap: var(--ui-seam);
        background-color: var(--ui-zone-seam);
    }

    .seam-grid.seam-cols {
        row-gap: 0;
        column-gap: var(--ui-seam);
    }

    .seam-grid.seam-rows {
        column-gap: 0;
        row-gap: var(--ui-seam);
    }

    .seam-grid.seam-zone {
        background-color: var(--ui-zone-seam);
    }

    .seam-grid.seam-line {
        background-color: var(--ui-line);
    }

    .seam-grid.seam-strong {
        background-color: var(--ui-line-strong);
    }

    /* THE OPT-IN CELL GROUND, for a plain cell that is not a component with a
     * shadow root of its own. Without a painted cell there is no seam - only
     * ground (trap 1 in the header). */
    .seam-cell {
        background-color: var(--ui-fascia);
    }

    :host(.seam-grid) {
        display: grid;
        gap: var(--ui-seam);
        background-color: var(--ui-zone-seam);
    }

    :host(.seam-grid.seam-cols) {
        row-gap: 0;
        column-gap: var(--ui-seam);
    }

    :host(.seam-grid.seam-rows) {
        column-gap: 0;
        row-gap: var(--ui-seam);
    }

    :host(.seam-grid.seam-zone) {
        background-color: var(--ui-zone-seam);
    }

    :host(.seam-grid.seam-line) {
        background-color: var(--ui-line);
    }

    :host(.seam-grid.seam-strong) {
        background-color: var(--ui-line-strong);
    }

    :host(.seam-cell) {
        background-color: var(--ui-fascia);
    }
`;

export const SEAM_CLASSES = Object.freeze({
    grid: 'seam-grid',
    cols: 'seam-cols',
    rows: 'seam-rows',
    zone: 'seam-zone',
    line: 'seam-line',
    strong: 'seam-strong',
    cell: 'seam-cell',
});

const fallbackSheets = new WeakMap();

export function seamStyleSheet() {
    const own = seams.styleSheet;
    if (own) return own;

    let fallback = fallbackSheets.get(seams);
    if (!fallback) {
        fallback = new CSSStyleSheet();
        fallback.replaceSync(seams.cssText);
        fallbackSheets.set(seams, fallback);
    }
    return fallback;
}

export function adoptSeams(root = document) {
    adoptStyleSheet(root, seamStyleSheet());
    return root;
}
