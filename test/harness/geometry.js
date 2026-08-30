/**
 * geometry.js — Gate A's standard geometries, in one place so no suite invents its own.
 *
 * "Standard geometry is the bench truth, not the desk default: 1281×801 with
 * deviceScaleFactor: 1.5 emulated, plus the 1000×600 floor for container behaviour.
 * The old probes ran 1920×1200 at dpr 1, which is precisely how every dpr-1.5 raster
 * surprise stayed invisible until the tablet." — SCOPE Part 8 §2, Gate A.
 *
 * BENCH is where a rendering test runs unless it says otherwise. FLOOR is the small
 * end, and it exists to make a component prove it reads its own container
 * (LAYOUT_SPEC_DRAFT.md §2.1 Rule 1) rather than to photograph anything.
 *
 * DESKTOP is here for the capture battery's geometry matrix (Gate B change 2:
 * 1281×801 @ dsf 1.5, 1920×1200, 1000×600) and for one narrow comparison job: the
 * Slate provenance corpus was captured at 1920×1200, so an oracle answer about a
 * SIZE is only ever an answer at that geometry. It is not a Gate A default.
 */

/** The bench tablet: 1281×801 at dpr 1.5. Everything renders here unless told otherwise. */
export const BENCH = Object.freeze({
    name: 'bench',
    width: 1281,
    height: 801,
    deviceScaleFactor: 1.5,
    mobile: false,
});

/**
 * The floor. dsf 1: the floor exists for container behaviour, not raster — a
 * component that reflows correctly at 1000×600 does so independently of pixel
 * density, and pairing the small size with dpr 1 keeps the two variables separable
 * when a test fails. (Recorded in DEFERRED_QUESTIONS.md; one number here reverses it.)
 */
export const FLOOR = Object.freeze({
    name: 'floor',
    width: 1000,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
});

/** Desktop, and the geometry the Slate provenance corpus was captured at. */
export const DESKTOP = Object.freeze({
    name: 'desktop',
    width: 1920,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
});

/**
 * THE C1 GEOMETRY: 1920 x 1080, dpr 1. Not a Gate A default and not in the capture
 * matrix - it exists because one decided answer names a size.
 *
 * Register decision C1 (SCOPE.md:1911-1916): "At 1920 x 1080 the rewrite has 120 fewer
 * rows than the old design height and does not squash to hide it. The decision: the
 * chart keeps its height; the foot band loses rows first", and Part 5's "The order,
 * and why" reason 2 asks for it to be decided "against a prototype at that exact
 * size". Its residual action is Ben's look at the prototype (Q2), collected at the
 * pre-launch checkpoint; what a suite can do meanwhile is render the skeleton at
 * exactly that size and measure what the decision is about.
 *
 * NOT the same as DESKTOP (1920 x 1200). The 120-row difference between the two IS
 * the decision, so the two must stay separate constants: reusing DESKTOP here would
 * delete the question.
 */
export const C1 = Object.freeze({
    name: 'c1',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
});

/** Gate B's capture matrix, in the order Part 8 §2 change 2 lists it. */
export const CAPTURE_MATRIX = Object.freeze([BENCH, DESKTOP, FLOOR]);

/** The two Gate A geometries every rendering suite is expected to cover. */
export const GATE_A_GEOMETRIES = Object.freeze([BENCH, FLOOR]);

export const GEOMETRIES = Object.freeze({ bench: BENCH, floor: FLOOR, desktop: DESKTOP, c1: C1 });
