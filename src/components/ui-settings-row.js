/**
 * <ui-settings-row> — one setting: a heading, optional hint and caption, an optional
 * live reading, and a control slotted beside them.
 *
 * The row names the control it is given. It owns no range table and no formatting
 * beyond the absence glyph: a caller passes strings.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { isNoReading, toText } from 'src/data/reading.js';

/* The absence glyph. A property so the module stays free of i18n. */
export const DEFAULT_DASH = '—';

/* Native elements that can carry an accessible name without being given a role —
   the set aria-label is defined to apply to. */
const NAMEABLE_ELEMENTS = new Set([
    'button', 'input', 'select', 'textarea', 'meter', 'progress', 'output',
]);

/* How a control was named, so the row can un-name exactly what it named. */
const BY_PROPERTY = 'property';
const BY_ATTRIBUTE = 'attribute';

/* Whether an element can carry an accessible name at all. */
function isNameable(el) {
    if (el.hasAttribute('role')) return true;
    if (el.localName === 'a') return el.hasAttribute('href');
    return NAMEABLE_ELEMENTS.has(el.localName);
}

/* Roles whose accessible name comes from the element's own contents. Naming one
   from outside would replace what it already says. */
const NAME_FROM_CONTENTS_ROLES = new Set([
    'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link',
    'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row',
    'rowheader', 'switch', 'tab', 'tooltip', 'treeitem',
]);

/* The implicit roles of the native elements a settings row may be handed. */
const IMPLICIT_ROLES = new Map([
    ['button', 'button'], ['summary', 'button'],
    ['h1', 'heading'], ['h2', 'heading'], ['h3', 'heading'],
    ['h4', 'heading'], ['h5', 'heading'], ['h6', 'heading'],
    ['td', 'cell'], ['th', 'columnheader'], ['option', 'option'], ['li', 'listitem'],
    ['input', 'textbox'], ['select', 'combobox'], ['textarea', 'textbox'],
    ['meter', 'meter'], ['progress', 'progressbar'], ['output', 'status'],
]);

/* The role this element exposes: an explicit role wins, else the native's implicit
   one. '' means it cannot carry a name. */
function roleOf(el) {
    const explicit = String(el.getAttribute('role') ?? '').trim().split(/\s+/)[0];
    if (explicit) return explicit.toLowerCase();
    if (el.localName === 'a') return el.hasAttribute('href') ? 'link' : '';
    return IMPLICIT_ROLES.get(el.localName) ?? '';
}

/* The text the element would expose as its own name: light-DOM text not assigned to
   a named slot. */
function ownText(el) {
    let text = '';
    for (const node of el.childNodes) {
        if (node.nodeType === 1 && node.hasAttribute('slot')) continue;
        text += node.textContent ?? '';
    }
    return text.trim();
}

/* Does the control's visible text already give it its name? Both conditions matter:
   the text must exist, and the role must take its name from contents. */
function namesItself(el) {
    if (ownText(el) === '') return false;
    const role = roleOf(el);
    if (role === '') return el.localName.includes('-');
    return NAME_FROM_CONTENTS_ROLES.has(role);
}

export class UiSettingsRow extends UiElement {
    static properties = {
        /* The label. */
        heading: { type: String },
        /* The range hint beside the heading, already composed — this component owns no
           range table. */
        hint: { type: String },
        /* Explanatory copy under the label. */
        caption: { type: String },
        /* A second caption paragraph in the same role. Not a variant of the first and not
           a concatenation: two paragraphs read as two. */
        note: { type: String },
        /* The live reading: a number, a string, or an absence object. Unset renders no
           reading element at all. */
        reading: {},
        /* Formatter for a numeric reading. */
        readingFormat: { attribute: false },
        /* The absence glyph. */
        dash: { type: String },
        /* Overrides the name handed to the control; defaults to the heading. */
        controlLabel: { type: String, attribute: 'control-label' },
        /* Stop handing the accessible name to the slotted control. */
        noAutoLabel: { type: Boolean, reflect: true, attribute: 'no-auto-label' },
    };

    static styles = [
        /* The structural fragment is :where()-wrapped throughout, so the row's own rules
           below win without a specificity contest. */
        typeRoles,
        css`
            :host {
                display: flex;

                /* The wrap is intrinsic. No media query decides it, so there is no breakpoint to be
                   wrong at one geometry and right at another. */
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;

                gap: var(--ui-space-5);

                /* A floor, not a height: a row with a caption and a reading grows. */
                min-block-size: var(--ui-control-h);

                padding-block: var(--ui-space-3);

                /* The row paints its own ground: a cell that inherits one shows the seam through. */
                background-color: var(--ui-fascia);

                /* The label block's floor is declared on the host and consumed below. On .label it
                   would be scoped to the element that has to read it. */
                --_ui-settings-row-label-min: calc(var(--ui-control-h) * 4);
            }

            .label {
                display: flex;
                flex: 1 1 var(--_ui-settings-row-label-min);
                flex-direction: column;
                gap: var(--ui-space-1);
                min-inline-size: min(100%, var(--_ui-settings-row-label-min));

                /* The label stops beside the widest control on the page, not beside its own, so a
                   column of rows has one text edge. */
                max-inline-size: calc(
                    100% - var(--_ui-leaf-control-w, 0px) - 2 * var(--ui-space-5)
                );
            }

            /* Heading and hint share a baseline. */
            .line {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: var(--ui-space-3);
                min-inline-size: 0;
            }

            /* The heading declares no type: the heading role carries it. */
            .heading,
            .hint {
                min-inline-size: 0;
                /* An unbroken token breaks rather than spilling out of the row. */
                overflow-wrap: anywhere;
            }

            /* The hint takes the body type and the muted ink — it is an aside, not a heading. */
            .hint {
                color: var(--ui-muted);
            }

            /* The live reading is an aside and takes the same type as the hint, so the two
               asides in this row read alike. */
            .reading {
                margin: 0;
                color: var(--ui-muted);
            }

            /* flex: none — a control holds its stated size, and the label gives instead. */
            .control {
                display: flex;
                flex: none;
                align-items: center;
                gap: var(--ui-space-3);
            }
        `,
    ];

    /* What this row named, and how, so it can un-name exactly that. */
    #named = new WeakMap();

    constructor() {
        super();
        this.heading = '';
        this.hint = '';
        this.caption = '';
        this.note = '';
        this.reading = undefined;
        this.readingFormat = null;
        this.dash = DEFAULT_DASH;
        this.controlLabel = '';
        this.noAutoLabel = false;
    }

    /* The assigned control elements. */
    get control() {
        const slot = this.renderRoot?.querySelector?.('#control-slot');
        return slot ? slot.assignedElements({ flatten: true }) : [];
    }

    /* The reading as text. Three outcomes and no fourth: nothing when unset, the dash
       for an absence, the formatted value otherwise. */
    get readingText() {
        const value = this.reading;
        /* Unset or null is "no live reading" and renders nothing. The empty string is the
           attribute form of an absence and renders the dash. */
        if (value === undefined || value === null) return null;
        if (value === '') return this.dash;
        if (isNoReading(value)) return this.dash;
        if (typeof value === 'number') {
            /* toText turns a non-finite number into the dash rather than the string "NaN". */
            return toText(value, this.readingFormat || String, this.dash);
        }
        if (typeof value === 'string') return value;
        return this.dash;
    }

    /* The name this row would hand to its control. */
    get #controlName() {
        return String(this.controlLabel || this.heading || '').trim();
    }

    /* Hand the row's label to the slotted control. aria-labelledby cannot cross a
       shadow root, so the name is copied rather than referenced. */
    #applyNames() {
        const name = this.noAutoLabel ? '' : this.#controlName;

        for (const el of this.control) {
            /* A custom element that has not upgraded has no label accessor and no role, so it
               would be skipped forever. Wait for it. */
            if (el.localName.includes('-') && !customElements.get(el.localName)) {
                customElements.whenDefined(el.localName)
                    .then(() => { if (this.isConnected) this.#applyNames(); })
                    .catch(() => {});
                continue;
            }

            const mine = this.#named.get(el) ?? null;

            /* Rule 0 — a control that names itself keeps that name. A button reading "Start" in
               a row headed "Descale the machine" must not be announced as the heading. */
            if (namesItself(el)) continue;

            /* Rule 1 — a ui-* control with its own label property takes it there. */
            if ('label' in el) {
                const authored = String(el.label ?? '').trim() !== '';
                if (authored && mine !== BY_PROPERTY) continue;   // the author's name wins
                if (!name) {
                    if (mine === BY_PROPERTY) { el.label = ''; this.#named.delete(el); }
                    continue;
                }
                if (el.label !== name) el.label = name;
                this.#named.set(el, BY_PROPERTY);
                continue;
            }

            /* Rule 3, stated first as a guard: never name a role-less generic. A name on a
               generic is announced by nothing and hides the real one. */
            if (!isNameable(el)) continue;

            /* Rule 2 — anything that can carry a name gets aria-label. */
            const authored = el.hasAttribute('aria-labelledby')
                || (el.hasAttribute('aria-label') && mine !== BY_ATTRIBUTE);
            if (authored) continue;
            if (!name) {
                if (mine === BY_ATTRIBUTE) { el.removeAttribute('aria-label'); this.#named.delete(el); }
                continue;
            }
            if (el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
            this.#named.set(el, BY_ATTRIBUTE);
        }
    }

    #onSlotChange = () => { this.#applyNames(); };

    updated(changed) {
        super.updated?.(changed);
        this.#applyNames();
    }

    render() {
        const heading = String(this.heading ?? '').trim();
        const hint = String(this.hint ?? '').trim();
        const caption = String(this.caption ?? '').trim();
        const note = String(this.note ?? '').trim();
        const reading = this.readingText;

        return html`
            <div id="label" class="label">
                ${heading || hint
                    ? html`<div id="line" class="line">
                        ${heading ? html`<p id="heading" class="ui-heading heading">${heading}</p>` : nothing}
                        ${hint ? html`<span id="hint" class="ui-body hint">${hint}</span>` : nothing}
                    </div>`
                    : nothing}
                ${reading === null
                    ? nothing
                    : html`<p id="reading" class="ui-body ui-numeric reading">${reading}</p>`}
                ${caption ? html`<p id="caption" class="ui-caption caption">${caption}</p>` : nothing}
                ${note ? html`<p id="note" class="ui-caption caption">${note}</p>` : nothing}
            </div>
            <div id="control" class="control">
                <slot id="control-slot" @slotchange=${this.#onSlotChange}></slot>
            </div>
        `;
    }
}

customElements.define('ui-settings-row', UiSettingsRow);
