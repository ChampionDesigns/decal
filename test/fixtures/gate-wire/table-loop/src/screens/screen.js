/**
 * CONTROL — table-driven registration, both import spellings, and member access.
 *
 * This is `editor-screen.js:673` in miniature: the loop over `Object.values(EDITOR_EDIT)`
 * is exactly the indirection plan §5 says a naive scan calls unheard and cries wolf over.
 * The table arrives by a RELATIVE import; `STEP_ACTION` arrives through the import map's
 * `src/` prefix (`index.html`), so both resolution paths are exercised here.
 */
import { EDITOR_EDIT } from '../lib/edits.js';
import { STEP_ACTION } from 'src/components/rail.js';

export class Screen extends HTMLElement {
    connectedCallback() {
        for (const name of Object.values(EDITOR_EDIT)) this.addEventListener(name, this.onEdit);
        this.addEventListener(STEP_ACTION, this.onAction);
    }

    disconnectedCallback() {
        for (const name of Object.values(EDITOR_EDIT)) this.removeEventListener(name, this.onEdit);
        this.removeEventListener(STEP_ACTION, this.onAction);
    }

    fire() {
        this.dispatchEvent(new CustomEvent(EDITOR_EDIT.STEP_CHANGE, { bubbles: true }));
        this.dispatchEvent(new CustomEvent(EDITOR_EDIT.VALUE_COMMIT, { bubbles: true }));
        this.dispatchEvent(new CustomEvent(EDITOR_EDIT.EXIT_REMOVE, { bubbles: true }));
    }

    onEdit() {}

    onAction() {}
}
