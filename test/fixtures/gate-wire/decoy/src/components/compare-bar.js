/**
 * THE DECOY — `src/components/ui-compare-bar.js` in miniature, and a REQUIRED canary.
 *
 * It has the shape of the six real wrappers and is not one: the CustomEvent type is the
 * FIXED literal `'offset-change'`, and the parameter rides in `detail`. So `'slot-change'`,
 * `'slide'` and `'reset'` are NOT event names. A wrapper detector that matched on shape
 * rather than on "the type argument IS the first parameter" would inject all three into the
 * name universe and then report them dead — three imaginary findings from one real file.
 */
export class CompareBar extends HTMLElement {
    applySlotChange() {
        this.offset = 0;
        this.#emit('slot-change');
    }

    slide(value) {
        this.offset = value;
        this.#emit('slide');
    }

    resetOffset() {
        this.offset = 0;
        this.#emit('reset');
    }

    /** ONE event, one shape. `reason` is a reason, not a name. */
    #emit(reason) {
        this.dispatchEvent(new CustomEvent('offset-change', {
            detail: { offset: this.offset, reason },
            bubbles: true,
            composed: true,
        }));
    }
}
