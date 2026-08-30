/**
 * plot-surface.demo.js — the gallery's loader for the CHART SURFACE (wave 3, gate 5).
 *
 * WHY A FIXTURE IS THE SUBJECT. Item #9 (chart card) was not built in wave 3, so the
 * library has no `ui-` element that draws a chart. What DOES exist is gate 5's
 * `PlotSurfaceElement`, which ships no tag of its own — the `ui-` namespace belongs to
 * the components — and the four rendering subjects `tools/fixtures/plot-surface-fixture.js`
 * brings for Gate A. A chart that only Gate A ever mounts has no Gate B baseline at all,
 * and the standing order for this wave is that a chart card with a fixture shot is among
 * the captured states. So the gate wires the fixture in, the way `base-fixture` (wave 0a,
 * also not a shipping component) has been wired since the first night. When #9 lands it
 * brings its own entry and this one can go, or stay as the surface-without-a-card view.
 *
 * WHY A DEMO MODULE AND NOT `module: '../../fixtures/plot-surface-fixture.js'`.
 * Two reasons, both mechanical:
 *
 *   1. gallery.js does one `import(entry.module)` per entry (gallery.js:46-51), and a
 *      state's markup is a STRING — there is no hook in which to call `setChannels()`
 *      and `setRecords()`. A plot with no channels deliberately does not build
 *      (plot-surface.js #buildPlot's early return, the fix for finding cross-5), so the
 *      bare fixture would photograph as an empty box. The two elements defined here
 *      load a deterministic shot themselves.
 *
 *   2. THE GALLERY SETTLES ON `updateComplete`, and the mount is asynchronous: sheet
 *      adoption, then `document.fonts.ready`, then the first build. `getUpdateComplete`
 *      is extended to await the load, so `gallerySettled` cannot be set on a chart that
 *      has not drawn yet. Without that the battery shoots an empty canvas roughly as
 *      often as not, and "a capture taken one frame early is a baseline that is wrong
 *      forever" (gallery.js:22-24).
 *
 * THE CANARY IS ON THE STAGE ON PURPOSE. `<plot-surface-demo-canary>` declines the
 * vendor stylesheet, which is Part 8 §3 Rule 1's failure and mount C: the canvas is
 * pixel-identical to the healthy chart — 0 of 288,000 pixels differ — while the chart is
 * dead to input. Its capture exists so the Gate B reviewer can see, with two files side
 * by side, that the screenshot gate cannot see this class of defect by construction.
 * Gate A owns it: `test/render/plot-surface.render.test.mjs` asserts both discriminators
 * and sweeps real CDP pointer events across the plot.
 */

import { PlotFixture, CHANNELS, makeRecords } from '../../fixtures/plot-surface-fixture.js';

/** One deterministic shot: 60 samples over 30 s, pressure ramping to 9, flow riding under it. */
const SHOT = { channels: CHANNELS, records: makeRecords({ n: 60, seconds: 30, peak: 9 }) };

/**
 * A surface that loads its own shot, and does not report itself updated until it has.
 * Everything it draws with still comes from the document's tokens through the host.
 */
class PlotSurfaceDemo extends PlotFixture {
    #loaded = null;

    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.#loaded = this.ready.then((ok) => {
            // `ready` resolves false for a failed mount and holds the reason on
            // `mountError`; it never rejects (finding cross-6's contract). A canary
            // that declined the sheet still draws, so `false` is not a reason to stop.
            if (this.mountError) return false;
            this.load(SHOT);
            return ok;
        });
    }

    async getUpdateComplete() {
        const done = await super.getUpdateComplete();
        if (this.#loaded) await this.#loaded;
        return done;
    }
}

/** RULE 1'S CANARY, on the stage: pixel-identical, dead to input. */
class PlotSurfaceDemoCanary extends PlotSurfaceDemo {
    async adoptPlotStyleSheet() { return false; }
}

customElements.define('plot-surface-demo', PlotSurfaceDemo);
customElements.define('plot-surface-demo-canary', PlotSurfaceDemoCanary);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
export { PlotSurfaceDemo, PlotSurfaceDemoCanary, SHOT };
