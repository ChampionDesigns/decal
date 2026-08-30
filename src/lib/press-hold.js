/**
 * Slate's press-and-hold gesture, as a rule and a binder.
 */

export const HOLD_MS = 600;

export const HOLD_SLOP = 10;

export function gestureOf(start, end, { holdMs = HOLD_MS, slop = HOLD_SLOP } = {}) {
    if (!start || !end) return 'cancel';
    const moved = Math.hypot(end.x - start.x, end.y - start.y);
    if (moved > slop) return 'cancel';
    return (end.at - start.at) >= holdMs ? 'hold' : 'tap';
}

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
