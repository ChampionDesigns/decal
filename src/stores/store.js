// THE STORE PRIMITIVE — one owner per piece of state, observable by construction.
//
// Gate 4 (SCOPE Part 3 §4; CARRY_FORWARD.md §6 patterns C, E, F). Every reactive value
// above this line is one of these. Nothing above this gate keeps a module-scope `let`.
//
// WHAT IT REPLACES, and why the replacement is not "the same thing in a different file":
//
//  * PATTERN C — ~13 module-scope singletons (`currentMachineState`, `machineModel`,
//    `currentShot`, `cupWarmerState`, `currentTempUnit`, the chart's 43 module-level
//    `let`s). Sharing worked because ES modules are singletons AND the router swapped
//    pages with `innerHTML` without reloading modules — a mechanism, not a design. The
//    need was real: three copies of "is the warmer on" once drifted and froze a page at a
//    twenty-minute-old temperature. A store keeps the sharing and drops the mechanism.
//
//  * PATTERN E — no document-level `CustomEvent` buses. `streamline:unitchange` is
//    dispatched on `document` (`units.js:57`) and a `document` listener does not reach a
//    component that never mounted one; a `querySelectorAll` cannot cross a shadow
//    boundary either. And the prefix names a different skin. Subscription here is a
//    direct function call on an imported instance: shadow roots are irrelevant to it.
//
//  * PATTERN F — in-place mutation invisible to Lit. `foldSnapshot`, `estimatorLink.apply`
//    and `normalizeStep` all mutate and return a boolean or the same object. That is
//    right for a datarevision counter and wrong for a renderer that compares references.
//    So this module makes the wrong thing LOUD rather than silent:
//      1. state objects are frozen on the way in, so mutating one throws (modules are
//         strict-mode by definition), and
//      2. `set(sameObjectReference)` throws with pattern F named in the message.
//    A fold that legitimately has nothing to change says so — `update()` returns
//    UNCHANGED — instead of returning the object it was given.
//
// REPLAY IS THE POINT (SCOPE Part 3 §4, "replaying it to late subscribers"). A component
// that mounts between frames must paint immediately, so `subscribe` delivers the current
// state synchronously before returning. This mirrors `rea-fanout.js`, which mirrors
// ReaPrime's own `shareReplay(1)` — one mechanism, stated three times because it crosses
// three layers, never two mechanisms.
//
// NO DOM, NO TIMERS, NO NETWORK. Everything time-shaped is injected (`clock`), so the
// whole layer runs under `node:test` with no harness. That is the same rule the transport
// applies to `fetch` and the sockets apply to their factory.

/** Returned by an `update` function that decided there is nothing to change. */
export const UNCHANGED = Symbol('store: unchanged');

function freezeState(value) {
    return (value !== null && typeof value === 'object' && !Object.isFrozen(value))
        ? Object.freeze(value)
        : value;
}

export function createStore(initial = null, { label = 'store', logger = null, freeze = true } = {}) {
    const listeners = new Set();
    let state = freeze ? freezeState(initial) : initial;
    let revision = 0;

    const report = (err) => {
        if (logger && logger.warn) logger.warn(`${label}: subscriber threw: ${err && err.message}`);
    };

    const publish = () => {
        // Snapshot the set: a subscriber may unsubscribe itself (or another) during
        // delivery, and the delivery in flight must be unaffected either way.
        for (const listener of [...listeners]) {
            try {
                listener(state);
            } catch (err) {
                // One broken subscriber must not stop the state reaching the others, and
                // must not take down the socket that delivered the frame.
                report(err);
            }
        }
    };

    const store = {
        label,

        /** The state right now. Never a copy — it is frozen, so it cannot be edited. */
        get() {
            return state;
        },

        /** How many times the state has been replaced. The change signal for a consumer
         *  that holds a reference to an append-only container inside the state. */
        revision() {
            return revision;
        },

        subscribe(listener) {
            if (typeof listener !== 'function') throw new Error(`${label}: subscribe needs a function`);
            listeners.add(listener);
            try {
                listener(state);
            } catch (err) {
                report(err);
            }
            let released = false;
            return () => {
                if (released) return;
                released = true;
                listeners.delete(listener);
            };
        },

        set(next) {
            if (Object.is(next, state)) {
                if (next !== null && typeof next === 'object') {
                    throw new Error(
                        `${label}: set() was handed the state object it already holds. `
                        + 'A fold must RETURN NEW STATE (CARRY_FORWARD.md §6 pattern F) — '
                        + 'or return UNCHANGED from update() if there is genuinely nothing to change.',
                    );
                }
                return state;
            }
            state = freeze ? freezeState(next) : next;
            revision += 1;
            publish();
            return state;
        },

        /**
         * Fold: `fn(current)` returns the next state, or UNCHANGED.
         *
         * @param {(current: unknown) => unknown} fn
         */
        update(fn) {
            if (typeof fn !== 'function') throw new Error(`${label}: update needs a function`);
            const next = fn(state);
            if (next === UNCHANGED) return state;
            return store.set(next);
        },

        size() {
            return listeners.size;
        },

        /** Back to a known state. Subscribers stay subscribed and are told. */
        reset(value = initial) {
            state = freeze ? freezeState(value) : value;
            revision += 1;
            publish();
            return state;
        },

        /** Drop every subscriber. The store is being destroyed. */
        destroy() {
            listeners.clear();
        },
    };

    return store;
}

export class StoreController {
    constructor(host, store) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error('StoreController: a store is required');
        }
        this.host = host;
        this.store = store;
        this.unsubscribe = null;
        host.addController(this);
    }

    /** The current state, readable in `render()` without subscribing again. */
    get state() {
        return this.store.get();
    }

    hostConnected() {
        // The first delivery is the replay, which happens inside subscribe() — so the
        // host has the current state before its first update, not after it.
        this.unsubscribe ??= this.store.subscribe(() => this.host.requestUpdate());
    }

    hostDisconnected() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

export function watchAll(stores, listener) {
    if (!Array.isArray(stores) || stores.length === 0) {
        throw new Error('watchAll: at least one store is required');
    }
    if (typeof listener !== 'function') throw new Error('watchAll: watchAll needs a function');
    let ready = false;
    const fire = () => {
        if (ready) listener(...stores.map((store) => store.get()));
    };
    const offs = stores.map((store) => store.subscribe(fire));
    ready = true;
    fire();
    return () => {
        for (const off of offs) off();
    };
}
