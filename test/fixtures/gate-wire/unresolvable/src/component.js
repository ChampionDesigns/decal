/**
 * CANARY — two event-name positions this gate refuses to guess at.
 *
 * `NAMES[i]` is an index into a real array of real names, and a scanner that "helpfully"
 * harvested the array would be guessing about a position it did not resolve. The template
 * literal is the same refusal one shape over. UNRESOLVED is a first-class failing category
 * (plan §2.3): neither of these may be silently dropped into pass or into fail.
 */
const NAMES = ['a-change', 'b-change'];

export class Computed extends HTMLElement {
    connectedCallback() {
        for (let i = 0; i < NAMES.length; i += 1) this.addEventListener(NAMES[i], this.onAny);
    }

    fire(kind) {
        this.dispatchEvent(new CustomEvent(`x-${kind}`, { bubbles: true }));
    }

    onAny() {}
}
