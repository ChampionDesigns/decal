/**
 * The gallery's loader for the CHART CARD (.
 */

import { UiChartCard } from '../../../src/components/ui-chart-card.js';

/** The recorded shot, resolved against this module so the served root is irrelevant. */
const SHOT_URL = new URL(
    '../../rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json',
    import.meta.url,
).href;

/** Fetched and derived ONCE per page, however many states mount a card. */
let derived = null;

async function shotDerivation() {
    if (!derived) {
        derived = (async () => {
            const { deriveFromRecord } = await import('../../../src/lib/shot-derivation.js');
            const record = await (await fetch(SHOT_URL)).json();
            return deriveFromRecord(record);
        })();
    }
    return derived;
}

/**
 * The card, with a shot. It does not report itself updated until the derivation has
 * arrived AND the mount has finished, which is what makes the battery's captures
 * deterministic.
 */
class UiChartCardShot extends UiChartCard {
    #loaded = null;

    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.#loaded = (async () => {
            await this.ready;
            this.derivation = await shotDerivation();
            this.performUpdate();
            this.drawNow();
        })();
    }

    async getUpdateComplete() {
        const done = await super.getUpdateComplete();
        if (this.#loaded) await this.#loaded;
        return done;
    }
}

customElements.define('ui-chart-card-shot', UiChartCardShot);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
export { UiChartCardShot, SHOT_URL };
