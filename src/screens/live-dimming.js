/**
 * The PAINT half of Live's one dimming owner.
 */

import { css } from 'lit';

export {
    DIM_BLIND_STATUSES, DIM_KEEPS_INPUT, LIVE_DIM, LIVE_DIM_ACTIVE, LIVE_DIM_ATTR,
    LIVE_DIM_GROUP, LIVE_DIM_GROUPS, LIVE_DIM_GROUP_ATTR, LIVE_DIM_KEEPS_INPUT_ATTR,
    RAIL_DIM_GROUP, dimStateFor, groupDimmed, liveDim, railDimGroup, railKeepsInput,
} from '../lib/live-dimming.js';

export const liveDimming = css`
    :host([dim='all']) [data-dim-group],
    :host([dim='except-steam']) [data-dim-group]:not([data-dim-group='steam']),
    :host([dim='except-hotwater']) [data-dim-group]:not([data-dim-group='hotwater']),
    :host([dim='except-flush']) [data-dim-group]:not([data-dim-group='flush']) {
        opacity: var(--ui-opacity-dim);
        pointer-events: none;
    }

    :host([dim]) [data-dim-group][data-dim-keeps-input] {
        pointer-events: auto;
    }
`;
