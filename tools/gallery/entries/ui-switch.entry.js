/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-switch',
    title: 'Switch',
    module: '../../src/components/ui-switch.js',
    notes:
        'Wave 1 #5. The reference skin paints this control and declares no size at all, so the geometry '
        + 'is eighty literals across twenty call sites in settings.js — bug T17, "including an '
        + 'undocumented derived throw". Here it is four tokens (--ui-switch-track-w / -track-h / '
        + '-knob / -inset) and the throw is the arithmetic, not the 46. Polarity is fixed: the '
        + 'filled track is ON, always, and only the knob moves. Oracle: 24 elements in 13 '
        + 'states, one distinct geometry, 100 x 50.',
    states: [
        {
            id: 'off',
            title: 'Off',
            notes: 'Track --ui-key inside a --ui-line hairline at --ui-radius; knob '
                + '--ui-line-strong at --ui-radius-sm, sitting at the 5px inset.',
            html: '<ui-switch aria-label="Cup warmer"></ui-switch>',
        },
        {
            id: 'on',
            title: 'On',
            notes: 'Track fills with --ui-primary; the knob turns --ui-on-primary and has '
                + 'travelled the derived throw to dx=51 — the oracle\'s measurement on all 24.',
            html: '<ui-switch checked aria-label="Wake lock"></ui-switch>',
        },
        {
            id: 'pair',
            title: 'Off and on together',
            notes: 'The polarity check. The reference skin\'s sheet records the earlier version where both '
                + 'the dark mass and the fill polarity swapped between states and "neither could '
                + 'be read at a glance or from an angle". Only the knob moves, only the track fills.',
            html: '<ui-switch aria-label="Off"></ui-switch> <ui-switch checked aria-label="On"></ui-switch>',
        },
        {
            id: 'disabled',
            title: 'Disabled, both states',
            notes: 'One fade, on the host, over the composite — the reference skin\'s own finding that fading '
                + 'track and knob separately collapses the knob\'s contrast against its own track '
                + '(measured 7 levels apart). At --ui-opacity-disabled (.38), not the reference skin\'s .55: '
                + 'spec §3.7 settles one dial against its three live values.',
            html: '<ui-switch disabled aria-label="Stop at weight"></ui-switch>'
                + ' <ui-switch checked disabled aria-label="Stop at weight, on"></ui-switch>',
        },
        {
            id: 'pill',
            title: 'shape="pill", off and on',
            notes: 'Q14, ANSWERED (DQ-610, the owner\'s ruling 21 Aug 2026): the "toggle pill" is '
                + 'this attribute, not a component. #56 was built thin — a wrapper whose whole '
                + 'substance was two corner radii — and it is deleted; the capability stays '
                + 'because the pill look may be wanted soon. The reference skin NEVER RENDERED the pill: '
                + 'prov_query.py find --cls brightness-toggle-label searched all 49 states and '
                + 'found 0 elements, and the old classes have no markup, no JS and '
                + 'no test in app/src. None of its machine-generated numbers is carried '
                + '(§3.4 drops the 2617.374px radius by name); the corners are '
                + '--ui-radius-pill.',
            html: '<ui-switch shape="pill" aria-label="Auto brightness, off"></ui-switch>'
                + ' <ui-switch shape="pill" checked aria-label="Auto brightness, on"></ui-switch>',
        },
        {
            id: 'pill-vs-square',
            title: 'The pill against the plain switch',
            notes: 'THE WHOLE DIFFERENCE, side by side: two corner radii. Box, fill, knob, '
                + 'travel, polarity, keyboard and the change event are identical — the '
                + 'attribute re-points --_ui-switch-radius and --_ui-switch-knob-radius and '
                + 'touches nothing else, and the suite asserts that property by property. Two '
                + 'hooks and not one because the track is --ui-radius (6px) and the knob '
                + '--ui-radius-sm (4px): a single hook renders the same pill and reverses to '
                + 'the wrong switch (measured 6/6 against 6/4).',
            html: '<ui-switch shape="pill" checked aria-label="Pill, on"></ui-switch>'
                + ' <ui-switch checked aria-label="Switch, on"></ui-switch>',
        },
        {
            id: 'narrow-container',
            title: 'In a 200px container',
            notes: 'Nothing moves. §3.1 gives this control four fixed px and §2.3 permits them, '
                + 'so it reads neither its container nor the viewport — the honest container state '
                + 'for a frozen-geometry primitive is the one where the answer is "unchanged".',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-switch checked aria-label="Wake lock"></ui-switch>',
        },
    ],
};

export default entry;
