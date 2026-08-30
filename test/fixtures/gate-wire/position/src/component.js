/**
 * CONTROL — THE POSITION RULE, which is what keeps `STEP_ACTIONS` out of the universe.
 *
 * `src/lib/editor-draft.js` exports a frozen array of five step-action IDS. They look
 * exactly like event names, they are frozen, they are exported, and they are not event
 * names: they ride in `detail`. A gate that classified a table as "event names" by its
 * shape or by its name would invent three findings here. A string becomes a name only by
 * standing in an event-name POSITION, and none of these ever does.
 */
export const STEP_ACTIONS = Object.freeze(['move-left', 'delete', 'insert-after']);

export class Rail extends HTMLElement {
    connectedCallback() {
        this.addEventListener('step-action', this.onAction);
    }

    press(index) {
        this.dispatchEvent(new CustomEvent('step-action', {
            detail: { action: STEP_ACTIONS[index] },
            bubbles: true,
        }));
    }

    labels() {
        const out = [];
        for (const id of STEP_ACTIONS) out.push(id);
        return out;
    }

    onAction() {}
}
