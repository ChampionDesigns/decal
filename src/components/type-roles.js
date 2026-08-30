/**
 *.
 */

import { css } from 'lit';

import { adoptStyleSheet } from './base.js';

export const TYPE_ROLES = Object.freeze([
    'ui-title',
    'ui-heading',
    'ui-caption',
    'ui-body',
    'ui-microcap',
    'ui-numeric',
]);

export const typeRoles = css`
    :where(.ui-title) {
        margin: 0;
        color: var(--ui-text);
        font-size: var(--ui-text-xl);
        font-weight: var(--ui-weight-medium);
        line-height: 1.2;
    }

    :where(.ui-heading) {
        margin: 0;
        color: var(--ui-text);
        font-size: var(--ui-text-lg);
        font-weight: var(--ui-weight-medium);
        line-height: 1.3;
    }

    :where(.ui-caption) {
        display: block;
        max-inline-size: var(--ui-measure);
        margin: 0;
        color: var(--ui-muted);
        font-size: var(--ui-text-note);
        font-weight: var(--ui-weight-regular);
        line-height: 1.5;
    }

    :where(.ui-body) {
        margin: 0;
        font-size: var(--ui-text-base);
        font-weight: var(--ui-weight-regular);
        line-height: 1.5;
    }

    :where(.ui-microcap) {
        color: var(--ui-muted);
        font-size: var(--ui-text-sm);
        font-weight: var(--ui-weight-semibold);
        letter-spacing: var(--ui-tracking-cap);
        line-height: 1.2;
        text-transform: uppercase;
    }

    :where(.ui-numeric) {
        font-variant-numeric: tabular-nums lining-nums;
    }
`;

export function adoptTypeRoles(root) {
    return adoptStyleSheet(root, typeRoles.styleSheet);
}

export default typeRoles;
