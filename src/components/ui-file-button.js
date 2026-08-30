/**
 * ui-file-button.js — A BUTTON THAT ASKS FOR A FILE.
 *
 * WHY IT EXISTS, and why it is a component rather than an input in a screen. Two
 * surfaces need a file off the tablet and neither had a way to ask for one:
 *
 *   the profile library   Ben, 24 Aug 2026 — "We should add Upload, import and the
 *                         generate one". Slate reads a .json profile off disk and POSTs
 *                         it (`profileManager.js handleProfileUpload`).
 *   the firmware leaf     Ben, same day — "I should be able to pick a file, but it
 *                         should also have a 'latest' button that pulls it."
 *
 * A screen that authored its own `<input type="file">` would be the L8 defect class
 * twice, and the second copy is where the two drift: one accepts a wrong extension, one
 * forgets to clear `value` and refuses the same file twice.
 *
 * THE INPUT IS HIDDEN AND THE BUTTON IS THE CONTROL. A native file input paints
 * differently in every engine and cannot be styled to this skin, so the pattern
 * everywhere is a button that clicks a hidden input. What that costs, and what this file
 * pays so no caller has to:
 *
 *   `value` IS CLEARED AFTER EVERY PICK. Without it, choosing the same file twice fires
 *   nothing the second time — the input's value did not change, so no `change` event.
 *   That is the classic "it worked once" bug in every hand-rolled version of this.
 *
 *   THE HIDDEN INPUT IS NOT `display: none`. A display-none input is not focusable and
 *   some engines refuse to open the picker for it. It is a 0-size clipped box that stays
 *   in the layout, and `aria-hidden` keeps it out of the accessibility tree — the BUTTON
 *   is the control, and announcing both would announce the same thing twice.
 *
 *   CANCELLING IS SILENT. A picker the user dismissed fires no `change` in most engines
 *   and an empty `files` list in the rest; both are "nothing was chosen", and neither is
 *   an error worth reporting.
 *
 * IT READS NOTHING. The File object leaves as an event and this element never opens it:
 * what a file MEANS — a profile to validate, an image to push — belongs to the caller,
 * and a component that parsed one would have to know which.
 *
 * API
 *   <ui-file-button accept=".json,application/json" label="Upload a profile">Upload</ui-file-button>
 *   <ui-file-button variant="primary" tall>                 pass-through to <ui-button>
 *   <ui-file-button disabled>
 *
 *   Events: `file-pick` — CustomEvent, bubbles, composed, `detail: {file, name, size}`.
 */

import { html, css, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-button.js';

export class UiFileButton extends UiElement {
    static properties = {
        /** The `accept` attribute, verbatim. A hint to the picker, never a guarantee. */
        accept: { type: String },
        /** Accessible name, when the slotted label is a glyph. */
        label: { type: String },
        /** Pass-through to the button underneath: 'default' | 'primary' | 'ghost' | 'danger'. */
        variant: { type: String, reflect: true },
        /** Pass-through: the header height. */
        tall: { type: Boolean, reflect: true },
        /** Paint AND refusal, on both the button and the input. */
        disabled: { type: Boolean, reflect: true },

        /**
         * Take MORE THAN ONE file in a single pick.
         *
         * The event's `file` stays the first one either way, so every existing caller is
         * untouched; `files` carries the whole list. Added for the screen saver, which
         * takes a set of pictures rather than one file (Ben, 26 Aug 2026).
         */
        multiple: { type: Boolean, reflect: true },

        /**
         * Pick a FOLDER, and take every file in it.
         *
         * `webkitdirectory` is what a browser offers for this, and what it offers is not
         * a path: the picker hands back the files that were in the folder AT PICK TIME,
         * and nothing watches it afterwards. That is worth knowing where this is used —
         * a folder whose contents change later does not change what was picked, and the
         * only way to notice is to pick it again.
         *
         * NON-STANDARD BUT UNIVERSAL: it is a WHATWG-documented legacy attribute that
         * every current engine implements. A browser that ignores it degrades to an
         * ordinary multi-file pick, which is the same job done less conveniently.
         */
        directory: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-grid;
        }

        /* THE INPUT IS CLIPPED, NOT REMOVED — see the header for why display:none is the
         * wrong tool here. One CSS pixel with a clip rect is the shape that keeps it
         * focusable and keeps it out of the layout. */
        .picker {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }
    `];

    constructor() {
        super();
        this.accept = '';
        this.label = '';
        this.variant = 'default';
        this.tall = false;
        this.disabled = false;
        this.multiple = false;
        this.directory = false;
    }

    /** The hidden input, for a test that wants to drive the pick without a picker. */
    get input() {
        return this.renderRoot?.querySelector?.('#picker') ?? null;
    }

    #onPress = () => {
        if (this.disabled) return;
        this.input?.click();
    };

    #onChange = (event) => {
        const files = [...(event.target.files ?? [])];
        const file = files[0];
        /* CLEARED FIRST, so the same file can be chosen again — and cleared even when
         * nothing was chosen, because a dismissed picker can still leave a stale value. */
        event.target.value = '';
        if (!file) return;
        /* `file` IS STILL THE FIRST ONE. Every caller before `multiple` existed reads
         * `detail.file`, and a multi-pick must not change what those read; `files` is the
         * addition, and it is always an array, even for a single pick. */
        this.dispatchEvent(new CustomEvent('file-pick', {
            detail: { file, files, name: file.name, size: file.size },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        return html`
            <ui-button
                id="button"
                variant=${this.variant}
                ?tall=${this.tall}
                ?disabled=${this.disabled}
                label=${this.label}
                @click=${this.#onPress}
            ><slot></slot></ui-button>
            <input
                id="picker"
                class="picker"
                type="file"
                tabindex="-1"
                aria-hidden="true"
                accept=${this.accept}
                ?multiple=${this.multiple || this.directory}
                webkitdirectory=${this.directory ? '' : nothing}
                ?disabled=${this.disabled}
                @change=${this.#onChange}
            >`;
    }
}

customElements.define('ui-file-button', UiFileButton);
