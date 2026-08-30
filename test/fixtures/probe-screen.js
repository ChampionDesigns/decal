/**
 * probe-screen — a second screen, so a ROUTE SWAP can be measured.
 *
 * The shell's job is to swap which screen component is mounted; proving it needs two
 * screens, and wave 5.1 builds exactly one (`live-screen`, and even that is a
 * placeholder — later screens are out of scope by the wave's own constraint). So the
 * second one lives here, in the test tree, where it costs the shipping tree nothing.
 *
 * It counts its own connects and disconnects on `window.__probe`, which is the direct
 * oracle for "mounts and unmounts cleanly": a swap that left the old element in the tree,
 * or that connected the new one twice, shows up as an imbalance rather than as a
 * screenshot nobody reads. Bug S10 is exactly this class — `initScaling` imported twice,
 * inert only by accident, and "a second call would duplicate every resize listener".
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory, and Node 20 has no --test-exclude.
 */

export let ProbeScreen;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../src/components/base.js');

const counters = (globalThis.__probe = globalThis.__probe || {
    connects: 0,
    disconnects: 0,
    /** Live instances. Must be 0 or 1 for the whole of a route-swap run. */
    get live() { return this.connects - this.disconnects; },
    reset() { this.connects = 0; this.disconnects = 0; },
});

ProbeScreen = class ProbeScreen extends UiElement {
    static styles = [css`
        :host { display: block; }
        .probe { padding: var(--ui-space-6); }
    `];

    connectedCallback() {
        super.connectedCallback();
        counters.connects += 1;
    }

    disconnectedCallback() {
        counters.disconnects += 1;
        super.disconnectedCallback();
    }

    render() {
        return html`<div class="probe"><p>Probe</p></div>`;
    }
};

customElements.define('probe-screen', ProbeScreen);

}
