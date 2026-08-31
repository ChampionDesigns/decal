/**
 * type-roles-fixture - the rendering subject for component #13, the type roles
 * (; the row that "dissolves into the token layer plus a shared style module
 * rather than an element").
 *
 * There is no `<ui-title>` and there never will be, so the render harness needs a subject that is
 * not the thing under test: this fixture is one, in the same sense that
 * `base-fixture.js` is a subject for the base conventions. It makes no design
 * decisions - every value it renders comes from `src/components/type-roles.js` or from
 * a token - and it exists so the rig can assert on COMPUTED styles and box geometry
 * rather than on source text (the notes the render harness).
 *
 * IT MOUNTS THE ROLES ON PLAIN ELEMENTS, which is the whole point: `<h1 class=
 * "ui-title">`, `<p class="ui-caption">`, `<span class="ui-microcap">`. A type role is
 * a class on ordinary markup inside some component's shadow root; it is not a custom
 * element and does not want to be one.
 *
 * WHAT EACH ID IS FOR - the assertions this fixture is built to support:
 *
 * #title .ui-title on an <h1>. 28px --ui-text-xl at 500 --ui-weight-medium,
 * --ui-text ink, line-height 1.2. Its UA margin must be zeroed:
 * spacing is the layout's job.
 * #title-div the SAME role on a <div>, to prove a role reads identically on a
 * semantic element and a generic one. Every computed type property
 * and both block margins must match #title.
 * #heading .ui-heading on an <h2>. 20px --ui-text-lg at 500, line-height 1.3.
 * #override .ui-heading on an <h3> that the fixture's OWN bare element rule
 * re-sizes. The roles are authored inside :where, so a role is
 * (0,0,0) and a plain `h3 { font-size: var(--ui-text-note) }` wins
 * with no !important anywhere - which is the mechanism bug did
 * not have (a shared alignment an author could not override).
 * #caption .ui-caption with real copy. 16px --ui-text-note at 400,
 * --ui-muted ink, line-height 1.5, capped at --ui-measure (70ch) so
 * it stops well short of a wide container.
 * #caption-centred the same role plus the fixture's own `.centred` class. again,
 * from the other side: an author who WANTS centred copy gets it.
 * #body .ui-body. 17px --ui-text-base at 400, line-height 1.5, and no
 * colour of its own - the ink is inherited.
 * #numeric-inline .ui-numeric inside #body: the modifier composes, taking its size,
 * weight and colour from the role it sits in.
 * #microcap .ui-microcap. 15px --ui-text-sm at 700 --ui-weight-semibold,
 * --ui-tracking-cap, --ui-muted, rendered uppercase - while
 * textContent stays as authored, because text-transform is paint and
 * the accessible name is not.
 * #numeric-a/-b two equal-length digit strings in the numeric role. Tabular
 * figures means they occupy exactly the same width; a readout that
 * changes must not jitter.
 * #plain-a/-b the same two strings with no role, for contrast.
 * #readout the display scale composed with the numeric role - a component's
 * own `font-size: var(--ui-display-md)` on an element carrying
 * .ui-numeric. This is the documented way to build a big number, and
 * it is deliberately NOT a seventh role: the clamp resolves against
 * `cqi`, i.e. the COMPONENT's own container (rule 1),
 * so it belongs to whoever owns that container. Narrow the host and
 * this must shrink while every UI-scale role above holds its size.
 * #unroled a plain <span> with no role at all. The shared module must do
 * nothing until a class asks it to.
 */

/* NODE-SAFE SHAPE, required of every browser-only file under test/: node --test claims
 * every .js file under test/, and this one imports `lit`, which is resolved by the
 * served document's importmap rather than by node. Guarding the body behind a DOM
 * check and importing dynamically makes the file a no-op under node - zero tests,
 * green - and unchanged in the browser. The `css` template stays where a static guard
 * can parse it. See test/fixtures/canaries/README.md. */

export let TypeRolesFixture;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../src/components/base.js');
const { typeRoles } = await import('../../src/components/type-roles.js');

TypeRolesFixture = class TypeRolesFixture extends UiElement {
    /* The shared module goes FIRST, with the structural fragments: it is a default
     * layer, and every rule in it is written to lose a tie (CONVENTIONS). No
     * `UiElement.baseStyles` spread - finalizeStyles prepends the base for every
     * subclass. */
    static styles = [
        typeRoles,
        css`
            :host {
                display: block;
                padding: var(--ui-space-5);
            }

            /* Grid GAP, never a margin: the roles zero the UA's block margins and a
             * fixture that put them back would be testing its own stack rather than
             * the module. Every role element below therefore reports margin 0 on all
             * four sides, wherever it sits in the list. */
            .stack {
                display: grid;
                gap: var(--ui-space-4);
            }

            .row {
                display: flex;
                align-items: baseline;
                gap: var(--ui-space-4);
            }

            /* The zero-specificity proof. A bare element selector is (0,0,1); a role
             * inside :where() is (0,0,0). This wins, and there is no !important in
             * either sheet. */
            h3 {
                font-size: var(--ui-text-note);
            }

            /* Bug T11's shape, inverted: a component that wants centred copy says so
             * in its own styles and is simply obeyed. */
            .centred {
                text-align: center;
            }

            /* The display scale, composed rather than roled. --ui-display-md is
             * clamp(32px, 3.4cqi, 42px) and the container it measures is this
             * component's own host. */
            .readout {
                font-size: var(--ui-display-md);
                font-weight: var(--ui-weight-regular);
                line-height: 1.1;
            }
        `,
    ];

    render() {
        return html`
            <div class="stack">
                <h1 id="title" class="ui-title">Espresso</h1>
                <div id="title-div" class="ui-title">Espresso</div>
                <h2 id="heading" class="ui-heading">Water</h2>
                <h3 id="override" class="ui-heading">Resized by the component</h3>
                <p id="caption" class="ui-caption">
                    Explanatory copy under a label, long enough to reach the measure and
                    wrap: the cap exists so a line of help text never runs the full width
                    of a wall panel, which is the failure the one caption treatment was
                    written to end. Slate ran help text to a 155-character measure in
                    places, and centred it in others.
                </p>
                <p id="caption-centred" class="ui-caption centred">Centred by the component.</p>
                <p id="body" class="ui-body">
                    Body copy, with a reading of
                    <span id="numeric-inline" class="ui-numeric">93.5</span>
                    set inside it.
                </p>
                <span id="microcap" class="ui-microcap">Pressure</span>
                <div class="row">
                    <span id="numeric-a" class="ui-numeric">1111111111</span>
                    <span id="numeric-b" class="ui-numeric">0000000000</span>
                    <span id="plain-a">1111111111</span>
                    <span id="plain-b">0000000000</span>
                </div>
                <span id="readout" class="ui-numeric readout">9.0</span>
                <span id="unroled">Unroled</span>
            </div>
        `;
    }
};

customElements.define('type-roles-fixture', TypeRolesFixture);

}
