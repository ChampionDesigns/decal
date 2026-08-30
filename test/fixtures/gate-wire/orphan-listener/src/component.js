/** CANARY — a listener for a name nothing in this tree emits. */
export class OrphanListener extends HTMLElement {
    connectedCallback() {
        this.addEventListener('never-emitted', this.onIt);
    }

    onIt() {
        this.dataset.heard = 'yes';
    }
}
