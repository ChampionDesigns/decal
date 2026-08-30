

/**
 * @param {object} [options]
 * @param {{warn?: Function}} [options.logger]  diagnostic sink; never a UI
 * @param {string} [options.label]              appears in logs only
 */
export function createFanout({ logger = null, label = 'fanout' } = {}) {
    const listeners = new Set();
    const signalListeners = new Set();
    let last = null;
    let hasLast = false;
    let frameCount = 0;

    const report = (what, err) => {
        if (logger && logger.warn) logger.warn(`${label}: ${what} listener threw: ${err && err.message}`);
    };

    const deliver = (set, value, what) => {
        for (const listener of [...set]) {
            try {
                listener(value);
            } catch (err) {
                report(what, err);
            }
        }
    };

    return {
        subscribe(listener) {
            if (typeof listener !== 'function') throw new Error(`${label}: subscribe needs a function`);
            listeners.add(listener);
            if (hasLast) {
                try {
                    listener(last);
                } catch (err) {
                    report('replay', err);
                }
            }
            return () => listeners.delete(listener);
        },

        onSignal(listener) {
            if (typeof listener !== 'function') throw new Error(`${label}: onSignal needs a function`);
            signalListeners.add(listener);
            return () => signalListeners.delete(listener);
        },

        /** Publish a frame: store it as the replay value, then deliver. */
        emit(frame) {
            last = frame;
            hasLast = true;
            frameCount += 1;
            deliver(listeners, frame, 'frame');
        },

        /** Publish a signal. Never stored, never replayed. */
        signal(signal) {
            deliver(signalListeners, signal, 'signal');
        },

        /** The replay value, or null before the first frame. */
        last() {
            return hasLast ? last : null;
        },

        /** Whether a frame has arrived since the last clear(). */
        hasFrame() {
            return hasLast;
        },

        frameCount() {
            return frameCount;
        },

        /** Forget the replay value. Called on close and on retarget, never on a whim. */
        clear() {
            last = null;
            hasLast = false;
        },

        /** Observer counts, for the socket layer's refcount and for tests. */
        size() {
            return listeners.size;
        },
        signalSize() {
            return signalListeners.size;
        },

        /** Drop every listener and the replay value. The channel is being destroyed. */
        reset() {
            listeners.clear();
            signalListeners.clear();
            last = null;
            hasLast = false;
        },
    };
}
