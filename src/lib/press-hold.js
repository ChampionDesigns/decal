/**
 * press-hold.js — Slate's press-and-hold gesture, as a rule and a binder.
 *
 * WHY IT EXISTS. Slate's `setupPressAndHold` (ui.js:600-670) is how five of its controls
 * offer a SECOND action without a second control: hold a favourite to replace or clear
 * it, hold a preset to re-cut it, hold the shot-history panel to copy a summary. Decal
 * rebuilt every one of those surfaces and none of the gestures, so a favourite could be
 * assigned and never cleared and an edited preset bank had a storage row nobody could
 * ever write to.
 *
 * THE RULE IS SEPARATE FROM THE BINDING, and that is the whole reason this is a module.
 * "Did that pointer sequence mean a tap or a hold" is a decision about two timestamps;
 * proving it needs no browser, and a decision proved in milliseconds gets proved. The
 * binder underneath is the part that has to run in a document.
 *
 * WHAT IS DELIBERATELY NOT SLATE'S:
 *
 *   POINTER EVENTS, NOT THREE FAMILIES. Slate binds mouse*, touch* AND click, then
 *   spends a comment on `preventDefault` suppressing the synthetic click that its own
 *   `touchstart` handler caused — and its history panel had to stop the press on both
 *   ends of every child button because of it ("arrows dead on tablets"). Pointer events
 *   are one family that covers mouse, touch and pen, and `setPointerCapture` keeps the
 *   sequence on the element a finger started on.
 *
 *   NO `contextmenu` BINDING HERE. Slate opens the same menu on right-click, which is
 *   right, and it belongs to the caller: this module reports a HOLD, and a right-click
 *   is not one. A caller that wants both binds both to the same handler.
 */

/** How long a press must last to be a hold, in ms. Slate's own `LONG_PRESS_MS`. */
export const HOLD_MS = 600;

/**
 * How far a pointer may travel and still be a press, in CSS pixels.
 *
 * SLATE HAS NO SUCH RULE AND NEEDS ONE. Its gesture only ever ends on `up`, so a drag
 * that starts on a preset and ends anywhere still fires — which on a scrolling list is a
 * hold every time somebody scrolls. Ten pixels is the platform's own slop for the same
 * question.
 */
export const HOLD_SLOP = 10;

/**
 * What a pointer sequence meant.
 *
 * @param {{at: number, x: number, y: number}} start   the pointerdown
 * @param {{at: number, x: number, y: number}} end     the pointerup, or the tick that
 *                                                     fired while the finger was down
 * @param {{holdMs?: number, slop?: number}} [rule]
 * @returns {'hold'|'tap'|'cancel'}
 */
export function gestureOf(start, end, { holdMs = HOLD_MS, slop = HOLD_SLOP } = {}) {
    if (!start || !end) return 'cancel';
    const moved = Math.hypot(end.x - start.x, end.y - start.y);
    if (moved > slop) return 'cancel';
    return (end.at - start.at) >= holdMs ? 'hold' : 'tap';
}

/**
 * Bind the gesture to one element.
 *
 * THE HOLD FIRES WHILE THE FINGER IS STILL DOWN, which is what makes it feel like a
 * gesture rather than like a slow tap: the caller gets `onHold` at the threshold and can
 * paint or open a menu then. The release afterwards is swallowed — `onTap` is called only
 * for a release that never became a hold.
 *
 * @param {EventTarget} element
 * @param {{onHold: (d: {element, event, path: EventTarget[], target: EventTarget}) => void,
 *          onTap?: (detail: object) => void,
 *          holdMs?: number, slop?: number, now?: () => number}} options
 * @returns {() => void} unbind
 */
export function bindPressHold(element, {
    onHold, onTap = null, holdMs = HOLD_MS, slop = HOLD_SLOP, now = () => Date.now(),
} = {}) {
    if (!element || typeof onHold !== 'function') return () => {};
    let start = null;
    let held = false;
    let timer = null;

    const clear = () => {
        if (timer !== null) { clearTimeout(timer); timer = null; }
        start = null;
    };

    const onDown = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        /* THE PATH IS READ NOW AND NOT LATER, and this is the one non-obvious line in the
         * file. `composedPath()` answers [] once an event has finished dispatching, and
         * the hold fires from a TIMER 600 ms after that — so a caller that resolved its
         * target from the event object inside `onHold` got nothing, every time. Measured
         * in the browser: the gesture fired and the bank could not tell which cell. */
        start = {
            at: now(), x: event.clientX, y: event.clientY, id: event.pointerId,
            path: typeof event.composedPath === 'function' ? event.composedPath() : [event.target],
        };
        held = false;
        if (element.setPointerCapture && event.pointerId !== undefined) {
            try { element.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
        }
        timer = setTimeout(() => {
            timer = null;
            if (!start) return;
            held = true;
            onHold({ element, event, path: start.path, target: start.path[0] ?? null });
        }, holdMs);
    };

    const onMove = (event) => {
        if (!start || held) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > slop) clear();
    };

    const onUp = (event) => {
        const began = start;
        clear();
        if (held) return;
        if (!began) return;
        if (gestureOf(began, { at: now(), x: event.clientX, y: event.clientY }, { holdMs, slop }) === 'tap'
            && onTap) onTap({ element, event });
    };

    /* THE CLICK AFTER A HOLD IS NOT A CLICK. A pointerup that followed a hold still
     * produces one, and without this the menu opens and the item is chosen underneath it.
     * Capture phase, so the element's own listeners never see it. */
    const onClick = (event) => {
        if (!held) return;
        held = false;
        event.preventDefault();
        event.stopPropagation();
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', clear);
    element.addEventListener('click', onClick, true);
    return () => {
        clear();
        element.removeEventListener('pointerdown', onDown);
        element.removeEventListener('pointermove', onMove);
        element.removeEventListener('pointerup', onUp);
        element.removeEventListener('pointercancel', clear);
        element.removeEventListener('click', onClick, true);
    };
}
