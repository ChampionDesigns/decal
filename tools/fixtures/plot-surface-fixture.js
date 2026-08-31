/**
 * Plot-surface-fixture — the rendering subjects for this layer.
 */

import { PlotSurfaceElement } from '../../src/components/plot-surface.js';
import { computeTempRange } from '../../src/lib/chart-autoscale.js';

/** Two channels on the left scale, spelled the way a chart card spells them. */
export const CHANNELS = [
    { key: 'pressure', label: 'Pressure' },
    { key: 'flow', label: 'Flow', dash: 'dash' },
];

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

class PlotFixtureUnsheeted extends PlotFixture {
    async adoptPlotStyleSheet() { return false; }
}

/** uPlot's own cursor, ON, for the coordinate re-verify and the `.u-cursor-x` probe. */
class PlotFixtureCursor extends PlotFixture {
    cursorSpec() { return { show: true }; }

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
