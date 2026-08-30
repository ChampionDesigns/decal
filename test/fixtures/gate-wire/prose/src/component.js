/**
 * CONTROL — prose is not code. This is what `stripComments` buys.
 *
 * @fires commented-only-event — named here, in a module header, and nowhere in code.
 *
 * The wiring this element used to carry was:
 *
 *     this.dispatchEvent(new CustomEvent('commented-only-event', { bubbles: true }));
 *     host.addEventListener('commented-only-event', this.onGone);
 *
 * and it was removed. A comment-blind scan reports `commented-only-event` as a live wire in
 * both directions; a false positive earns an exemption, and an exemption is how coverage
 * dies — all three of this project's previous guard failures went that way.
 */
export class Prose extends HTMLElement {
    connectedCallback() {
        // this.addEventListener('commented-only-event', this.onGone);
        this.addEventListener('real-event', this.onReal);
    }

    fire() {
        this.dispatchEvent(new CustomEvent('real-event', { bubbles: true, composed: true }));
    }

    onReal() {}
}
