/** CONTROL — the half of the wrapper fixture that hears one of the two wrapped names. */
export class Host extends HTMLElement {
    connectedCallback() {
        this.addEventListener('wrapped-heard', this.onHeard);
    }

    onHeard() {}
}
