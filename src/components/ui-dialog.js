/**
 * The one dialog: a native <dialog> with header, body and actions slots.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import {
    deepActiveElement,
    firstAutofocus,
    flatTabbables,
    trapTarget,
    NON_RENDERED_TAGS,
} from 'src/lib/focus-trap.js';
import 'src/components/ui-sheet-header.js';

export const OPEN_DIALOGS = [];

/** The levels #16 accepts. Kept in step with SHEET_HEADING_LEVELS by forwarding the
 *  raw value: #16 normalises it, so this file has no second opinion. */
export const DEFAULT_LEVEL = 2;

const isOpenOverlay = (node) => Boolean(
    node
    && node.nodeType === 1 /* Node.ELEMENT_NODE */
    && typeof node.localName === 'string'
    && node.localName.includes('-')
    && node.open === true
    && typeof node.hide === 'function',
);

const LIVE_REGION_SELECTOR = '[aria-live], [role="status"], [role="alert"], [role="log"], [role="timer"]';

export class UiDialog extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open dialog in static markup, screens
         *  style around one, and the suite reads it. */
        open: { type: Boolean, reflect: true },
        heading: { type: String },
        label: { type: String },
        level: { type: Number },
        /** Whether a custom `header` slot has an element in it. */
        _hasHeader: { state: true },
        /** Whether the `header-trail` cluster has one. */
        _hasHeaderTrail: { state: true },
        /** Whether the footer has one. */
        _hasActions: { state: true },
    };

    static styles = css`
        :host {
            display: contents;
            container-type: normal;

            --_ui-dialog-inline: 820px;
            --_ui-dialog-pad: var(--ui-space-5);
        }

        .dialog {
            inset: 0;
            margin: auto;
            padding: 0;
            border: 0;
            inline-size: min(var(--_ui-dialog-inline), calc(100% - 2 * var(--ui-space-6)));
            max-block-size: calc(100% - 2 * var(--ui-space-5));
            block-size: fit-content;

            container-type: inline-size;

            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-seam);

            background-color: var(--ui-line);
            border-radius: var(--ui-radius-xl);
            box-shadow: var(--ui-elev-3);
            color: var(--ui-text);

            opacity: 0;
            transition: opacity var(--ui-dur) var(--ui-ease);
        }

        .dialog.has-head {
            grid-template-rows: auto minmax(0, 1fr);
        }

        .dialog.has-actions {
            grid-template-rows: minmax(0, 1fr) auto;
        }

        .dialog.has-head.has-actions {
            grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .dialog[open] {
            display: grid;
            opacity: 1;
        }

        /* The fade is on the way IN only (header, "NO EXIT ANIMATION"). Without
         * @starting-style there is no start value to transition FROM and the
         * declaration above would be inert on the first paint. */
        @starting-style {
            .dialog[open] {
                opacity: 0;
            }
        }

        .dialog::backdrop {
            background-color: var(--ui-scrim);
            backdrop-filter: blur(var(--ui-scrim-blur));
            opacity: 0;
            transition: opacity var(--ui-dur) var(--ui-ease);
        }

        .dialog[open]::backdrop {
            opacity: 1;
        }

        @starting-style {
            .dialog[open]::backdrop {
                opacity: 0;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .dialog,
            .dialog::backdrop {
                transition-duration: 0s;
            }
        }

        .cell {
            background-color: var(--ui-surface);
            padding: var(--_ui-dialog-pad);
        }

        .cell:first-child {
            border-start-start-radius: var(--ui-radius-xl);
            border-start-end-radius: var(--ui-radius-xl);
        }

        .cell:last-child {
            border-end-start-radius: var(--ui-radius-xl);
            border-end-end-radius: var(--ui-radius-xl);
        }

        .head.sheet {
            padding-block-end: 0;
        }

        .body {
            min-block-size: var(--ui-control-h);
            overflow-y: auto;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            gap: var(--ui-space-4);
        }

        :host([standard-actions]) ::slotted(ui-button[slot="actions"]) {
            min-inline-size: min(calc(2 * var(--ui-control-h)), 100%);
            max-inline-size: 100%;
            overflow-wrap: anywhere;
        }

        .is-empty {
            display: none;
        }

        @container (max-width: 720px) {
            .cell {
                --_ui-dialog-pad: var(--ui-space-4);
            }
        }
    `;

    constructor() {
        super();
        this.open = false;
        this.heading = '';
        this.label = '';
        this.level = DEFAULT_LEVEL;
        /** The element focus returns to. Null means "whoever had it at open". */
        this.invoker = null;

        this._hasHeader = false;
        this._hasHeaderTrail = false;
        this._hasActions = false;

        this.#returnFocusTo = null;
        this.#inerted = [];
        this.#presented = false;
    }

    #returnFocusTo;

    #inerted;

    /** True between showModal() and close(). Makes present/dismiss idempotent, so
     *  the property path and the method path cannot double-fire. */
    #presented;

    #pressOutside = null;

    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The accessible name. An IDREF cannot cross a shadow boundary, so the name is
     *  the same STRING that is on screen rather than a pointer at it. */
    get accessibleName() {
        return this.label || this.heading || '';
    }

    /** Is a header rendered at all? A cluster-only header is a legitimate #16 shape
     *  (ui-sheet-header.js:266-268), so a trail with no heading still makes one. */
    get headed() {
        return Boolean(this._hasHeader || this.heading || this._hasHeaderTrail);
    }

    /** Am I the dialog a stray Escape belongs to? See ESCAPE in the header. */
    get topmost() {
        return OPEN_DIALOGS.length > 0 && OPEN_DIALOGS[OPEN_DIALOGS.length - 1] === this;
    }

    get tabbables() {
        const dialog = this.dialog;
        return dialog ? flatTabbables(dialog) : [];
    }

    show({ invoker = null, reason = 'api' } = {}) {
        if (this.open) return;
        this.#returnFocusTo = invoker ?? this.invoker ?? deepActiveElement();
        this.#reason = reason;
        this.open = true;
    }

    hide(reason = 'api') {
        if (!this.open) return;
        this.#reason = reason;
        this.open = false;
        this.#dismiss();
    }

    toggle(reason = 'api') {
        if (this.open) this.hide(reason);
        else this.show({ reason });
    }

    requestClose(reason = 'api') {
        if (!this.open) return false;
        const allowed = this.dispatchEvent(new CustomEvent('close-request', {
            detail: { reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.hide(reason);
        return true;
    }

    #reason = 'api';

    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            if (!Number.isFinite(raw)) this.level = DEFAULT_LEVEL;
        }
    }

    firstUpdated() {
        this.dialog?.addEventListener('keydown', this.#onKeydown, true);
        this.dialog?.addEventListener('close', this.#onNativeClose);
    }

    updated(changed) {
        super.updated(changed);
        if (!changed.has('open')) return;
        if (this.open) this.#present();
        else this.#dismiss();

        const previous = changed.get('open');
        const reason = this.#reason;
        this.#reason = 'api';
        if (previous === undefined && !this.open) return;

        this.dispatchEvent(new CustomEvent('open-change', {
            detail: { open: this.open, reason },
            bubbles: true,
            composed: true,
        }));
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasUpdated) return;
        this.dialog?.addEventListener('keydown', this.#onKeydown, true);
        this.dialog?.addEventListener('close', this.#onNativeClose);
        /* The property survived the move; the top layer did not. Re-present so the two
         * agree again — `#present()` is idempotent through `#presented`, which the
         * disconnect cleared. */
        if (this.open) this.#present();
    }

    disconnectedCallback() {
        const returnTo = this.#returnFocusTo;
        this.#dismiss({ restoreFocus: false });
        this.#returnFocusTo = returnTo;
        this.dialog?.removeEventListener('keydown', this.#onKeydown, true);
        this.dialog?.removeEventListener('close', this.#onNativeClose);
        super.disconnectedCallback();
    }

    #present() {
        const dialog = this.dialog;
        if (!dialog || this.#presented) return;
        if (!this.isConnected) return;
        this.#presented = true;
        this.#pressOutside = null;
        if (!this.#returnFocusTo) this.#returnFocusTo = this.invoker ?? deepActiveElement();
        if (!OPEN_DIALOGS.includes(this)) OPEN_DIALOGS.push(this);
        this.#applyInert();
        if (!dialog.open) dialog.showModal();
        this.#focusOnOpen();
    }

    #dismiss({ restoreFocus = true } = {}) {
        const dialog = this.dialog;
        if (!this.#presented) {
            /* Still release anything a half-open state left behind. */
            this.#releaseInert();
            return;
        }
        this.#presented = false;
        this.#pressOutside = null;
        this.#closeNestedOverlays();
        if (dialog?.open) dialog.close();
        const at = OPEN_DIALOGS.indexOf(this);
        if (at !== -1) OPEN_DIALOGS.splice(at, 1);
        this.#releaseInert();
        if (restoreFocus) this.#restoreFocus();
        else this.#returnFocusTo = null;
    }

    /** See the call in `#dismiss()`. Silent about anything that is not an overlay. */
    #closeNestedOverlays() {
        for (const node of this.querySelectorAll('*')) {
            if (isOpenOverlay(node)) node.hide('dismiss');
        }
    }

    #focusOnOpen() {
        const dialog = this.dialog;
        if (!dialog) return;
        const target = firstAutofocus(dialog) ?? flatTabbables(dialog)[0] ?? dialog;
        target.focus?.();
    }

    #restoreFocus() {
        const target = this.#returnFocusTo;
        this.#returnFocusTo = null;
        if (!target || !target.isConnected || typeof target.focus !== 'function') return;
        target.focus();
    }

    #applyInert() {
        const marked = new Set();
        let node = this;
        /* A cap, not a belief: a cycle here would hang the page with the dialog
         * half-open, and 200 levels is far past any tree this app builds. */
        for (let guard = 0; node && guard < 200; guard += 1) {
            const parent = node.parentNode;
            if (!parent) break;
            /* The document's one element child is <html>; there is nothing beside it
             * to isolate, and marking it would inert the dialog with everything else. */
            if (parent.nodeType === 9 /* Node.DOCUMENT_NODE */) break;

            for (const sibling of parent.children ?? []) {
                if (sibling === node || marked.has(sibling)) continue;
                if (sibling.inert === true) continue;
                if (NON_RENDERED_TAGS.includes(sibling.tagName)) continue;
                /* cross-1: a status region is not background. See LIVE_REGION_SELECTOR. */
                if (sibling.matches?.(LIVE_REGION_SELECTOR)) continue;
                sibling.inert = true;
                marked.add(sibling);
            }

            const slot = node.assignedSlot;
            if (slot) { node = slot; continue; }

            /* Otherwise up one level, crossing a shadow root to its host: a
             * ShadowRoot has no parentNode of its own. */
            node = parent.host ?? parent;
        }
        this.#inerted = [...marked];
    }

    /** Exactly what was marked, and nothing else. */
    #releaseInert() {
        for (const element of this.#inerted) element.inert = false;
        this.#inerted = [];
    }

    #onKeydown = (event) => {
        if (event.key === 'Escape' || event.keyCode === 27) {
            if (this.#nestedOverlayOwns(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            if (this.topmost) this.requestClose('escape');
            return;
        }
        if (event.key !== 'Tab') return;

        const items = this.tabbables;
        const dialog = this.dialog;
        if (!items.length) {
            /* Nothing to cycle: the caret stays on the dialog box rather than
             * stepping out to body and leaving a modal dialog behind it. */
            event.preventDefault();
            dialog?.focus?.();
            return;
        }
        const target = trapTarget(items, deepActiveElement(), { backwards: event.shiftKey });
        if (!target) return;   /* an interior step: the browser's own is the right one */
        event.preventDefault();
        target.focus();
    };

    #nestedOverlayOwns(event) {
        const boundary = this.dialog;
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (node === boundary) return false;
            if (isOpenOverlay(node)) return true;
        }
        return false;
    }

    #onCancel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.topmost) this.requestClose('escape');
    };

    /** A native close this component did not ask for — see firstUpdated(). */
    #onNativeClose = () => {
        if (!this.open) return;
        if (this.dialog?.open) return;
        this.#reason = 'native';
        this.open = false;
        this.#dismiss();
    };

    #pointInCard(event) {
        const box = this.dialog?.getBoundingClientRect();
        if (!box) return false;
        return event.clientX >= box.left && event.clientX <= box.right
            && event.clientY >= box.top && event.clientY <= box.bottom;
    }

    #onPointerDown = (event) => {
        this.#pressOutside = event.target === this.dialog && !this.#pointInCard(event);
    };

    #onClick = (event) => {
        const startedOutside = this.#pressOutside;
        this.#pressOutside = null;
        if (event.target !== this.dialog) return;
        if (this.#pointInCard(event)) return;
        if (startedOutside === false) return;
        this.requestClose('backdrop');
    };

    #onHeaderSlotChange = (event) => {
        this._hasHeader = event.target.assignedElements({ flatten: true }).length > 0;
    };

    #onHeaderTrailSlotChange = (event) => {
        this._hasHeaderTrail = event.target.assignedElements({ flatten: true }).length > 0;
    };

    #onActionsSlotChange = (event) => {
        this._hasActions = event.target.assignedElements({ flatten: true }).length > 0;
    };

    render() {
        const headed = this.headed;
        const sheet = !this._hasHeader;
        const name = this.accessibleName;
        const classes = ['dialog', headed ? 'has-head' : '', this._hasActions ? 'has-actions' : '']
            .filter(Boolean).join(' ');

        return html`<dialog
            id="dialog"
            class=${classes}
            tabindex="-1"
            aria-modal="true"
            aria-label=${name || nothing}
            @cancel=${this.#onCancel}
            @pointerdown=${this.#onPointerDown}
            @click=${this.#onClick}
        >
            <div id="head" class=${['cell', 'head', sheet ? 'sheet' : '', headed ? '' : 'is-empty'].filter(Boolean).join(' ')}
            ><slot name="header" @slotchange=${this.#onHeaderSlotChange}></slot
            >${sheet ? html`<ui-sheet-header heading=${this.heading} level=${this.level}
                ><slot name="header-trail" slot="trail" @slotchange=${this.#onHeaderTrailSlotChange}></slot
                ></ui-sheet-header>` : nothing}</div
            ><div id="body" class="cell body"
            ><slot name="body"></slot><slot></slot></div
            ><div id="actions" class=${this._hasActions ? 'cell actions' : 'cell actions is-empty'}
            ><slot name="actions" @slotchange=${this.#onActionsSlotChange}></slot></div>
        </dialog>`;
    }
}

customElements.define('ui-dialog', UiDialog);
