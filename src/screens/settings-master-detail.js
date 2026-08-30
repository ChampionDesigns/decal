/**
 * <settings-master-detail>, the Settings screen's body.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

export const MASTER_DETAIL_COLLAPSE_PX = 1100;

/** Which nav column column 1 holds while collapsed. Inert in the wide branch. */
export const NAV_LEVEL = Object.freeze({ CATEGORIES: 'categories', LEAVES: 'leaves' });

export class SettingsMasterDetail extends UiElement {
    static properties = {
        navLevel: { type: String, attribute: 'nav-level' },
    };

    static styles = [seams, css`
        :host {
            display: block;

            --_ui-settings-nav-col: 262px;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        #grid {
            block-size: 100%;
            min-block-size: 0;
            grid-template-columns: var(--_ui-settings-nav-col) var(--_ui-settings-nav-col) minmax(0, 1fr);
            grid-template-rows: var(--ui-nav-row) minmax(0, 1fr);
            align-items: stretch;
        }

        slot {
            display: contents;
        }

        #search-head {
            grid-column: 1 / span 2;
            grid-row: 1;
            display: grid;
            align-items: center;
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        /* The field's breathing room belongs to the field, not to the box around it. */
        slot[name="search"]::slotted(*) {
            min-inline-size: 0;
            margin: var(--ui-space-3);
        }

        slot[name="nav"]::slotted(*) {
            grid-column: 1;
            grid-row: 2;
            min-inline-size: 0;
        }

        slot[name="subnav"]::slotted(*) {
            grid-column: 2;
            grid-row: 2;
            min-inline-size: 0;
        }

        /* THE LEAF PANE TAKES BOTH ROWS. The search belongs to the navigation, not to the
         * page beside it, so the pane starts where the columns' heads do. */
        slot[name="leaf"]::slotted(*) {
            grid-column: 3;
            grid-row: 1 / span 2;
            min-inline-size: 0;
        }

        /* THE CRUMB HAS NO BOX IN THE WIDE BRANCH. Three columns are all visible, so
         * there is nowhere to have come from and nothing to say. */
        #crumb {
            display: none;
        }

        @container (inline-size < 1100px) {
            #grid {
                grid-template-columns: minmax(220px, 30%) minmax(0, 1fr);
                /* THREE ROWS: the search field, the crumb, then the list. */
                grid-template-rows: var(--ui-nav-row) auto minmax(0, 1fr);
            }

            #search-head {
                grid-column: 1;
                grid-row: 1;
            }

            /* THE CRUMB ROW IS ONE NAV ROW TALL, from the same token the rows use, so
             * the column reads as the same navigation surface with a heading rather
             * than as two stacked lists at two rhythms. */
            #crumb {
                display: flex;
                align-items: center;
                grid-column: 1;
                grid-row: 2;
                min-block-size: var(--ui-nav-row);
                min-inline-size: 0;
                padding-inline: var(--ui-space-4);
            }

            slot[name="nav"] {
                display: none;
            }

            slot[name="subnav"]::slotted(*) {
                grid-column: 1;
                grid-row: 3;
            }

            slot[name="leaf"]::slotted(*) {
                grid-column: 2;
                grid-row: 1 / span 3;
            }

            /* STEPPED BACK UP. The attribute is on #grid, inside this root, so the
             * subject of every one of these rules resolves against the host's box —
             * the same container the query above asked. */
            #grid[data-nav-level="categories"] slot[name="nav"] {
                display: contents;
            }

            #grid[data-nav-level="categories"] slot[name="nav"]::slotted(*) {
                grid-column: 1;
                grid-row: 3;
            }

            #grid[data-nav-level="categories"] slot[name="subnav"] {
                display: none;
            }
        }
    `];

    constructor() {
        super();
        this.navLevel = NAV_LEVEL.LEAVES;
    }

    render() {
        /* .seam-cell on the crumb is trap 1 in seams.js: a cell that paints nothing is
         * a hole, and the ground shows through everything not painted over it. */
        return html`
            <div
                id="grid"
                part="grid"
                class="seam-grid seam-strong"
                data-nav-level=${this.navLevel}
            >
                <div id="search-head" part="search-head" class="seam-cell">
                    <slot name="search"></slot>
                </div>
                <div id="crumb" part="crumb" class="seam-cell"><slot name="crumb"></slot></div>
                <slot name="nav"></slot>
                <slot name="subnav"></slot>
                <slot name="leaf"></slot>
            </div>
        `;
    }
}

customElements.define('settings-master-detail', SettingsMasterDetail);
