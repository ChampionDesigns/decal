/** CONTROL — the `STEP_ACTION` shape: a single exported string constant. */
export const STEP_ACTION = 'step-action';

export class Rail extends HTMLElement {
    press() {
        this.dispatchEvent(new CustomEvent(STEP_ACTION, { bubbles: true, composed: true }));
    }
}
