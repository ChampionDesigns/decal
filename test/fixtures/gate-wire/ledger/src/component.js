/**
 * CONTROL — an unheard emit that IS deliberate, vouched by the ledger beside it.
 *
 * The ledger in `_audit/wire-ledger.json` names where it is consumed. A vouched wire is
 * reported VOUCHED and does not fail; a TRUE dead wire never gets an entry.
 */
export class Toast extends HTMLElement {
    dismiss() {
        this.dispatchEvent(new CustomEvent('ui-toast-dismiss', {
            bubbles: true,
            composed: true,
        }));
    }
}
