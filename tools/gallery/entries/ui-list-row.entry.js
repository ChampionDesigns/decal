/**
 * The gallery entry for.
 */

const LIST_OPEN =
    '<div style="display:grid; gap:var(--ui-seam); background:var(--ui-line)">';
const LIST_CLOSE = '</div>';

const DISC = (n) =>
    '<span slot="favourite" aria-label="Favourite slot ' + n + '" style="display:inline-grid;'
    + ' place-items:center; inline-size:48px; block-size:48px; border-radius:var(--ui-radius);'
    + ' background:var(--ui-key-on); color:var(--ui-text-2); font-size:var(--ui-text-2xs)">'
    + n + '</span>';

export const entry = {
    id: 'ui-list-row',
    title: 'List row',
    module: '../../src/components/ui-list-row.js',
    notes:
        'Component #26: title + provenance badge + favourite disc + overflow affordance, '
        + 'at --ui-list-row (64px) with a 24px inset. It never existed as a primitive, '
        + 'and today it is built TWICE in JS with byte-identical class '
        + 'strings, so an affordance added to one copy never reached the other (P6). '
        + 'Selection is the four dials and nothing else - no leading bar, no weight change. '
        + 'The separator between rows is the CONTAINER\'s 1px gap (CONVENTIONS §13), which '
        + 'is why every state below wraps its rows in a seamed grid.',
    states: [
        {
            id: 'resting',
            title: 'Resting',
            notes:
                'The measured row: 64px floor, 24px inset, 20px --ui-text-lg title at '
                + '--ui-weight-regular, --ui-fascia ground, and the 64x64 --ui-muted overflow '
                + 'affordance flush with the row\'s own inset. No border anywhere on the row.',
            html: `${LIST_OPEN}<ui-list-row>Lever Classic demo</ui-list-row>${LIST_CLOSE}`,
        },
        {
            id: 'list',
            title: 'A list, with the seam between rows',
            notes:
                'Six rows in a 1px grid gap over --ui-line. N cells give N-1 seams with no '
                + 'sibling selector, so bug T2 ("the > * + * half of the rule can never '
                + 'match") has nothing to go wrong in. The third row is selected.',
            html:
                LIST_OPEN
                + '<ui-list-row>7g basket</ui-list-row>'
                + '<ui-list-row>80\'s Espresso</ui-list-row>'
                + '<ui-list-row aria-selected="true">Adaptive v2</ui-list-row>'
                + '<ui-list-row>Best practice (light roast)</ui-list-row>'
                + '<ui-list-row>Classic Italian espresso</ui-list-row>'
                + '<ui-list-row>Cremina lever machine</ui-list-row>'
                + LIST_CLOSE,
        },
        {
            id: 'selected',
            title: 'Selected, beside its unselected neighbour',
            notes:
                'The whole of the treatment is --ui-selected-face and --ui-selected-ink; '
                + '--ui-selected-led is 0px and --ui-selected-glow is 0% on the reference skin\'s own dials, '
                + 'so nothing else paints. The affordance takes the ink by inheriting it, '
                + 'which is what stops the muted grey disappearing into the fill.',
            html:
                LIST_OPEN
                + '<ui-list-row aria-selected="true">Power</ui-list-row>'
                + '<ui-list-row>Default</ui-list-row>'
                + LIST_CLOSE,
        },
        {
            id: 'furnished',
            title: 'Provenance chip and favourite disc',
            notes:
                'Everything the row can carry at once. The chip is a real ui-badge (#12) - '
                + 'the reference skin\'s shell sheet repainted it into a pipe-separated span from 1,300 '
                + 'lines away and a shadow root makes that unreachable. The disc arrives '
                + 'through slot="favourite"; component #35 owns its paint, not this row.',
            html:
                LIST_OPEN
                + `<ui-list-row provenance="from Adaptive v2">Adaptive v3${DISC(3)}</ui-list-row>`
                + `<ui-list-row aria-selected="true" provenance="from Default">the default${DISC(1)}</ui-list-row>`
                + '<ui-list-row>Extractamundo Dos!</ui-list-row>'
                + LIST_CLOSE,
        },
        {
            id: 'no-overflow',
            title: 'A list with no row actions',
            notes:
                'A row draws no actions control at all; a list that wants one slots its own '
                + 'trigger into slot="actions". So this is now simply what a row looks like, '
                + 'and there is nothing to opt out of. '
                + 'THE MARKUP KEEPS ITS no-overflow ATTRIBUTE ON PURPOSE (audit D11, '
                + '30 August 2026): it used to suppress the row\'s own built-in affordance, '
                + 'and it is now inert - Lit observes no property for it - so this state is '
                + 'also the evidence that a consumer who never updated is inert rather than '
                + 'broken. The state id is the capture filename and the rendered result is '
                + 'unchanged by the amputation, so no re-baseline is owed. A state showing a '
                + 'SLOTTED trigger would be a new capture, which is the owner\'s call.',
            html:
                LIST_OPEN
                + '<ui-list-row no-overflow>Cleaning / forward flush x5</ui-list-row>'
                + '<ui-list-row no-overflow>Descale</ui-list-row>'
                + LIST_CLOSE,
        },
        {
            id: 'narrow',
            title: 'In a 260px container',
            notes:
                'The title clamps and ellipsises rather than shoving a slotted control off the '
                + 'end - a departure from the reference skin, which never meets a narrow container because '
                + 'its geometry is frozen at 1920x1200 (the oracle is disqualified for '
                + 'responsive behaviour). The 64px floor and the 48px hit floor both hold.',
            hostStyle: { 'inline-size': '260px' },
            html:
                LIST_OPEN
                + '<ui-list-row provenance="from Adaptive v2">Easy blooming - active pressure decline</ui-list-row>'
                + '<ui-list-row aria-selected="true">Extractamundo Dos! (long roast)</ui-list-row>'
                + LIST_CLOSE,
        },
    ],
};

export default entry;
