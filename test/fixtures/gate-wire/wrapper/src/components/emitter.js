/**
 * CANARY + CONTROL — a real `#emit(type, …)` wrapper.
 *
 * `wrapped-heard` is listened for in `../screens/host.js`; `wrapped-dead` is not. A gate
 * that cannot follow the wrapper reports BOTH as unheard, or neither. The wrapper's own
 * `new CustomEvent(type, …)` must also not be reported UNRESOLVED — the name comes from
 * the call sites, and the dispatch inside the wrapper is not a second site.
 */
export class Wrapped extends HTMLElement {
    heard() {
        this.#emit('wrapped-heard', { a: 1 });
    }

    unheard() {
        this.#emit('wrapped-dead', { a: 2 });
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
}
