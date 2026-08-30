/**
 * type-roles.entry.js - the gallery entry for component #13 (wave 1, item #13).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * `tools/gallery/README.md:12` says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 1 runs sixteen builders in parallel
 * under a whole-file-write rule, so sixteen appends to one array clobber each other.
 * Each builder therefore owns one file here and the wave's GATE agent wires them into
 * `entries.js` once, serially:
 *
 *     import { entry as typeRoles } from './entries/type-roles.entry.js';
 *     export const entries = [ ...existing, typeRoles ];
 *
 * WHY THE SUBJECT IS A FIXTURE AND NOT A COMPONENT. Row #13 ships no element -
 * SCOPE.md:1531: "Dissolves into the token layer plus a shared style module rather than
 * an element - recorded here so the inventory stays 57-for-57." The roles are classes
 * applied to plain markup inside some component's shadow root, so there is nothing to
 * mount directly: `stageHost.innerHTML` is LIGHT DOM, and a shadow-scoped fragment
 * cannot reach it. `test/fixtures/type-roles-fixture.js` is the subject, exactly as
 * wave 0a's `base-fixture` is the subject for the base conventions - a real element that
 * is not a shipping component, so the gallery and the capture battery have something to
 * photograph.
 *
 * THE THREE STATES ARE THREE CONTAINER WIDTHS, because that is the only variable a type
 * layer has. `hostStyle` sizes the CONTAINER, never the viewport (README: "the only
 * honest way to show a component that reads its own container"), and the display step is
 * `clamp(32px, 3.4cqi, 42px)` - so the same specimen shows the clamp floor at 600px, an
 * intermediate value at 1100px, and the UI scale holding its fixed px throughout. The
 * viewport half of the matrix is the battery's business.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`type-roles--<state>`): identifiers, not labels.
 */

export const entry = {
    id: 'type-roles',
    title: 'Type roles',
    module: '../../test/fixtures/type-roles-fixture.js',
    notes:
        'Component #13, and NOT an element: six roles - title / heading / caption / '
        + 'body / microcap / numeric - shipped as the shared style module '
        + 'src/components/type-roles.js over the twenty §3.5 tokens. Every value is '
        + 'Slate\'s, with five declared departures: zero !important, the rules wrapped '
        + 'in :where() so a component always wins, microcap weight 600 -> 700, microcap '
        + 'tracking .12em -> .04em, and the UA block margin zeroed so a role reads the '
        + 'same on an h1 and a div.',
    states: [
        {
            id: 'specimen',
            title: 'The six roles',
            notes:
                'Top to bottom: title (28px/500), the same role on a div, heading '
                + '(20px/500), a heading the component re-sized through a bare element '
                + 'selector with no !important, caption (16px/400, muted, capped at 70ch), '
                + 'a caption the component centred, body (17px/400) with a numeric span '
                + 'inside it, microcap (15px/700, uppercase, .04em), two equal-length '
                + 'digit strings in and out of the numeric role, a display readout, and '
                + 'one unroled span proving the module does nothing until asked.',
            html: '<type-roles-fixture></type-roles-fixture>',
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (600px)',
            notes:
                'The HOST is narrow at an unchanged viewport. The display readout drops to '
                + 'its clamp floor of 32px because 3.4cqi resolves against this component\'s '
                + 'own container; every UI step above it holds its fixed px, which is the '
                + 'whole of spec §2.2 - legibility is a floor, and the bench tablet already '
                + 'renders text ~10% larger than the desk harness. The caption is now '
                + 'narrower than its 70ch measure, so the cap simply stops applying.',
            hostStyle: { 'inline-size': '600px' },
            html: '<type-roles-fixture></type-roles-fixture>',
        },
        {
            id: 'wide-container',
            title: 'Wide container (1100px)',
            notes:
                'The other end of the same lever: the readout grows toward its 42px ceiling '
                + 'while the caption stops dead at 70ch. Prose has a measure and numbers do '
                + 'not - that is the difference between the UI scale and the display scale, '
                + 'and the reason they are two families rather than one.',
            hostStyle: { 'inline-size': '1100px' },
            html: '<type-roles-fixture></type-roles-fixture>',
        },
    ],
};

export default entry;
