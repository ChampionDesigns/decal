/**
 * The gallery's loader for the CHART SURFACE (.
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
