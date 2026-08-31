/**
 * the render harness's standard geometries, in one place so no suite invents its own.
 */

/** The bench tablet: 1281×801 at dpr 1.5. Everything renders here unless told otherwise. */
export const BENCH = Object.freeze({
    name: 'bench',
    width: 1281,
    height: 801,
    deviceScaleFactor: 1.5,
    mobile: false,
});

export const FLOOR = Object.freeze({
    name: 'floor',
    width: 1000,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
});

export const DESKTOP = Object.freeze({
    name: 'desktop',
    width: 1920,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
});

export const C1 = Object.freeze({
    name: 'c1',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
});

export const CAPTURE_MATRIX = Object.freeze([BENCH, DESKTOP, FLOOR]);

/** The two the render harness geometries every rendering suite is expected to cover. */
export const GATE_A_GEOMETRIES = Object.freeze([BENCH, FLOOR]);

export const GEOMETRIES = Object.freeze({ bench: BENCH, floor: FLOOR, desktop: DESKTOP, c1: C1 });
