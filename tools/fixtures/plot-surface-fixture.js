/**
 * plot-surface-fixture — the rendering subjects for Gate 5.
 *
 * `PlotSurfaceElement` ships NO TAG of its own (the `ui-` namespace belongs to the
 * components; it is a base class in the same sense as `UiElement`), so a rendering
 * suite has to bring one. This file brings four, and nothing else: no colours, no
 * lengths, no layout decisions. Every value the plot draws with still comes from the
 * document's own tokens through the host, which is the whole of A6 and the thing the
 * suite measures.
 *
 *   <plot-fixture>          the plain surface, sized by the page.
 *   <plot-fixture-canary>   RULE 1'S CANARY. `adoptPlotStyleSheet` returns false without
 *                           adopting anything AND `plotStyleSheetOptional` is declared
 *                           true, which is precisely what a chart that forgets the vendor
 *                           sheet inside a shadow root looks like — with the waiver made
 *                           explicit, because a mount whose sheet merely FAILED now fails
 *                           outright. Gate C's rule is that every guard ships with a
 *                           canary that fires: the mount-C signature is pixel-identical to
 *                           a healthy chart, so an assertion that cannot tell these two
 *                           apart is an assertion that proves nothing.
 *   <plot-fixture-unsheeted>
 *                           the same failed adoption WITHOUT the waiver — a production
 *                           chart whose sheet did not arrive. It must not mount at all.
 *   <plot-fixture-cursor>   uPlot's own cursor ON — the subject of the coordinate
 *                           re-verify (Part 10 §12), which the suite now RUNS through
 *                           `cursorReport()` rather than leaving as a paragraph, and the
 *                           subject of the `.u-cursor-x` probe, one of the two
 *                           discriminators the spike measured.
 *   <plot-fixture-two>      TWO SCALES. A left channel and a right one, both with fixed
 *                           ranges, because a function-valued `range` used to reach uPlot
 *                           double-wrapped and y2 — which nothing rescues with an explicit
 *                           setScale — came up ranged null/null in silence.
 *   <plot-fixture-temp>     THE FIXED-RANGE ESCAPE. Overrides `yScaleSpec` and `yRangeFor`
 *                           together onto `computeTempRange`, so the suite can assert that
 *                           a subclass's own band survives the frame instead of being
 *                           overwritten by the damped ceiling.
 *   <plot-fixture-late>     a surface that reports what it saw during its OWN mount:
 *                           the store-fed order is "append, then set the channels when
 *                           the shot opens", and the suite has to be able to see what
 *                           the element did in between.
 *
 * The fixtures also carry the tiny amount of test plumbing that would be noise in the
 * component: a deterministic record generator, and a counter for how many times the
 * scheduler actually painted.
 *
 * WHY THIS LIVES UNDER tools/ AND NOT test/fixtures/ (moved by wave 3's gate).
 * `node --test test/` treats EVERY `.js` under a `test/` directory as a test file, so
 * a browser-only module that imports `lit` through the page's importmap is loaded by
 * node's runner and fails there: `Cannot find package 'lit'` — one red in an otherwise
 * green tree, for a file that contains no tests. `test/fixtures/base-fixture.js`
 * escapes only because it declares its elements without importing lit. The repo root
 * IS the served root (test/harness/server.js:4, and the gallery's importmap resolves
 * `../../`), so the move changes the URL and nothing else. Consumers:
 * `test/render/plot-surface.render.test.mjs` (three path strings) and
 * `tools/gallery/entries/plot-surface.demo.js`.
 */

import { PlotSurfaceElement } from '../../src/components/plot-surface.js';
import { computeTempRange } from '../../src/lib/chart-autoscale.js';

/** Two channels on the left scale, spelled the way a chart card spells them. */
export const CHANNELS = [
    { key: 'pressure', label: 'Pressure' },
    { key: 'flow', label: 'Flow', dash: 'dash' },
];

/**
 * The steam view's shape: one channel per scale. `y2` is the case with no rescue —
 * `PlotSurfaceElement.#draw()` calls `setScale('y')` every frame and never `setScale('y2')`,
 * so the right-hand axis is whatever `createPlot` handed uPlot at construction.
 */
export const TWO_SCALE_CHANNELS = [
    { key: 'steam-temperature', label: 'Steam' },
    { key: 'flow', label: 'Flow', scale: 'y2' },
];

/** The temperature band's channels: the group target anchors, the actual only widens. */
export const TEMP_CHANNELS = [
    { key: 'target-group-temperature', label: 'Target' },
    { key: 'group-temperature', label: 'Group' },
];

/** A shot-shaped temperature pair: a flat 92 °C target with the group riding 88-95. */
export function makeTempRecords({ n = 60, seconds = 30, target = 92 } = {}) {
    const x = [];
    const targetTemp = [];
    const groupTemp = [];
    for (let i = 0; i < n; i += 1) {
        x.push((i / Math.max(1, n - 1)) * seconds);
        targetTemp.push(target);
        groupTemp.push(target - 4 + 3 * Math.sin(i / 5));
    }
    return {
        'target-group-temperature': { x, y: targetTemp },
        'group-temperature': { x, y: groupTemp },
    };
}

/**
 * A shot-shaped record set: `n` samples over `seconds`, pressure ramping to `peak`
 * and flow riding under it. Deterministic — no clock, no random — because a chart
 * assertion that moves between runs is not an assertion.
 */
export function makeRecords({ n = 60, seconds = 30, peak = 9 } = {}) {
    const x = [];
    const pressure = [];
    const flow = [];
    for (let i = 0; i < n; i += 1) {
        const t = (i / Math.max(1, n - 1)) * seconds;
        x.push(t);
        pressure.push(peak * Math.min(1, (i + 1) / Math.max(1, n * 0.25)));
        flow.push(2 + Math.sin(i / 6));
    }
    return { pressure: { x, y: pressure }, flow: { x, y: flow } };
}

class PlotFixture extends PlotSurfaceElement {
    /** How many times #draw actually ran — the scheduler's own count, not a guess. */
    drawCount = 0;

    /** Every pointer event the plot host saw, for the liveness sweep. */
    pointerHits = 0;

    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.renderRoot.addEventListener('pointermove', () => { this.pointerHits += 1; });
        this.renderRoot.addEventListener('pointerdown', () => { this.pointerHits += 1; });
    }

    /** Set both halves in the order a chart card does. */
    load({ channels = CHANNELS, records = makeRecords() } = {}) {
        this.setChannels(channels);
        this.setRecords(records);
        this.drawNow();
        this.drawCount += 1;
        return this.buildCount;
    }

    /** Everything the suite reads about the mount, in one round trip. */
    report() {
        return {
            buildCount: this.buildCount,
            hasPlot: Boolean(this.plotHandle),
            sheetAdopted: this.sheetAdopted,
            mountError: this.mountError ? String(this.mountError.message ?? this.mountError) : null,
            yMax: this.yMax,
            xRange: this.xRange,
            channels: this.channels.map((c) => c.key),
            pixelRatio: this.pixelRatio,
            pointerHits: this.pointerHits,
            paintCount: this.paintCount,
            scheduler: this.schedulerState,
        };
    }

    /**
     * What uPlot actually ranged each scale to — `raw.scales`, which no assertion read
     * before. A scale ranged `null`/`null` draws no axis and raises nothing, so this is
     * the only way to see a range that never arrived.
     */
    scaleReport() {
        const raw = this.plotHandle?.raw ?? null;
        if (!raw) return null;
        const out = {};
        for (const key of Object.keys(raw.scales)) {
            out[key] = { min: raw.scales[key].min ?? null, max: raw.scales[key].max ?? null };
        }
        return out;
    }
}

/**
 * RULE 1'S CANARY — see the header. Adopts nothing, and DECLARES the waiver: an
 * adoption that merely fails now fails the mount, so the canary has to say that running
 * unsheeted is what it means to do.
 */
class PlotFixtureCanary extends PlotFixture {
    async adoptPlotStyleSheet() { return false; }

    get plotStyleSheetOptional() { return true; }
}

/**
 * THE CANARY'S OWN CANARY: adoption fails and the waiver is NOT declared, which is what a
 * production chart whose vendor sheet did not arrive looks like. It must not mount. The
 * pair only proves anything together — `<plot-fixture-canary>` shows the waiver still
 * lets a subject through, this one shows nothing else does.
 */
class PlotFixtureUnsheeted extends PlotFixture {
    async adoptPlotStyleSheet() { return false; }
}

/** uPlot's own cursor, ON, for the coordinate re-verify and the `.u-cursor-x` probe. */
class PlotFixtureCursor extends PlotFixture {
    cursorSpec() { return { show: true }; }

    /**
     * uPlot's own cursor state — the three numbers the coordinate re-verify is about
     * (Part 10 §12, LAYOUT_SPEC_DRAFT §6.3). `left` is uPlot's x INSIDE the plotting
     * area, in CSS px, computed from `getBoundingClientRect()`; `val` is what that x maps
     * back to through `posToVal`, which works in `clientWidth` space; `idx` is the sample
     * uPlot believes the pointer is over. If the two coordinate spaces disagreed, `left`
     * would drift from the pointer's real offset into `.u-over` and `val` would stop being
     * linear in it — at dpr 1.5 first, which is why the suite runs this at both.
     */
    cursorReport() {
        const raw = this.plotHandle?.raw ?? null;
        if (!raw) return null;
        const over = raw.over.getBoundingClientRect();
        return {
            idx: raw.cursor.idx,
            left: raw.cursor.left,
            top: raw.cursor.top,
            val: raw.posToVal(raw.cursor.left, 'x'),
            overLeft: over.left,
            overWidth: over.width,
        };
    }
}

/**
 * The cursor fixture with the sheet declined — the pair the `.u-cursor-x` assertion
 * needs. It is the ONE discriminator that works at both device pixel ratios, so it is
 * the one that has to have a canary at both.
 */
class PlotFixtureCursorCanary extends PlotFixtureCursor {
    async adoptPlotStyleSheet() { return false; }

    get plotStyleSheetOptional() { return true; }
}

/** A left scale and a right one — the two-scale case nothing rescues. See the header. */
class PlotFixtureTwoScale extends PlotFixture {
    y2ScaleSpec() { return { range: [0, 5] }; }

    load({ channels = TWO_SCALE_CHANNELS, records = makeRecords() } = {}) {
        return super.load({
            channels,
            records: {
                'steam-temperature': records.pressure,
                flow: records.flow,
            },
        });
    }
}

/**
 * THE FIXED-RANGE ESCAPE, as a subject. `yScaleSpec` sets the band at construction and
 * `yRangeFor` keeps it there — the pair `PlotSurfaceElement` documents. It returns the
 * band rather than `null` because `computeTempRange` WIDENS as samples arrive, which is
 * the harder half: a fixed range that moves has to be re-applied, and it must still never
 * be the damped ceiling.
 */
class PlotFixtureTemp extends PlotFixture {
    /** The band the last frame computed, so the suite can compare it with the axis. */
    band = null;

    tempRange(data) {
        const [, targetYs, groupYs] = data;
        return computeTempRange(targetYs ?? [], groupYs ?? []);
    }

    yScaleSpec() { return { auto: false, range: this.band ?? [80, 100] }; }

    yRangeFor(data) {
        this.band = this.tempRange(data);
        return this.band;
    }

    load({ channels = TEMP_CHANNELS, records = makeTempRecords() } = {}) {
        return super.load({ channels, records });
    }
}

/**
 * Reports what was true DURING its own mount. The suite cannot observe the inside of
 * an async mount from outside it, and the ordering defect this pins lived exactly
 * there: a surface connected before its channels were set threw out of the mount as an
 * unhandled rejection and left a mounted element with no plot.
 */
class PlotFixtureLate extends PlotFixture {
    seenDuringMount = null;

    async fontsReady() {
        this.seenDuringMount = {
            channels: this.channels.length,
            hasPlot: Boolean(this.plotHandle),
        };
        return super.fontsReady();
    }
}

customElements.define('plot-fixture', PlotFixture);
customElements.define('plot-fixture-canary', PlotFixtureCanary);
customElements.define('plot-fixture-unsheeted', PlotFixtureUnsheeted);
customElements.define('plot-fixture-cursor', PlotFixtureCursor);
customElements.define('plot-fixture-cursor-canary', PlotFixtureCursorCanary);
customElements.define('plot-fixture-two', PlotFixtureTwoScale);
customElements.define('plot-fixture-temp', PlotFixtureTemp);
customElements.define('plot-fixture-late', PlotFixtureLate);

export {
    PlotFixture,
    PlotFixtureCanary,
    PlotFixtureUnsheeted,
    PlotFixtureCursor,
    PlotFixtureCursorCanary,
    PlotFixtureTwoScale,
    PlotFixtureTemp,
    PlotFixtureLate,
};
