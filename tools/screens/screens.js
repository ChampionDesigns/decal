/**
 * The screen half of the capture walk: a registry of screen states, each driven by the
 * test suite's own fixture, and the mount/settle pair the host page calls.
 *
 * A state names its fixture, the mock park it needs, and a `drive` that puts the screen
 * into the state. `?state=<id>` drives one and sets `data-screens-settled` when it has.
 */
import { allLeaves, categoryOf, navName } from 'src/lib/settings-nav.js';

import { SERVED_CAPABILITIES } from 'src/stores/capabilities-store.js';

import { installFit } from 'src/lib/app-fit.js';

installFit();

const params = new URLSearchParams(location.search);
const mockPort = params.get('mock') ?? '8080';
const mockBase = `127.0.0.1:${mockPort}`;

document.documentElement.setAttribute('data-theme', params.get('theme') ?? 'dark');

const REFUSED = {
    ok: false,
    kind: 'http',
    status: 400,
    message: 'Unsupported profile',
    problem: {
        error: 'Unsupported profile',
        message: 'This machine cannot run a Lever step in "Blooming espresso".',
    },
};

const COLLAPSE_CLEARANCE_PX = 80;

/** The `#stage` host the selector and settings fixtures mount into, created on demand. */
function selectorStage() {
    let stage = document.getElementById('stage');
    if (!stage) {
        stage = document.createElement('div');
        stage.id = 'stage';
        document.getElementById('mount').append(stage);
    }
    return stage;
}

async function selectorAtRest(api) {
    selectorStage();
    await api.mount({ port: mockPort });
}

async function selectFirst(api) {
    const [id] = api.ids({ limit: 1 });
    await api.select(id);
    return id;
}

function firstDevicesFrame() {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://${mockBase}/ws/v1/devices`);
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error(`no devices frame from ${mockBase} in 15 s`));
        }, 15000);
        socket.addEventListener('message', (event) => {
            let frame;
            try { frame = JSON.parse(event.data); } catch { return; }
            if (!frame || !Array.isArray(frame.devices)) return;
            clearTimeout(timer);
            socket.close();
            resolve(frame);
        });
        socket.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error(`devices socket failed at ${mockBase}`));
        });
    });
}

const STATES = [
    {
        id: 'live--ready',
        title: 'Live · connected',
        fixture: 'gates',
        mock: 'shot',
        notes: 'A connected machine costs the screen no rows at all: the connection surface '
            + 'collapses. The composition reads are awaited rather than left to settle, so the '
            + 'names, the stored shot, the chart and the band are all landed before the frame.',
        async drive(api) {
            api.pushDevices(await firstDevicesFrame());
            api.mount(document.getElementById('mount'));
            await api.loadComposition();

            await api.pushRestingMachine();
        },
    },
    {
        id: 'live--pending-ambiguity',
        title: 'Live · two machines, pick one',
        fixture: 'gates',
        mock: 'park',
        notes: 'The server is holding a selection session open and suppressing recovery; the dialog '
            + 'opens itself, once per park.',
        async drive(api) {
            api.pushDevices(await firstDevicesFrame());
            api.mount(document.getElementById('mount'));
        },
    },
    {
        id: 'live--refusal',
        title: 'Live · profile refused',
        fixture: 'gates',
        mock: 'shot',
        notes: 'A 400 carrying the server\'s own sentence in the alert banner, rather than a sentence '
            + 'this skin wrote about a failure it did not diagnose.',
        async drive(api) {
            api.pushDevices(await firstDevicesFrame());
            api.mount(document.getElementById('mount'));
            api.answer('/machine/profile', REFUSED);
            await api.armProfile();
        },
    },
    {
        id: 'live--idle',
        title: 'Live · idle machine',
        fixture: 'loop',
        mock: 'shot',
        notes: 'The real app boot, six sockets open and silent, which is what an idle machine\'s '
            + 'snapshot channel is. No recorded frame carries state `idle`, so the fixture '
            + 'constructs the one snapshot and sends it down the real road.',
        async drive(api) {
            await api.mount({ port: mockPort });
            api.pushMachineFrame('idle');
        },
    },
    {
        id: 'live--mid-shot',
        title: 'Live · mid-shot',
        fixture: 'loop',
        mock: 'shot',
        notes: 'The recorded shot playing at the render budget, stopped at about 120 in-shot '
            + 'samples: the chart drawn, the gauges live, the stop box armed.',
        async drive(api) {
            await api.mount({ port: mockPort });
            api.startStream();
            await api.untilInShot(120);
        },
    },
    {
        id: 'live--post-shot',
        title: 'Live · shot finished',
        fixture: 'loop',
        mock: 'shot',
        notes: 'The buffer closed on the mock\'s `finished` frame and frozen, which is the state the '
            + 'foot band\'s totals are read in.',
        async drive(api) {
            await api.mount({ port: mockPort });
            api.startStream();
            await api.untilShotClosed();
            await api.untilQuiet();
        },
    },

    {
        id: 'selector--list',
        title: 'Selector · the listing',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The resting state: the recorded listing filtered into a real listbox, nothing '
            + 'selected, the detail pane in its empty state.',
        async drive(api) {
            await selectorAtRest(api);
        },
    },
    {
        id: 'selector--search-narrowed',
        title: 'Selector · search narrowed',
        fixture: 'sel',
        mock: 'shot',
        notes: 'A family prefix that is real in the recorded listing, narrowing it to a handful of '
            + 'rows: the state where the list is short and the pane is not.',
        async drive(api) {
            await selectorAtRest(api);

            await api.search('Baseline');
        },
    },
    {
        id: 'selector--detail-preview',
        title: 'Selector · a profile selected',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The select half of the loop: title, stat tiles, notes, and the preview curves drawn '
            + 'in the chart card on its unpadded host.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
        },
    },
    {
        id: 'selector--favourite',
        title: 'Selector · picked off the favourites rail',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The five-slot rail with one slot picked, which is the route into a profile that does '
            + 'not go through the list at all.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
            await api.pickFavourite(0);
        },
    },
    {
        id: 'selector--armed',
        title: 'Selector · armed',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The screen after Confirm. The profile is sent and the selector stays; there is '
            + 'no second question.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
            await api.confirmLoad();
        },
    },
    {
        id: 'selector--refusal',
        title: 'Selector · profile refused',
        fixture: 'sel',
        mock: 'shot',
        notes: 'A typed 400 in the detail pane, carrying the server\'s own sentence. The pane\'s give '
            + 'order in this state is an open question, and this frame is what that question is '
            + 'about.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);

            api.answer('POST', '/api/v1/machine/profile', REFUSED.status, REFUSED.problem);

            await api.confirmLoad();
        },
    },
    {
        id: 'selector--collapsed-split',
        title: 'Selector · split collapsed',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The split below its threshold: one column, list over detail, with a profile selected '
            + 'so both stacked panes carry content. A container state, not a viewport one, so it '
            + 'appears at every geometry.',
        async drive(api) {
            const stage = selectorStage();

            const { SPLIT_COLLAPSE_PX } = await import('src/screens/selector-split.js');
            stage.style.inlineSize = `${SPLIT_COLLAPSE_PX - COLLAPSE_CLEARANCE_PX}px`;
            await api.mount({ port: mockPort });

            await selectFirst(api);
        },
    },

    {
        id: 'settings--browse',
        title: 'Settings · browsing',
        fixture: 'settings',
        mock: 'park',
        notes: 'The resting shell: the commit band at zero changes, the three-column master detail '
            + 'with one seam gap between the panes, both nav columns stepping at the same derived '
            + 'pitch, and the leaf at one centred measure.',
        async drive(api) {
            await api.mount();
            await api.selectCategory('machine');
            await api.selectLeaf('machine-steam');
        },
    },
    {
        id: 'settings--search-narrowed',
        title: 'Settings · search narrowed',
        fixture: 'settings',
        mock: 'park',

        geometries: ['bench', 'desktop'],
        notes: 'The nav column filtered to categories and leaves alike, through the same nav row and '
            + 'the same naming call as browsing, so the frame shows there is no ordinal. Wide '
            + 'branch only: the search field lives in the nav column, which the collapse hides.',
        async drive(api) {
            await api.mount();
            await api.search('machine');
        },
    },
    {
        id: 'settings--collapsed-nav',
        title: 'Settings · nav collapsed',
        fixture: 'settings',
        mock: 'park',
        notes: 'The body below its threshold: two columns, the category list stood down, and the '
            + 'crumb row naming where you are. A container state, reached by narrowing the mount '
            + 'host, so it appears at every geometry.',
        async drive(api) {

            const { MASTER_DETAIL_COLLAPSE_PX } = await import('src/screens/settings-master-detail.js');
            api.stage().style.inlineSize = `${MASTER_DETAIL_COLLAPSE_PX - COLLAPSE_CLEARANCE_PX}px`;
            await api.mount();
            await api.selectCategory('machine');
        },
    },

    {
        id: 'settings--leaf-rows',
        title: 'Settings · a leaf of rows',
        fixture: 'settings',
        mock: 'park',
        notes: 'Three rows in one leaf, each with a heading, a range hint composed from the one '
            + 'limits table, and one stepper on the right: one padding, one gap and one control '
            + 'geometry across all three, because there is one row component and one renderer.',
        async drive(api) {
            await api.mount();
            await api.selectCategory('machine');
            await api.selectLeaf('machine-flush');
        },
    },
    {
        id: 'settings--dirty-save',
        title: 'Settings · unsaved changes',
        fixture: 'settings',
        mock: 'park',
        notes: 'Two staged machine fields, so the band reads Save (2) with Cancel beside it. A '
            + 'preference this skin stores would not appear here at all: those are written the '
            + 'moment they change and never make the band dirty.',
        async drive(api) {
            await api.mount();
            await api.selectCategory('machine');
            await api.selectLeaf('machine-flush');
            await api.change('machine-flush-temp', 88);
            await api.change('machine-flush-flow', 4);
        },
    },

    {
        id: 'settings--bespoke-gated',
        title: 'Settings · a gated leaf, fail-closed',
        fixture: 'settings',
        mock: 'park',
        notes: 'The gate photographed as an absence. The capability read fails as the mock makes it '
            + 'fail, so `entries` stays null, every gate reads unknown, and the Lighting leaf '
            + 'renders its heading and nothing else: no disabled control, no unavailable card.',
        async drive(api) {
            await api.mount();
            await api.capabilities(null);
            await api.selectCategory('accessories');
            await api.selectLeaf('accessories-lighting');
        },
    },
    {
        id: 'settings--bespoke-lighting',
        title: 'Settings · lighting, two columns',
        fixture: 'settings',
        mock: 'park',
        notes: 'The capability served: a two-column leaf over an intrinsic auto-fit rather than a '
            + 'breakpoint, the Zone and State banks, the four colours the machine is wearing, and '
            + 'the preset row. A press writes one at a time, latest wins, and no timer anywhere on '
            + 'the path.',
        async drive(api) {
            await api.mount();
            await api.capabilities(['ledStrip']);
            await api.selectCategory('accessories');
            await api.selectLeaf('accessories-lighting');
            await api.pickSwatch(1);
        },
    },
    {
        id: 'settings--bespoke-wizard',
        title: 'Settings · load-cell wizard, mid-walk',
        fixture: 'settings',
        mock: 'park',
        notes: 'The load-cell wizard as a thin client over the calibration route. Three step chips, '
            + 'one button that swaps label and action in place, and a fixed-height status slot '
            + 'carrying the live countdown, so the card is the same height in every state. It ships '
            + 'without a reset-to-default control.',
        async drive(api) {
            await api.mount();
            await api.capabilities(['scaleCalibration']);
            await api.selectCategory('calibration');
            await api.selectLeaf('calibration-load-cells');
            await api.calibrationState({
                step: 'zeroing', subState: 'averaging', secondsRemaining: 7,
                status: 'none', detectedCell: 'none',
            });
        },
    },
    {
        id: 'settings--bespoke-cards',
        title: 'Settings · skins, two up',
        fixture: 'settings',
        mock: 'park',
        notes: 'The two-up card grid over the served skin list with the active skin marked, and the '
            + 'leave-skin button above it as a plain registry row. One leaf, both mechanisms: the '
            + 'primitive renders the heading and the rows, the bespoke half adds only what this '
            + 'leaf needs.',
        async drive(api) {
            await api.mount();
            await api.selectCategory('display');
            await api.selectLeaf('display-skin');
        },
    },

    {
        id: 'settings--bespoke-tiles',
        title: 'Settings · language tiles, reflowed',
        fixture: 'settings',
        mock: 'park',
        notes: 'The tile grid in situ, on the only screen it ships on, as an intrinsic auto-fill '
            + 'rather than a breakpoint. Each tile is the endonym over the English name, and '
            + 'exactly one tile carries aria-pressed. The track is elastic; the column count is the '
            + 'same at both capture geometries because the leaf measure caps the pane. The list is '
            + 'handed in from the i18n manifest.',
        async drive(api) {
            await api.mount();
            await api.selectCategory('units-language');
            await api.selectLeaf('units-language-select-language');
            await api.languages([
                { code: 'en', endonym: 'English', english: 'English', partial: false },
                { code: 'fr', endonym: 'français', english: 'French', partial: false },
                { code: 'es', endonym: 'español', english: 'Spanish', partial: false },
                { code: 'de', endonym: 'Deutsch', english: 'German', partial: false },
                { code: 'ja', endonym: '日本語', english: 'Japanese', partial: true },
                { code: 'ko', endonym: '한국어', english: 'Korean', partial: true },
            ]);
        },
    },

    {
        id: 'editor--steps',
        title: 'Editor · steps',
        fixture: 'editor',
        mock: 'park',
        notes: 'The resting shell: two rows seamed by the header underline, the commit band at zero '
            + 'changes, and the tablist in the band\'s centre track at its own width, holding the '
            + 'step matrix. One grid over a sticky row-label rail and three step columns, ten '
            + 'content-derived rows and no literal track list. Three steps is the capture set '
            + 'rather than a posed width, so the columns fill at desktop and scroll horizontally at '
            + 'bench and floor. The middle step holds and the first carries an exit condition.',
        async drive(api) {
            await api.mount();
            await api.tab('steps');
        },
    },
    {
        id: 'editor--settings',
        title: 'Editor · settings, dirty',
        fixture: 'editor',
        mock: 'park',
        notes: 'The three-track panel with its field rows, and the band at a non-zero count so it '
            + 'reads Save (4) with Cancel beside it. At bench the panel is three up and at '
            + 'floor two, so the branches are one capture pair rather than a posed width.',
        async drive(api) {
            await api.mount();
            await api.tab('settings');
            await api.changeCount(4);
        },
    },
    {
        id: 'editor--review',
        title: 'Editor · review, scrolled',
        fixture: 'editor',
        mock: 'park',
        notes: 'Two prose columns, each its own scroll region with a visible scrollbar, rendered '
            + 'from the review step data. Scrolled on purpose, because a frame of a column '
            + 'parked mid-list is the picture of the element that actually scrolls. At bench two '
            + 'columns, at floor one. The preview chart sits above them in the panel\'s chart row.',
        async drive(api) {
            await api.mount();
            await api.tab('review');
            await api.scrollReview(160);
        },
    },

    {
        id: 'editor--preview-chart',
        title: 'Editor · review, preview chart',
        fixture: 'editor',
        mock: 'park',
        notes: 'The review tab at rest, which is the preview chart\'s own frame: a chart card in the '
            + 'review panel\'s chart row, plotting the same draft the matrix holds. Its channel '
            + 'colours are read from CSS at build time, so the two themes are a picture of the '
            + 'palette actually reaching the plot.',
        async drive(api) {
            await api.mount();
            await api.tab('review');
        },
    },
    {
        id: 'editor--numpad-over-cell',
        title: 'Editor · keypad over a matrix cell',
        fixture: 'editor',
        mock: 'park',
        notes: 'The keypad armed and open over the steps panel, opened by a real press on the '
            + 'temperature cell of step 1, so the hint in frame is the table\'s rather than one '
            + 'posed here. The page behind is inert and the shell owns the scrim.',
        async drive(api) {
            await api.mount();
            await api.tab('steps');
            await api.editable(true);
            await api.openNumpadFromCell('temperature', 0);
        },
    },
    {
        id: 'editor--exit-condition-dialog',
        title: 'Editor · exit condition dialog',
        fixture: 'editor',
        mock: 'park',
        notes: 'The exit dialog open on the step carrying an exit: the three-part sentence of type, '
            + 'direction and threshold as three composed controls, the number armed off the ranges '
            + 'door. What is in frame is the visible sentence and nothing else.',
        async drive(api) {
            await api.mount();
            await api.tab('steps');
            await api.editable(true);
            await api.openExitCondition({ index: 0 });
        },
    },
    {
        id: 'editor--lever-dialog',
        title: 'Editor · lever feel dialog',
        fixture: 'editor',
        mock: 'park',
        notes: 'The lever dialog over a lever step the fixture hands it directly, because the '
            + 'matrix\'s three steps are another cluster\'s capture set. Three feel presets, Spring '
            + 'and Give as steppers armed off the door, and the pressure floor in a locked box: '
            + 'shown, never editable here, because a feel preset never moves it. The box\'s label '
            + 'carries the whole accessible reading.',
        async drive(api) {
            await api.mount();
            await api.tab('steps');
            await api.editable(true);
            await api.openLever({ index: 1 });
        },
    },

    {
        id: 'history--flow',
        title: 'History · flow page, both shots picked',
        fixture: 'history',
        mock: 'park',
        notes: 'The History route, entered by clicking the Live foot band\'s affordance rather than '
            + 'by assigning a hash, so the Live screen is removed from the document rather than '
            + 'hidden behind it. Three rows: the band, the compare bar at its own height, and the '
            + 'page region. The pickers flex with a min-content floor and the tab bank gives, so '
            + 'both pickers render one width. The compare bar is shown because the flow page has a '
            + 'time axis. The region holds two chart cards on ratio tracks, each with a key, '
            + 'drawing two recorded shots of the same profile: A solid, B in the same hue, dashed '
            + 'and faded. At the floor geometry the region is below its threshold, so the page '
            + 'shows one plot and a selector.',
        async drive(api) {
            await api.mount();
            await api.open();
            await api.stage({

                shotOptions: [
                    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
                    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
                ],
                shotA: 'shot-1',
                shotB: 'shot-2',
                page: 'flow',
            });
            await api.stagePages({ page: 'flow' });
        },
    },

    {
        id: 'history--data',
        title: 'History · data page, two shots and the shot list',
        fixture: 'history',
        mock: 'park',
        notes: 'The data page: shot A by phase, shot B by phase, and the shot list, which is the '
            + 'page\'s one scroll region with a visible scrollbar and a three-row floor. All three '
            + 'tables are one component, and the two phase tables are the Live foot band\'s own '
            + 'columns and rows, imported rather than re-declared. Every cell sits inside a row '
            + 'that owns it. The compare bar is absent and the band is one row shorter for it, '
            + 'because a table has no time axis to slide. Every Out cell is a dash: no fixture '
            + 'carries an actual yield.',
        async drive(api) {
            await api.mount();
            await api.open();
            await api.stage({
                shotOptions: [
                    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
                    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
                ],
                shotA: 'shot-1',
                shotB: 'shot-2',
                page: 'data',
            });
            await api.stagePages({ page: 'data' });
        },
    },

    {
        id: 'history--power',
        title: 'History · power page, derived channels on ONE axis',
        fixture: 'history',
        mock: 'park',
        notes: 'The third History tab. The band carries three tabs and the tab bank\'s floor moved '
            + 'with them. The upper card is the derived-channel time chart: puck resistance and '
            + 'load impedance, both on the one left axis, drawn in log10. There is no power trace '
            + 'and no second axis. The traces have holes and the holes are the point: the server '
            + 'gates all three channels and omits the key below the gate, so a gap is the server '
            + 'being honest. The lower card is the pressure-flow trajectory with the time key '
            + 'beside it. A solid, B dashed and faded, on both charts. At the floor geometry the '
            + 'page shows one plot and a selector.',
        async drive(api) {
            await api.mount();
            await api.open();
            await api.stage({
                shotOptions: [
                    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
                    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
                ],
                shotA: 'shot-1',
                shotB: 'shot-2',
                page: 'power',
            });
            await api.stagePages({ page: 'power', offset: 1.5 });
        },
    },

    {
        id: 'history--power-trajectory',
        title: 'History · power page at the floor, the P–Q trajectory alone',
        fixture: 'history',
        mock: 'park',
        geometries: ['floor'],
        notes: 'The single-plot branch on the power page with the second plot chosen, which is the '
            + 'one frame that shows the pressure-flow trajectory at its full track. Pressure '
            + 'against flow: the only chart in the skin whose x axis is not time, which is why the '
            + 'colour is the time axis and the key beside it is that axis\'s legend, named rather '
            + 'than hidden. The correspondence marks are in this frame: round instants on A\'s '
            + 'clock, a filled dot on A\'s path with its label, a hollow ring on B\'s at the instant '
            + 'the offset says corresponds, and a faint dotted link between them. Declared into the '
            + 'floor only: at the bench both plots show and the row would duplicate the power '
            + 'frame.',
        async drive(api) {
            await api.mount();
            await api.open();
            await api.stage({
                shotOptions: [
                    { value: 'shot-1', label: '13 Aug 14:32 · Extractamundo' },
                    { value: 'shot-2', label: '13 Aug 09:07 · Lever Classic' },
                ],
                shotA: 'shot-1',
                shotB: 'shot-2',
                page: 'power',
            });
            await api.stagePages({ page: 'power', offset: 1.5 });
            await api.setPlot('history-power-page', 'trajectory');
        },
    },
];

const LEAF_STATES = allLeaves().map((leaf) => {
    const category = categoryOf(leaf.id);
    return {
        id: `settings--leaf-${leaf.id}`,
        title: `Settings · ${navName(category)} · ${navName(leaf)}`,
        fixture: 'settings',
        mock: 'park',
        geometries: ['desktop'],
        notes: 'The single-plot branch on the power page with the second plot chosen, which is the '
            + 'one frame that shows the pressure-flow trajectory at its full track. Pressure '
            + 'against flow: the only chart in the skin whose x axis is not time, which is why the '
            + 'colour is the time axis and the key beside it is that axis\'s legend, named rather '
            + 'than hidden. The correspondence marks are in this frame: round instants on A\'s '
            + 'clock, a filled dot on A\'s path with its label, a hollow ring on B\'s at the instant '
            + 'the offset says corresponds, and a faint dotted link between them. Declared into the '
            + 'floor only: at the bench both plots show and the row would duplicate the power '
            + 'frame.',
        async drive(api) {
            await api.mount();
            await api.capabilities([...SERVED_CAPABILITIES]);
            await api.selectCategory(category.id);
            await api.selectLeaf(leaf.id);
        },
    };
});

STATES.push(...LEAF_STATES);

const FIXTURES = {
    gates: {
        module: '../../test/fixtures/live-gates-fixture.js',
        api: () => globalThis.__live,
    },
    loop: {
        module: '../../test/fixtures/live-loop-fixture.js',
        api: () => globalThis.__loop,
    },
    sel: {
        module: '../../test/fixtures/selector-loop-fixture.js',
        api: () => globalThis.__sel,
    },
    settings: {
        module: '../../test/fixtures/settings-shell-fixture.js',
        api: () => globalThis.__settings,
    },
    editor: {
        module: '../../test/fixtures/editor-shell-fixture.js',
        api: () => globalThis.__editor,
    },

    history: {
        module: '../../test/fixtures/history-route-fixture.js',
        api: () => globalThis.__history,
    },
};

function deepAll(root = document, acc = []) {
    for (const el of root.querySelectorAll('*')) {
        acc.push(el);
        if (el.shadowRoot) deepAll(el.shadowRoot, acc);
    }
    return acc;
}

/** Wait for every element's update, the fonts, and two frames. */
async function settle(passes = 4) {
    for (let i = 0; i < passes; i += 1) {
        const waits = deepAll().filter((el) => el.updateComplete).map((el) => el.updateComplete);
        if (waits.length) await Promise.all(waits);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

let current = null;

/** Drive one state by id. Throws on an unknown id; sets `data-screens-settled` when done. */
async function show(id) {
    const state = STATES.find((s) => s.id === id);
    if (!state) throw new Error(`unknown screen state: ${id}`);

    delete document.body.dataset.screensSettled;
    delete document.body.dataset.screenFault;
    current = id;

    const fixture = FIXTURES[state.fixture];
    const module = await import(fixture.module);

    await module.ready;
    await state.drive(fixture.api());
    await settle();

    document.body.dataset.screenState = id;
    document.body.dataset.screensSettled = '1';
    return id;
}

function fault(error) {
    const message = `screen state '${params.get('state')}' did not drive: ${error?.message ?? error}`;
    const box = document.createElement('div');
    box.id = 'fault';
    box.textContent = message;
    document.body.append(box);
    document.body.dataset.screenFault = message;

    console.error(message, error);
}

const requested = params.get('state');
const ready = requested
    ? show(requested).catch(fault)
    : Promise.resolve(null);

window.__screens = {
    ready,
    states: () => STATES.map(({ id, title, fixture, mock, notes, geometries }) =>
        ({ id, title, fixture, mock, notes, geometries: geometries ?? null })),
    show,
    settle,
    current: () => current,
};

const ids = STATES.map((s) => s.id);
if (new Set(ids).size !== ids.length) {
    throw new Error(`duplicate screen state ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
}
