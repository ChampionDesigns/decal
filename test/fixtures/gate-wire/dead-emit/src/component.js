/**
 * CANARY — an unheard emit, and a `removeEventListener` that must not rescue it.
 *
 * The remove is here on purpose: A REMOVE IS NOT A HEARING (gate-wire header, plan §2.1).
 * A scanner that counted `removeEventListener` as the heard side would score this file
 * green, and the whole class of fault the gate exists for would walk straight past it.
 */
export class DeadEmitter extends HTMLElement {
    press() {
        this.dispatchEvent(new CustomEvent('never-heard', {
            detail: { pressed: true },
            bubbles: true,
            composed: true,
        }));
    }

    disconnectedCallback() {
        this.removeEventListener('never-heard', this.press);
    }
}
