/**
 * base-fixture - the rendering subject for the base-element conventions
 * (item #2; consumed by item #4's the render harness rig).
 *
 * This file makes no design decisions. It is the smallest component that puts every
 * base convention on screen at once, with stable ids, so the rig can mount it and
 * assert on COMPUTED styles and box geometry rather than on source text
 * (the render harness: "computed styles, real layout engine ... never on source text").
 *
 * WHAT EACH ID IS FOR - the assertions this fixture is built to support:
 *
 * #plain the ONE focus ring, outset. focus it: outline-width should be
 * --ui-focus-w (3px), outline-offset --ui-focus-offset (2px),
 * outline-color --ui-steel. Move --ui-steel on :root and the ring
 * colour must move with it (tokens are consumed, not copied).
 * #clipped the same ring, INSET, inside `.band { overflow: hidden }` -
 * a clipped ring. outline-offset should be
 * --ui-focus-offset-inset (-3px), and the ring must not be clipped.
 * #keycap .hit-overlay on a 20x20 ink. getComputedStyle(el, '::before')
 * should be 48x48 - the --ui-hit-min floor on BOTH axes - while
 * the element itself stays 20x20. Ink and hit floor are separate.
 * #preset .hit-overlay with the per-axis escape hatch:
 * --_ui-hit-inline: 100%. ::before should be 20x48, which is what
 * a control in a shoulder-to-shoulder row needs.
 * #slider .hit-pad with --_ui-hit-ink: 8px. padding-block should compute
 * to 20px and min-block-size to 48px, so the box is 48 and the
 * painted track is 8. background-clip must still be content-box
 * AFTER the component paints it (see the longhand note below).
 * #tab / #tab-off the four selection dials, on and off. #tab's background-color
 * should equal the computed --ui-selected-face and its color
 * --ui-selected-ink; with the the previous skin dials (led 0px, glow 0%) the
 * LED and the glow paint nothing. Move a dial on :root and both
 * must move.
 * #seam-off / the selection COMPOSITION SLOT. Both carry a resting inset seam
 * #seam-on declared through --_ui-rest-shadow. #seam-on is also selected, so
 * its computed box-shadow must still contain the seam's colour -
 * selectionSurface prepends the slot to its LED rather than
 * replacing the whole list, which is what it used to do.
 * #disabled one disabled dial: opacity should be --ui-opacity-disabled. The
 * HOST spelling is <base-fixture-spread disabled>, below.
 * #override the zero-!important mechanism. The base sets `box-sizing:
 * inherit` through :where (zero specificity); this element's own
 * bare-id rule sets `content-box` and wins with no !important
 * anywhere in either sheet.
 * #field-wrap the exported `focusRing` fragment reused on an element the base
 * selector list does not reach, with the inner input's own ring
 * suppressed by a plain higher-specificity rule - again, no
 * !important.
 * #container-probe container hosting. block-size is 10px below 400px of HOST
 * inline size and 40px at or above it. The rig resizes the HOST,
 * not the viewport: at a 1281x801 viewport a narrow host must
 * still report 10px, which is the whole of rule 1.
 *
 * <base-fixture-intrinsic> is the container-hosting OPT-OUT: one line of its own
 * styles turns inline-size containment off for a control that must shrink to fit
 * its glyph. It exists so the rig can prove the escape hatch is one line and needs
 * no !important.
 *
 * <base-fixture-spread> is the SAME opt-out written belt-and-braces - it also spreads
 * UiElement.baseStyles, at the end of its list, which is the shape Lit's own dedupe
 * orders backwards. It must behave identically to <base-fixture-intrinsic>, and it
 * carries the host-level [disabled] case as well.
 */

/* NODE-SAFE SHAPE, and every browser-only file under test/ needs it. Node's test
 * runner treats EVERY .js file under a directory called test/ as a test file, and
 * Node 20 has no --test-exclude - so `node --test test/` imports this file, fails to
 * resolve the bare `lit` specifier (there is no node_modules; the importmap in the
 * served document is the whole module-resolution mechanism) and reports a failing
 * test for a file that contains none. Guarding the body behind a DOM check and
 * importing dynamically makes the file a no-op under node - zero tests, green - and
 * unchanged in the browser. The `css` templates stay exactly where a static guard
 * (guard) can parse them. */

export let BaseFixture;
export let BaseFixtureIntrinsic;
export let BaseFixtureSpread;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement, focusRing, hitArea, selectionSurface } =
    await import('../../src/components/base.js');

BaseFixture = class BaseFixture extends UiElement {
    /* No `UiElement.baseStyles` spread here, deliberately: finalizeStyles prepends
     * the base rules for every subclass, and the fixture is the proof of it. */
    static styles = [
        /* STRUCTURAL fragments first, the component's own rules next, STATE
         * fragments last: selection has to beat the resting paint (base.js,
         * "TWO USAGE RULES"). */
        hitArea,
        css`
            :host {
                /* The fixture is resized by the rig; nothing here fixes a width. */
                padding: 8px;
            }

            .row {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* Painted by CLASS, never by id. An id is (1,0,0) and would beat every
             * attribute selector in selectionSurface, so #tab would silently never
             * turn selected. Ids in this file exist for the rig to query by. */
            .control {
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-4);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text);
                font: inherit;
            }

            /* Bug L24's shape, reproduced on purpose so the inset ring has something
             * to be inset from: a clipping parent, with the offset re-declared for
             * this subtree only. */
            .band {
                overflow: hidden;
                display: flex;
                border-radius: var(--ui-radius);
                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            .control-flat {
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-4);
                border: 0;
                background-color: var(--ui-key);
                color: var(--ui-text);
                font: inherit;
            }

            /* Ink smaller than the floor - the case the overlay exists for. */
            .chip {
                display: inline-grid;
                place-items: center;
                inline-size: 20px;
                block-size: 20px;
                border: 0;
                padding: 0;
                background-color: var(--ui-key);
                color: var(--ui-text);
                font: inherit;
            }

            /* The per-axis escape hatch: a control in a tight row keeps its own
             * inline size and only grows on the block axis. */
            .chip-tight {
                --_ui-hit-inline: 100%;
            }

            /* THE LONGHAND RULE (see base.js, "THE ONE TRAP"). background-image,
             * never the background shorthand: the shorthand resets background-clip
             * to border-box and the 8px track silently swells to fill the 48px hit
             * box. Slate's own sheet documents this at. */
            .track {
                --_ui-hit-ink: 8px;
                inline-size: 200px;
                border-radius: var(--ui-radius-lg);
                background-image: linear-gradient(to right, var(--ui-steel) 50%, var(--ui-line) 50%);
                appearance: none;
                margin: 0;
            }

            /* THE SELECTION COMPOSITION SLOT (base.js, "AND THE ONE COLLISION").
             * A resting inset shadow - the seam between two items in a one-piece
             * bank, which is what --ui-seam-ink is for - declared ONCE in the
             * private slot and painted from it, so selectionSurface prepends it to
             * its own LED instead of replacing it. Without the slot this element
             * would lose its seam the moment it turned selected. */
            .seamed {
                --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
                box-shadow: var(--_ui-rest-shadow);
            }

            /* Zero-!important override, case 1: a bare class selector beats a
             * :where()-wrapped base rule on specificity alone. */
            .override {
                box-sizing: content-box;
                inline-size: 100px;
                padding: 10px;
                border: 0;
            }

            /* Zero-!important override, case 2: the exported ring fragment on a
             * wrapper, and the inner input's own ring turned off by a plain
             * higher-specificity selector. */
            .field-wrap {
                display: inline-flex;
                border-radius: var(--ui-radius);
            }

            .field-wrap:has(:focus-visible) {
                ${focusRing}
            }

            .field-wrap input:focus-visible {
                outline: none;
            }

            /* Container hosting. The query resolves against THIS component's host,
             * because base.js puts container-type: inline-size there. No @media
             * appears anywhere in this file (§2.1 Rule 1). */
            .container-probe {
                block-size: 10px;
                background-color: var(--ui-line);
            }

            @container (inline-size >= 400px) {
                .container-probe {
                    block-size: 40px;
                }
            }
        `,
        selectionSurface,
    ];

    render() {
        return html`
            <div class="row">
                <button id="plain" class="control" type="button">plain</button>
                <button id="disabled" class="control" type="button" disabled>disabled</button>
                <button id="tab" class="control" type="button" aria-selected="true">selected</button>
                <button id="tab-off" class="control" type="button" aria-selected="false">unselected</button>
                <button id="seam-off" class="control seamed" type="button" aria-selected="false">seam</button>
                <button id="seam-on" class="control seamed" type="button" aria-selected="true">seam selected</button>
            </div>

            <div class="band">
                <button id="clipped" class="control-flat" type="button">clipped parent</button>
            </div>

            <div class="row">
                <button id="keycap" class="chip hit-overlay" type="button">E</button>
                <button id="preset" class="chip chip-tight hit-overlay" type="button">1</button>
            </div>

            <input id="slider" class="track hit-pad" type="range" min="0" max="100" .value=${'50'} />

            <div id="override" class="override"></div>

            <span id="field-wrap" class="field-wrap"><input id="field" type="text" /></span>

            <div id="container-probe" class="container-probe"></div>

            <slot></slot>
        `;
    }
};

/**
 * The container-hosting opt-out, in one line of the component's own styles: a
 * control that must shrink to fit its glyph turns inline-size containment off and
 * queries an ancestor container instead (base.js, "THE ONE THING TO KNOW ABOUT IT").
 * The rig asserts this host's inline size tracks its content while <base-fixture>'s
 * does not.
 */
BaseFixtureIntrinsic = class BaseFixtureIntrinsic extends UiElement {
    static styles = [
        css`
            :host {
                container-type: normal;
                display: inline-grid;
                place-items: center;
                min-inline-size: var(--ui-hit-min);
                block-size: var(--ui-hit-min);
                padding-inline: var(--ui-space-2);
                border: var(--ui-border-w) solid var(--ui-line-strong);
                border-radius: var(--ui-radius);
            }
        `,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

/**
 * The BELT-AND-BRACES spelling: the same opt-out as <base-fixture-intrinsic>, but
 * this class ALSO spreads `UiElement.baseStyles`, at the END of its list.
 *
 * That is the case Lit's own dedupe gets backwards - it keeps the LAST occurrence of
 * a repeated sheet, so `[BASE, [own, BASE]]` finalises to `[own, BASE]` and the base's
 * (0,1,0) `:host { container-type: inline-size }` then wins the tie against this
 * class's own (0,1,0) `:host { container-type: normal }` on source order alone. The
 * opt-out would silently do nothing for exactly the author who was being careful.
 * `composeStyles` strips the duplicate first, so both this class and
 * <base-fixture-intrinsic> must report `container-type: normal`.
 *
 * It also carries a host-level `[disabled]` case: a shadow-tree selector cannot match
 * the host, so the disabled dial needs its own `:host()` rule and this is what proves
 * it fires on the ordinary reflected-attribute spelling.
 */
BaseFixtureSpread = class BaseFixtureSpread extends UiElement {
    static styles = [
        css`
            :host {
                container-type: normal;
                display: inline-grid;
                place-items: center;
                min-inline-size: var(--ui-hit-min);
                block-size: var(--ui-hit-min);
                padding-inline: var(--ui-space-2);
                border: var(--ui-border-w) solid var(--ui-line-strong);
                border-radius: var(--ui-radius);
            }
        `,
        UiElement.baseStyles,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

customElements.define('base-fixture', BaseFixture);
customElements.define('base-fixture-intrinsic', BaseFixtureIntrinsic);
customElements.define('base-fixture-spread', BaseFixtureSpread);

}
