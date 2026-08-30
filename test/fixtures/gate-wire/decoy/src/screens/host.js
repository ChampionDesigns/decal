/** CONTROL — the one event the decoy actually dispatches is heard here. */
export class Host extends HTMLElement {
    connectedCallback() {
        this.addEventListener('offset-change', this.onOffset);
    }

    onOffset() {}
}
