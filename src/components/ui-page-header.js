/**
 * A screen's heading, with the actions that belong to the page rather than to a row in it.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';

import 'src/components/ui-button.js';

export const PAGE_HEADER_LAYOUTS = Object.freeze(['flanks', 'centre']);

export class UiPageHeader extends UiElement {
    static properties = {
        /** The page title. Empty renders no heading element at all. */
        heading: { type: String },
        /** 'flanks' (default) | 'centre'. */
        layout: { type: String, reflect: true },
        /** Render the commit cluster in the trail region. */
        commit: { type: Boolean, reflect: true },
        /** Unsaved changes. A NUMBER in; the sentence is this component's. */
        changeCount: { type: Number, attribute: 'change-count' },
        banner: { type: Boolean, reflect: true },
    };

    static styles = [typeRoles, css`
        :host {
            display: grid;
            min-block-size: var(--ui-band-h);
        }

        .band {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            column-gap: var(--ui-space-4);
            min-block-size: var(--ui-band-h);
            padding-inline: var(--ui-space-6);
            background-color: var(--ui-bar);
        }

        :host([layout="centre"]) .band {
            grid-template-columns: auto minmax(0, 1fr) auto;
        }

        .region {
            display: flex;
            align-items: center;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .region-centre { justify-content: center; }
        .region-trail { justify-content: flex-end; }

        .header-action,
        ::slotted(.header-action) {
            flex: 0 0 auto;
        }

        .title {
            min-inline-size: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            letter-spacing: .01em;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.layout = 'flanks';
        this.commit = false;
        this.changeCount = 0;
        this.banner = false;
        this.i18n = new I18nController(this);
    }

    /** Normalise before paint, so layout="Centre" and layout="nope" are a documented
     *  fallback rather than a band with no tracks. */
    willUpdate(changed) {
        if (changed.has('layout')) {
            const raw = String(this.layout ?? '').trim().toLowerCase();
            // "center" is the same word; accept it and answer in this component's spelling.
            const spelt = raw === 'center' ? 'centre' : raw;
            const next = PAGE_HEADER_LAYOUTS.includes(spelt) ? spelt : 'flanks';
            if (next !== this.layout) this.layout = next;
        }
    }

    get #count() {
        const n = Number(this.changeCount);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }

    get #commitLabel() {
        const n = this.#count;
        return n > 0 ? this.i18n.t('Save ({count})', { count: n }) : this.i18n.t('Save');
    }

    #emit(type) {
        const n = this.#count;
        this.dispatchEvent(new CustomEvent(type, {
            detail: { changeCount: n, dirty: n > 0 },
            bubbles: true,
            composed: true,
        }));
    }

    #onCommit = () => this.#emit('commit');
    #onCancel = () => this.#emit('cancel');

    /** The commit cluster. No slot, no label property: the wording has no per-screen
     *  surface, and that absence is the decision. */
    #renderCommit() {
        const dirty = this.#count > 0;
        return html`
            <ui-button
                id="cancel"
                class="header-action"
                tall
                @click=${this.#onCancel}
            >${this.i18n.t('Cancel')}</ui-button>
            <ui-button
                id="save"
                class="header-action"
                tall
                variant=${dirty ? 'primary' : 'default'}
                @click=${this.#onCommit}
            >${this.#commitLabel}</ui-button>
        `;
    }

    render() {
        const titled = Boolean(this.heading);
        return html`<header
            id="band"
            class="band"
            role=${this.banner ? 'banner' : 'none'}
        >
            <div id="lead" class="region region-lead">
                ${titled
                    ? html`<h1 id="title" class="ui-title title">${this.heading}</h1>`
                    : nothing}
                <slot name="lead"></slot>
            </div>
            <div id="centre" class="region region-centre"><slot name="centre"></slot></div>
            <div id="trail" class="region region-trail">
                <slot name="trail"></slot>
                ${this.commit ? this.#renderCommit() : nothing}
            </div>
        </header>`;
    }
}

customElements.define('ui-page-header', UiPageHeader);
