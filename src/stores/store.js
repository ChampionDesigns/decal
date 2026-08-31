

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
        for (const listener of [...listeners]) {
            try {
                listener(state);
            } catch (err) {
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
                        + 'A fold must RETURN NEW STATE — '
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
