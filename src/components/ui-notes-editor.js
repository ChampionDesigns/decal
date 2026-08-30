/**
 * A markdown notes field with its preview.
 */

import 'easymde';
import { css, html } from 'lit';
import {
    UiElement,
    adoptStyleSheet,
    hasAdoptedSheet,
    selectionSurface,
    visuallyHidden,
} from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/** Resolved against this module, so it does not care what the served root is —
 *  base.js:620 does the same for uPlot's. */
export const EASYMDE_STYLESHEET_URL = new URL('../../vendor/easymde.min.css', import.meta.url).href;

const vendorSheetCache = new Map();

export function loadLayeredVendorSheet({ fetch: fetchImpl = globalThis.fetch } = {}) {
    const href = EASYMDE_STYLESHEET_URL;
    let pending = vendorSheetCache.get(href);
    if (pending === undefined) {
        pending = Promise.resolve(fetchImpl(href))
            .then((response) => {
                if (!response.ok) throw new Error(`ui-notes-editor: ${response.status} for ${href}`);
                return response.text();
            })
            .then((cssText) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(`@layer ui-vendor {\n${cssText}\n}`);
                return sheet;
            })
            .catch((error) => {
                /* Do not cache a failure: one transient fetch error must not leave
                 * every later notes dialog permanently unstyled. base.js:645-650. */
                vendorSheetCache.delete(href);
                throw error;
            });
        vendorSheetCache.set(href, pending);
    }
    return pending;
}

const ICON_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
const ICON_CLOSE = '</svg>';

const ICON_PATHS = Object.freeze({
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7Zm0 8h7a4 4 0 0 1 0 8H7Z"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
    'unordered-list': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    'ordered-list': '<path d="M10 6h10M10 12h10M10 18h10M4 5h1v3M3 14c0-1 2-2 2-3s-2-1-2 0M3 17h2l-2 3h2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
    quote: '<path d="M10 11H5a4 4 0 0 0 4 4v3H5a7 7 0 0 1 0-14h5ZM21 11h-5a4 4 0 0 0 4 4v3h-4a7 7 0 0 1 0-14h5Z"/>',
    'horizontal-rule': '<path d="M4 12h16"/>',
    preview: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
});

const TOOLBAR_SPEC = Object.freeze([
    { name: 'bold', title: 'Bold', toggle: true },
    { name: 'italic', title: 'Italic', toggle: true },
    { name: 'heading', title: 'Heading', toggle: true },
    { sep: true },
    { name: 'unordered-list', title: 'Bulleted list', toggle: true },
    { name: 'ordered-list', title: 'Numbered list', toggle: true },
    { sep: true },
    { name: 'link', title: 'Insert link', toggle: false },
    { name: 'quote', title: 'Quote', toggle: true },
    { name: 'horizontal-rule', title: 'Horizontal rule', toggle: false },
    { sep: true },
    { name: 'preview', title: 'Preview', toggle: true },
]);

/** EasyMDE's own action for each name. Read at build time, not at module load: the
 *  global is installed by the side-effect import above. */
function easyMdeActions(EasyMDE) {
    return {
        bold: EasyMDE.toggleBold,
        italic: EasyMDE.toggleItalic,
        heading: EasyMDE.toggleHeadingSmaller,
        'unordered-list': EasyMDE.toggleUnorderedList,
        'ordered-list': EasyMDE.toggleOrderedList,
        link: EasyMDE.drawLink,
        quote: EasyMDE.toggleBlockquote,
        'horizontal-rule': EasyMDE.drawHorizontalRule,
        preview: EasyMDE.togglePreview,
    };
}

const KEY_CLASS = 'ui-mde-key';

export class UiNotesEditor extends UiElement {
    static properties = {
        /** The markdown handed in. The SEED, not the live text — see `text`. */
        value: { type: String },
        /** Empty-state prompt inside the editing surface. */
        placeholder: { type: String },
        /** Accessible name of the editing surface. */
        label: { type: String },
        /** Accessible name of the key bank. */
        toolbarLabel: { type: String, attribute: 'toolbar-label' },
        /** Reflected: the base paints it, and the document goes read-only. */
        disabled: { type: Boolean, reflect: true },
        readonly: { type: Boolean, reflect: true },
        /** Opt-in. While `dirty`, refuse #18's cancellable `close-request`. */
        guardUnsaved: { type: Boolean, attribute: 'guard-unsaved' },
        /** What the guard SAYS when it refuses. Overrides the shipped sentence. */
        guardRefusal: { type: String, attribute: 'guard-refusal' },
        /** Internal: is anything slotted into `subject`? Drives the row's presence. */
        _hasSubject: { type: Boolean, state: true },
        _refused: { type: Boolean, state: true },
    };

    static styles = [visuallyHidden, css`
        :host {
            --_ui-notes-min-h: calc(2 * var(--ui-control-h) + 2 * var(--ui-space-4));

            block-size: 100%;
            min-block-size: 0;
        }

        #frame {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: var(--ui-space-4);
            block-size: 100%;
            min-block-size: 0;
        }

        /* The optional subject row. Absent means absent: a zero-height grid row
         * still eats a gap, which is the "one leaf sits 12px lower" family (T13). */
        #subject-row {
            display: block;
        }

        #frame:not(.has-subject) {
            grid-template-rows: minmax(0, 1fr);
        }

        #frame:not(.has-subject) #subject-row {
            display: none;
        }

        .refusal {
            display: block;
            max-inline-size: var(--ui-measure);
            margin: 0;
            color: var(--ui-status-danger);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);
            line-height: 1.5;
        }

        #frame:not(.has-refusal) .refusal {
            display: none;
        }

        #editor {
            --_ui-focus-offset: var(--ui-focus-offset-inset);

            display: flex;
            min-block-size: 0;
            min-inline-size: 0;
        }

        .EasyMDEContainer {
            display: flex;
            flex: 1 1 0;
            flex-direction: column;
            min-block-size: 0;
            min-inline-size: 0;
            inline-size: 100%;
        }

        .editor-toolbar {
            display: flex;
            flex: 0 0 auto;
            align-items: stretch;
            min-block-size: var(--ui-control-h);
            margin: 0;
            padding: 0;
            overflow-x: auto;
            overflow-y: hidden;
            border: var(--ui-border-w) solid var(--ui-line);
            border-start-start-radius: var(--ui-radius);
            border-start-end-radius: var(--ui-radius);
            border-end-start-radius: 0;
            border-end-end-radius: 0;
            background-color: var(--ui-key);
            opacity: 1;
        }

        .ui-mde-key {
            display: inline-grid;
            flex: 0 0 auto;
            place-items: center;
            inline-size: var(--ui-control-h);
            min-inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            margin: 0;
            padding: 0;
            border: 0;
            border-radius: 0;
            background-color: var(--ui-key);
            color: var(--ui-text-2);
            font: inherit;
            cursor: pointer;
        }

        :where(.ui-mde-key + .ui-mde-key) {
            --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);

            box-shadow: var(--_ui-rest-shadow);
        }

        .ui-mde-key svg {
            display: block;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            fill: none;
            stroke: currentColor;
            stroke-width: 1.6;
            stroke-linecap: round;
            stroke-linejoin: round;
            pointer-events: none;
        }

        .ui-mde-key:hover {
            background-color: var(--ui-key-on);
            color: var(--ui-text);
        }

        :host([readonly]) .editor-toolbar {
            display: none;
        }

        :host([readonly]) .CodeMirror {
            border-block-start: var(--ui-border-w) solid var(--ui-line);
            border-start-start-radius: var(--ui-radius);
            border-start-end-radius: var(--ui-radius);
        }

        :host([disabled]) .ui-mde-key {
            opacity: 1;
        }

        .editor-toolbar i.separator {
            flex: 0 0 auto;
            align-self: center;
            inline-size: var(--ui-hairline);
            block-size: calc(var(--ui-control-h) / 2);
            margin: 0 var(--ui-space-2);
            border: 0;
            background-color: var(--ui-line-strong);
            color: transparent;
            font-size: 0;
        }

        .CodeMirror {
            flex: 1 1 0;
            min-block-size: var(--_ui-notes-min-h);
            padding: var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-block-start: 0;
            border-start-start-radius: 0;
            border-start-end-radius: 0;
            border-end-start-radius: var(--ui-radius);
            border-end-end-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            line-height: 1.6;
        }

        .CodeMirror:has(:focus-visible) {
            outline: var(--ui-focus-w) solid var(--ui-steel);
            outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
        }

        .CodeMirror textarea:focus-visible {
            outline: none;
        }

        .CodeMirror-cursor {
            border-inline-start-color: var(--ui-text);
        }

        .CodeMirror-selected,
        .CodeMirror-focused .CodeMirror-selected {
            background-color: color-mix(in srgb, var(--ui-steel) 18%, transparent);
        }

        .CodeMirror-placeholder {
            color: var(--ui-muted);
        }

        .CodeMirror-gutters {
            border-inline-end-color: var(--ui-line);
            background-color: var(--ui-key);
        }

        .editor-preview,
        .editor-preview-side {
            padding: var(--ui-space-5);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            line-height: 1.6;
        }
    `, selectionSurface];

    /** The EasyMDE instance. Null until `ready` settles. */
    #mde = null;

    /** The layered vendor sheet, once adopted. */
    #sheet = null;

    /** Resolves when the editor exists (or rejects with the reason it does not). */
    #ready = null;

    #resolveReady = null;

    /** The text last written INTO the editor. `dirty` is measured against it. */
    #seed = '';

    /** Guards the property → editor write against the editor → property echo. */
    #writing = false;

    #resizeObserver = null;

    /** The <ui-dialog> this body is slotted into, while `guard-unsaved` is on. */
    #guardedDialog = null;

    #onCloseRequest = null;

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.label = '';
        this.toolbarLabel = '';
        this.disabled = false;
        this.readonly = false;
        this.guardUnsaved = false;
        this._hasSubject = false;
        this.i18n = new I18nController(this);
        this.#ready = new Promise((resolve) => { this.#resolveReady = resolve; });
    }

    /** The EasyMDE instance, for a screen that needs its API. Null before `ready`. */
    get editor() { return this.#mde; }

    /** Has the editor been built? The boolean half of `ready`. */
    get editorReady() { return this.#mde !== null; }

    /** Settles when the editor exists. */
    get ready() { return this.#ready; }

    get sheetAdopted() {
        return this.#sheet !== null && hasAdoptedSheet(this.renderRoot, this.#sheet);
    }

    /** The LIVE text. `value` is the seed; this is what the user has typed. */
    get text() {
        return this.#mde ? this.#mde.value() : (this.value ?? '');
    }

    get dirty() {
        return this.text !== this.#seed;
    }

    /** Every key in the bank, in DOM order. */
    get toolbarKeys() {
        return Array.from(this.renderRoot?.querySelectorAll?.(`.${KEY_CLASS}`) ?? []);
    }

    /** The bank itself. */
    get toolbar() {
        return this.renderRoot?.querySelector?.('.editor-toolbar') ?? null;
    }

    /** Put the caret in the document. */
    async focusEditor() {
        await this.#ready;
        this.#mde?.codemirror?.focus?.();
    }

    /** Take the current text as the new baseline — what a screen calls after a save. */
    markSaved() {
        this.#seed = this.text;
    }

    /** Re-measure. CodeMirror caches its own metrics and needs telling. */
    refresh() {
        this.#mde?.codemirror?.refresh?.();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#resizeObserver?.disconnect?.();
        this.#resizeObserver = null;
        this.#detachGuard();
    }

    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        this.#build().catch((error) => {
            /* Rethrow asynchronously so a failed build is a page error the suite
             * sees, rather than an unhandled rejection nothing reads. */
            setTimeout(() => { throw error; });
        });
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('value') && !this.#writing) this.#seedEditor(this.value ?? '');
        if (changed.has('disabled') || changed.has('readonly')) this.#applyDisabled();
        if (changed.has('placeholder')) this.#mde?.codemirror?.setOption?.('placeholder', this.placeholderText);
        if (changed.has('label')) this.#applyEditorLabel();
        if (changed.has('toolbarLabel')) this.#applyToolbarLabel();
        if (changed.has('guardUnsaved')) this.#applyGuard();
    }

    get labelText() { return this.label || this.i18n.t('Notes'); }

    get toolbarLabelText() { return this.toolbarLabel || this.i18n.t('Formatting'); }

    get placeholderText() {
        /* notes-modal.js:199 — the same prompt, with the same ellipsis character. */
        return this.placeholder || this.i18n.t('Write your notes here…');
    }

    async #build() {
        await this.#adoptVendorSheet();

        const EasyMDE = globalThis.EasyMDE;
        if (typeof EasyMDE !== 'function') {
            throw new Error(
                'ui-notes-editor: `import "easymde"` did not install window.EasyMDE. '
                + 'The vendored file is a UMD build that evaluates for side effect '
                + '(vendor/README.md:116); check the importmap entry.',
            );
        }

        const host = this.renderRoot.querySelector('#editor');
        const area = document.createElement('textarea');
        host.appendChild(area);

        this.#mde = new EasyMDE({
            element: area,
            spellChecker: false,
            status: false,
            autoDownloadFontAwesome: false,
            autosave: { enabled: false },
            placeholder: this.placeholderText,
            toolbar: this.#toolbar(EasyMDE),
            minHeight: '100%',
            maxHeight: '100%',
        });

        this.#decorateToolbar();
        this.#applyEditorLabel();
        this.#hideVendorScaffolding();
        this.#applyToolbarLabel();
        this.#seedEditor(this.value ?? '');
        this.#applyDisabled();
        this.#applyGuard();

        const cm = this.#mde.codemirror;
        cm.on('change', this.#onEditorChange);
        /* Registered AFTER construction, so EasyMDE's own cursorActivity handler —
         * the one that writes `.active` — has already run when this fires. */
        cm.on('cursorActivity', this.#syncPressedState);
        cm.on('update', this.#syncPressedState);
        this.#syncPressedState();

        /* C11: "The overlays have no ResizeObserver at all." CodeMirror caches its
         * own metrics, so a dialog that changes size leaves the caret in the wrong
         * place until something calls refresh(). */
        this.#resizeObserver = new ResizeObserver(() => this.refresh());
        this.#resizeObserver.observe(this);

        this.#resolveReady(this);
        return this;
    }

    async #adoptVendorSheet() {
        if (this.sheetAdopted) return true;
        this.#sheet = await loadLayeredVendorSheet();
        adoptStyleSheet(this.renderRoot, this.#sheet, { position: 'before' });
        if (!this.sheetAdopted) {
            throw new Error(
                'ui-notes-editor: vendor/easymde.min.css is not in this shadow root. '
                + 'Measured without it: .CodeMirror-scroll computes overflow: visible '
                + 'instead of scroll and .CodeMirror-cursor becomes a 600x20 STATIC '
                + 'block instead of a 1x24 absolute caret — an editor that looks '
                + 'right in a screenshot and cannot be used (CONVENTIONS §8).',
            );
        }
        return true;
    }

    /** EasyMDE's toolbar array, built from TOOLBAR_SPEC. */
    #toolbar(EasyMDE) {
        const actions = easyMdeActions(EasyMDE);
        return TOOLBAR_SPEC.map((row) => {
            if (row.sep) return '|';
            return {
                name: row.name,
                title: this.i18n.t(row.title),
                action: actions[row.name],
                className: `${row.name} ${KEY_CLASS}`,
                icon: ICON_OPEN + ICON_PATHS[row.name] + ICON_CLOSE,
            };
        });
    }

    #decorateToolbar() {
        const bank = this.toolbar;
        if (!bank) return;
        bank.setAttribute('aria-orientation', 'horizontal');
        const keys = this.toolbarKeys;
        keys.forEach((key, i) => {
            key.tabIndex = i === 0 ? 0 : -1;
        });
        bank.addEventListener('keydown', this.#onToolbarKeydown);
        bank.addEventListener('focusin', this.#onToolbarFocusIn);
        bank.addEventListener('click', this.#syncPressedState);
    }

    #onToolbarKeydown = (event) => {
        const keys = this.toolbarKeys.filter((k) => !k.disabled);
        if (keys.length === 0) return;
        const from = keys.indexOf(event.target.closest?.(`.${KEY_CLASS}`));
        let to = null;
        if (event.key === 'ArrowRight') to = from < 0 ? 0 : (from + 1) % keys.length;
        else if (event.key === 'ArrowLeft') to = from < 0 ? keys.length - 1 : (from - 1 + keys.length) % keys.length;
        else if (event.key === 'Home') to = 0;
        else if (event.key === 'End') to = keys.length - 1;
        if (to === null) return;
        event.preventDefault();
        event.stopPropagation();
        keys[to].focus();
    };

    /** The roving half: whichever key has the caret is the one in the tab order. */
    #onToolbarFocusIn = (event) => {
        const focused = event.target.closest?.(`.${KEY_CLASS}`);
        if (!focused) return;
        for (const key of this.toolbarKeys) key.tabIndex = key === focused ? 0 : -1;
    };

    #syncPressedState = () => {
        for (const row of TOOLBAR_SPEC) {
            if (row.sep || !row.toggle) continue;
            const key = this.renderRoot?.querySelector?.(`.${KEY_CLASS}.${row.name}`);
            if (!key) continue;
            key.setAttribute('aria-pressed', key.classList.contains('active') ? 'true' : 'false');
        }
    };

    /** The editing surface's accessible name. CodeMirror's real input is a hidden
     *  textarea with no name of its own — the same shape of hole as O9's unnamed
     *  backspace, one component over. */
    #applyEditorLabel() {
        const input = this.#mde?.codemirror?.getInputField?.();
        if (input) input.setAttribute('aria-label', this.labelText);
    }

    #hideVendorScaffolding() {
        const root = this.renderRoot;
        if (!root) return;
        /* The textarea EasyMDE was built on — NOT `getInputField()`, which is the real
         * one and must stay in the tree. Identity, not a selector, so this can never
         * hide the wrong textarea. */
        const backing = root.querySelector('#editor > textarea');
        const live = this.#mde?.codemirror?.getInputField?.();
        if (backing && backing !== live) {
            backing.setAttribute('aria-hidden', 'true');
            backing.tabIndex = -1;
        }
        for (const el of root.querySelectorAll(
            '.CodeMirror-vscrollbar, .CodeMirror-hscrollbar,'
            + ' .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler',
        )) {
            el.setAttribute('aria-hidden', 'true');
        }
    }

    #applyToolbarLabel() {
        this.toolbar?.setAttribute?.('aria-label', this.toolbarLabelText);
    }

    #applyDisabled() {
        if (!this.#mde) return;
        const locked = this.disabled || this.readonly;
        this.#mde.codemirror.setOption('readOnly', locked ? 'nocursor' : false);
        for (const key of this.toolbarKeys) key.disabled = locked;
    }

    #seedEditor(text) {
        this.#seed = text;
        if (!this.#mde) return;
        if (this.#mde.value() === text) return;
        this.#writing = true;
        try {
            this.#mde.value(text);
        } finally {
            this.#writing = false;
        }
    }

    #onEditorChange = () => {
        if (this.#writing) return;
        if (this._refused) this._refused = false;
        this.dispatchEvent(new CustomEvent('notes-input', {
            detail: { value: this.text, dirty: this.dirty },
            bubbles: true,
            composed: true,
        }));
    };

    #applyGuard() {
        this.#detachGuard();
        this._refused = false;
        if (!this.guardUnsaved) return;
        const dialog = this.closest('ui-dialog');
        if (!dialog) return;
        this.#onCloseRequest = (event) => {
            if (!this.dirty) {
                this._refused = false;
                return;
            }
            event.preventDefault();
            this._refused = true;
        };
        dialog.addEventListener('close-request', this.#onCloseRequest);
        this.#guardedDialog = dialog;
    }

    #detachGuard() {
        if (this.#guardedDialog && this.#onCloseRequest) {
            this.#guardedDialog.removeEventListener('close-request', this.#onCloseRequest);
        }
        this.#guardedDialog = null;
        this.#onCloseRequest = null;
    }

    #onSubjectSlotChange = (event) => {
        this._hasSubject = event.target.assignedNodes({ flatten: true })
            .some((n) => n.nodeType !== Node.TEXT_NODE || n.textContent.trim() !== '');
    };

    get guardRefusalText() {
        return this.guardRefusal
            || this.i18n.t('This note has unsaved changes. Save it, or discard them, before closing.');
    }

    render() {
        const classes = [
            this._hasSubject ? 'has-subject' : '',
            this._refused ? 'has-refusal' : '',
        ].filter(Boolean).join(' ');
        return html`
            <div id="frame" class=${classes}>
                <div id="subject-row"><slot name="subject" @slotchange=${this.#onSubjectSlotChange}></slot></div>
                <div id="editor"></div>
                <!-- WHY THE DIALOG DID NOT CLOSE (F-007). The house refusal idiom, the
                     same shape editor-screen.js renders for a refused rename and
                     settings-screen.js for its two: a caption paragraph with
                     role=status, at the work it is about.
                     IT IS ALWAYS IN THE DOM, unlike those two, and that is deliberate
                     rather than a departure: a live region a screen reader has been
                     watching since first paint announces a change to its text, while
                     one that is INSERTED carrying its message is a new node and may
                     announce nothing at all. The row collapses to zero when empty, so
                     the layout cost is the same as a conditional render. -->
                <p id="refusal" class="refusal" role="status"
                    >${this._refused ? this.guardRefusalText : ''}</p>
            </div>`;
    }
}

customElements.define('ui-notes-editor', UiNotesEditor);
