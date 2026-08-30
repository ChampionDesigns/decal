/**
 * Coalesce expensive chart paints without dropping telemetry.
 */

export function createSingleFlightFrameScheduler(draw, {
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (handle) => cancelAnimationFrame(handle),
    onError = (error) => console.error('Chart render failed:', error),
} = {}) {
    if (typeof draw !== 'function') throw new TypeError('draw must be a function');

    let frameHandle = 0;
    let inFlight = false;
    let dirty = false;

    const queueFrame = () => {
        if (frameHandle || inFlight || !dirty) return;
        frameHandle = requestFrame(run);
    };

    const finish = (error) => {
        inFlight = false;
        if (error) onError(error);
        queueFrame();
    };

    function run() {
        frameHandle = 0;
        if (inFlight || !dirty) return;
        dirty = false;
        inFlight = true;

        let result;
        try {
            result = draw();
        } catch (error) {
            finish(error);
            return;
        }
        Promise.resolve(result).then(() => finish(), finish);
    }

    return {
        request() {
            dirty = true;
            queueFrame();
        },
        cancelPending() {
            dirty = false;
            if (frameHandle) cancelFrame(frameHandle);
            frameHandle = 0;
        },
        state() {
            return { framePending: Boolean(frameHandle), inFlight, dirty };
        },
    };
}
