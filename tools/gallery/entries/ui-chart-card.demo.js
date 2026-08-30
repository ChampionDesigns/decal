/**
 * ui-chart-card.demo.js — the gallery's loader for the CHART CARD (wave 3, item #9).
 *
 * WHY A DEMO MODULE AND NOT `module: '../../../src/components/ui-chart-card.js'`.
 * Two mechanical reasons, the same two `plot-surface.demo.js` records:
 *
 *   1. gallery.js does one `import(entry.module)` per entry and a state's markup is a
 *      STRING (gallery.js:46-51, :81) — there is no hook in which to hand the card a
 *      derivation. The card draws what it is given and nothing else (no store, no
 *      endpoint), so a bare `<ui-chart-card>` in a state would photograph as its empty
 *      state, which is a state, but not the one anybody wants to look at.
 *
 *   2. THE GALLERY SETTLES ON `updateComplete`, and the card's mount is asynchronous:
 *      sheet adoption, then the axis face, then the first build. `getUpdateComplete` is
 *      extended to await the shot as well, so `gallerySettled` cannot be set on a chart
 *      that has not drawn yet — "a capture taken one frame early is a baseline that is
 *      wrong forever" (gallery.js:22-24).
 *
 * THE SUBJECT IS THE SHIPPING COMPONENT. `<ui-chart-card-shot>` adds one thing to
 * `UiChartCard` — it fetches a shot and hands it over — and overrides nothing that
 * paints. The `no-shot` state mounts the plain `<ui-chart-card>` directly, because a
 * card with no derivation needs no help to be photographed.
 *
 * THE SHOT IS A REAL RECORDING, not a generated curve: `tools/rea-fixtures/` holds three
 * `GET /api/v1/shots/<id>` bodies captured from the bench. This one is 426 measurements /
 * 336 in-shot samples / 22.3 s / two profile steps ("PI", "Lever"), and it is the same
 * shot `test/render/ui-chart-card.render.test.mjs` asserts against, so the picture and
 * the assertions describe one thing. It is scale-less, like every bench recording in
 * that directory, so the weight-flow channel is legitimately empty — a channel with no
 * data drawing nothing is part of what these captures show.
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
            // `ready` resolves false for a failed mount and holds the reason on
            // `mountError`; it never rejects. A card that failed its mount still has a
            // frame worth photographing, so this does not stop for it.
            await this.ready;
            this.derivation = await shotDerivation();
            // performUpdate() and NOT `await this.updateComplete`: `updateComplete` routes
            // through the getUpdateComplete override below, which awaits THIS promise —
            // awaiting it from inside is a deadlock, and it is a silent one. MEASURED: the
            // gallery-state test sat on it until the run was killed, with 23 of 25 subtests
            // green and no error anywhere. Lit's performUpdate is synchronous, so the
            // derivation is rendered and drawn before this promise settles either way.
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
