/**
 * CANARY + CONTROL — `ui-screensaver.js`'s `LAYER_ENTRY_EVENTS`: one builtin and one custom
 * name in the SAME frozen table, registered in one loop.
 *
 * The builtin drops out of both sets; the custom name stays and is reported as an orphan
 * listener, because nothing here emits it. A gate that dropped the whole table on seeing a
 * builtin in it, or that kept the builtin, gets a different answer.
 */
const LAYER_ENTRY_EVENTS = Object.freeze(['beforetoggle', 'custom-x']);

export class Watcher extends HTMLElement {
    watch(root) {
        for (const type of LAYER_ENTRY_EVENTS) root.addEventListener(type, this.onEntry, true);
    }

    onEntry() {}
}
