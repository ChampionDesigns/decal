/**
 * CONTROL — builtin names, both directions, absent from both sets.
 *
 * `click` is heard and nothing emits it; `change` is emitted and nothing hears it. Neither
 * is a finding, because a builtin name is excluded from the emitted AND the heard set, so
 * it can never be flagged and can never mask a non-builtin name.
 */
export class Builtins extends HTMLElement {
    connectedCallback() {
        this.addEventListener('click', this.onClick);
    }

    commit() {
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    onClick() {}
}
