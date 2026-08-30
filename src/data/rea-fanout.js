// FAN-OUT WITH LAST-FRAME REPLAY — one source, many observers, one frame of history.
//
// SCOPE Part 3 §1 bullet 5: keep `getLastMachineSnapshot()` + `snapshotListeners`
// (`api.js:218-235`) — "one socket, many observers, last frame replayed to a late
// subscriber. This deliberately mirrors ReaPrime's own `shareReplay(maxSize: 1)` and is the
// seed of the reactive store in §4."
//
// So this is a 90-line module on purpose. It is the seam between Gate 3's sockets and
// Gate 4's stores, and both sides are written against it rather than against each other.
//
// WHAT IT IS NOT, and each of these is a defect it is shaped against:
//
//  * NOT A BUFFER. One frame, the latest. ReaPrime's sockets are fire-and-forget and no
//    socket carries history, so a subscriber that connects mid-shot HAS MISSED THE SHOT
//    (transcribed from `chart.js:311-330`). Accumulating the shot-so-far is Gate 4's
//    store — a different lifetime, a different owner, and a different clearing rule. If
//    this module grew an array, two things would own shot history and they would drift.
//
//  * NOT A CACHE THAT OUTLIVES ITS SOURCE. `clear()` is called by the socket layer on
//    close and on retarget. A replayed frame from a socket that is gone — or worse, from
//    the PREVIOUS sensor id after a machine swap — is a stale value presented as current,
//    which is the whole defect class A7 exists to kill. Replay is only ever "the newest
//    frame from the source you are subscribed to right now".
//
//  * NOT A PLACE FOR ERRORS. An error envelope is a SIGNAL, not a frame
//    (`sensors_handler.dart:56-58` answers `{"error":"not found"}` and closes;
//    `de1handler.dart` `_withDe1Ws` answers `{"error":"No machine connected"}`). Signals
//    go to `onSignal` listeners, are never stored, and are never replayed — replaying
//    "not found" to a late subscriber would report a failure that has already been
//    handled.
//
// A listener that throws must not stop the frame reaching the other listeners, and must
// not kill the socket that delivered it. It is reported through the injected logger and
// the loop continues — the old module did the same thing by hand at every call site
// (`api.js:230`), which is how one of them ended up without it.

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
        // Snapshot the set: a listener may unsubscribe itself (or another) while we are
        // iterating, and the delivery in flight must be unaffected either way.
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
