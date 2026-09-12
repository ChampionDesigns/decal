/**
 * The gallery entry for the auto-fitting card grid. Its states hold the cards still and
 * move the host instead: two up, ragged content made equal by construction, the width
 * where the columns change over, the collapse to one, and a stated single column. The
 * loader it names registers the grid and the cards inside it.
 */

export const entry = {
    id: 'ui-card-grid',
    title: 'Card grid',
    module: './entries/ui-card-grid.demo.js',
    notes:
        'Component #51 ("2-up card layout (skin picker, update list), '
        + 'small, #8"). The reference skin builds this twice in one screen and the two disagree: the '
        + 'skin picker measures a 14px gap around 593px cards, the USB-charger tiles a '
        + '12px gap around 594px - bug T20 ("fourteen distinct gap literals pass through '
        + 'the shell\'s rhythm rules untouched") and T14. Here there is one gap, '
        + '--ui-space-3, on both axes and in both column modes, and no per-instance gap '
        + 'on the API, so two uses cannot disagree; spec §3.3 snaps the reference skin\'s 14 to 12, '
        + 'which lands the cells on 594px at a 1200px leaf - the charger grid\'s measured '
        + 'width to the pixel. The tracks are '
        + 'repeat(auto-fill, minmax(max(min(100%, 280px), (100% - gap) / 2), 1fr)): two '
        + 'columns while half the container clears the 280px floor (Appendix 14, the '
        + 'auto-fill tile grid "the pattern to copy"), one below it, never three, with '
        + 'the crossover falling out of the arithmetic rather than being written down '
        + 'again as a breakpoint. auto-fill and not auto-fit, so the column count is the '
        + 'container\'s answer and never the item count. It paints nothing and owns no '
        + 'selected look: the surface is #8 and selection stays on the cell.',
    states: [
        {
            id: 'skin-picker',
            title: 'Skin picker, 2-up at 900px',
            notes:
                'The row\'s primary use. Two tracks of (900 - 12) / 2 = 444px, one gap '
                + 'token on both axes, row-major - across, then down, as the oracle '
                + 'measures it (settings-display-skin cards at x 629 / 1236, y 479 then '
                + '589). The cells are #8 cards; the grid constructs none of them.',
            hostStyle: { 'inline-size': '900px' },
            html:
                '<ui-card-grid label="Installed skins">'
                + '<ui-card>Streamline.js v0.1.88 - update available</ui-card>'
                + '<ui-card>Beanie v0.3.5 - update available</ui-card>'
                + '<ui-card>NSX v0.4.0 - bundled</ui-card>'
                + '<ui-card>OverDose v0.0.11 - bundled</ui-card>'
                + '<ui-card>Passione v0.9.4 - bundled</ui-card>'
                + '<ui-card>WorkFlow v0.3.7 - update available</ui-card>'
                + '<ui-card>Insight v0.1.0 - bundled</ui-card>'
                + '<ui-card>Radian v0.1.0 - installed</ui-card>'
                + '</ui-card-grid>',
        },
        {
            id: 'ragged-cells',
            title: 'Equal height by construction',
            notes:
                'One cell wraps to three lines and its neighbour to one. The cells '
                + 'stretch to the row band, so a card is never shorter than the row it '
                + 'sits in. The reference skin\'s ten skin cards are all 96px tall only because their '
                + 'content happens to be uniform.',
            hostStyle: { 'inline-size': '900px' },
            html:
                '<ui-card-grid label="Installed skins">'
                + '<ui-card>Streamline.js v0.1.88</ui-card>'
                + '<ui-card>Streamline.js (Bengle) v0.1.85 - installed, and this one '
                + 'carries the long provenance caption that wraps onto a second and a '
                + 'third line at this container width</ui-card>'
                + '<ui-card>the reference skin v0.1.18 - active</ui-card>'
                + '<ui-card>Radian v0.1.0 - installed</ui-card>'
                + '</ui-card-grid>',
        },
        {
            id: 'crossover',
            title: 'At the crossover, 572px',
            notes:
                '2 x 280 + 12 = 572, the last width at which two cells still clear the '
                + 'floor. Both tracks measure exactly 280px here; one pixel narrower and '
                + 'the grid is the next state.',
            hostStyle: { 'inline-size': '572px' },
            html:
                '<ui-card-grid label="Installed skins">'
                + '<ui-card>Streamline.js v0.1.88</ui-card>'
                + '<ui-card>Beanie v0.3.5</ui-card>'
                + '<ui-card>NSX v0.4.0</ui-card>'
                + '<ui-card>OverDose v0.0.11</ui-card>'
                + '</ui-card-grid>',
        },
        {
            id: 'collapsed',
            title: 'Collapsed to 1-up at 520px',
            notes:
                'Below the crossover the grid is one full-width column - the shape a '
                + '1000x600 window puts the settings leaf pane into. Nothing is dropped '
                + 'and nothing overflows: min(100%, 280px) is the clause that keeps a '
                + 'narrow pane from growing a horizontal scrollbar.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-card-grid label="Installed skins">'
                + '<ui-card>Streamline.js v0.1.88</ui-card>'
                + '<ui-card>Beanie v0.3.5</ui-card>'
                + '<ui-card>NSX v0.4.0</ui-card>'
                + '<ui-card>OverDose v0.0.11</ui-card>'
                + '</ui-card-grid>',
        },
        {
            id: 'update-list',
            title: 'Update list, columns="1"',
            notes:
                'The row\'s second use ("skin picker (2-up), '
                + 'update list"): one full-width column, the same gap token, the same '
                + 'flow. One component means the stack and the grid cannot drift apart '
                + 'the way the reference skin\'s two card grids did.',
            hostStyle: { 'inline-size': '900px' },
            html:
                '<ui-card-grid columns="1" label="Available updates">'
                + '<ui-card>Streamline.js - v0.1.88 to v0.1.95</ui-card>'
                + '<ui-card>Beanie - v0.3.5 to v0.3.6</ui-card>'
                + '<ui-card>WorkFlow - v0.3.7 to v0.3.9</ui-card>'
                + '</ui-card-grid>',
        },
    ],
};

export default entry;
