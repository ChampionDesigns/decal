/**
 * One screen state per navigation, full viewport, for Gate B.
 */

import { allLeaves, categoryOf, navName } from 'src/lib/settings-nav.js';

/* AND THE CAPABILITY LIST, for the same reason and by the same rule: read off the tree,
 * never written down here. See A FULLY-CAPABLE MACHINE in the derived block below. */
import { SERVED_CAPABILITIES } from 'src/stores/capabilities-store.js';

import { installFit } from 'src/lib/app-fit.js';

installFit();

const params = new URLSearchParams(location.search);
const mockPort = params.get('mock') ?? '8080';
const mockBase = `127.0.0.1:${mockPort}`;

document.documentElement.setAttribute('data-theme', params.get('theme') ?? 'dark');

/** The arm-time refusal, exactly as the contract row spells the body (B9). */
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

/**
 * The selector's mount host, created on demand — see "WHERE EACH ONE MOUNTS" above.
 * Sized by `#stage` in the page's own stylesheet, so the default is the full viewport.
 */
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

/** The first record of the recorded listing — never an id typed into this file. */
async function selectFirst(api) {
    const [id] = api.ids({ limit: 1 });
    await api.select(id);
    return id;
}

/** The first readable `/ws/v1/devices` frame this mock serves, verbatim. */
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
        notes: 'A connected machine costs the screen no rows at all — the connection '
            + 'surface collapses (display: none), which is the one state a WRONG answer hides. '
            + 'The composition reads are AWAITED here rather than left to settle: since '
            + "Ben's 22 Aug ruling this state photographs the favourite slots' profile "
            + 'names and the last stored shot in the chart and the band, and a photograph '
            + 'of a read that had not landed yet is a photograph of the defect.',
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
        notes: 'B8\'s park. ReaPrime is holding a selection session open and suppressing '
            + 'recovery; the dialog opens itself, once per park.',
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
        notes: 'B9. A 400 carrying the server\'s own sentence, in the alert banner — not '
            + 'a sentence this skin wrote about a failure it did not diagnose.',
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
        notes: 'The real app boot, six sockets open and SILENT — which is what an idle '
            + 'machine\'s snapshot channel is. No recorded frame carries state `idle`, so '
            + 'the fixture constructs the one snapshot and sends it down the real road.',
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
        notes: 'The recorded shot playing at the render budget, stopped for the shot at '
            + '~120 in-shot samples: the chart drawn, the gauges live, the STOP box armed.',
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
        notes: 'The buffer closed on the mock\'s `finished` frame and frozen — the state '
            + 'the foot band\'s totals are read in.',
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
        notes: 'The resting state: the recorded 147-record listing filtered by rule 1 into '
            + 'a real listbox, nothing selected, the detail pane in its empty state.',
        async drive(api) {
            await selectorAtRest(api);
        },
    },
    {
        id: 'selector--search-narrowed',
        title: 'Selector · search narrowed',
        fixture: 'sel',
        mock: 'shot',
        notes: 'A family prefix that is real in the recorded listing, narrowing it to a '
            + 'handful of rows — the state where the list is short and the pane is not.',
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
        notes: 'The select half of the loop: title, the stat tiles, the notes, and the '
            + 'preview curves drawn in the chart card on its UNPADDED host (chart-C3).',
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
        notes: 'The five-slot rail, seeded by rule 4, with one slot picked — the route '
            + 'into a profile that does not go through the list at all.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
            await api.pickFavourite(0);
        },
    },
    {
        id: 'selector--confirm-open',
        title: 'Selector · confirm before arming',
        fixture: 'sel',
        mock: 'shot',
        notes: 'B9 asks at the point of picking: the confirm dialog over the screen, with '
            + 'the primary that is not Cancel painted twice (P8).',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
            await api.openConfirm();
        },
    },
    {
        id: 'selector--refusal',
        title: 'Selector · profile refused',
        fixture: 'sel',
        mock: 'shot',
        notes: 'B9\'s typed 400 in the detail pane, carrying the server\'s own sentence. '
            + 'The pane\'s give order in this state is a recorded question, not a settled '
            + 'layout (wave 5.3 DEFERRED_QUESTIONS_core-loop.md §11) — this frame is what '
            + 'that question is about, which is the reason it is photographed.',
        async drive(api) {
            await selectorAtRest(api);
            await selectFirst(api);
            api.answer('POST', '/api/v1/machine/profile', REFUSED.status, REFUSED.problem);
            await api.openConfirm();
            await api.confirmLoad({ pressDialog: true });
        },
    },
    {
        id: 'selector--collapsed-split',
        title: 'Selector · split collapsed',
        fixture: 'sel',
        mock: 'shot',
        notes: 'The split below its threshold: one column, list over detail, with a '
            + 'profile selected so BOTH stacked panes carry their content. A CONTAINER '
            + 'state, not a viewport one — it is reached by narrowing the mount host, so '
            + 'it appears at every geometry rather than at the smallest.',
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
        notes: 'The resting shell: the #31 band in commit mode at zero changes (D11 renders '
            + '"Close"), the three-column master detail with ONE seam gap between the panes '
            + '(C5, replacing T19\'s two greys), both nav columns stepping at the same '
            + 'derived --ui-nav-row pitch (C4, killing T2\'s 89-vs-93), and the leaf at one '
            + 'centred measure (T1/T21).',
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
        notes: 'The nav column filtered to categories and leaves alike, presented through '
            + 'the SAME nav row and the SAME naming call as browsing — T12 is "Machine" '
            + 'becoming "1. Machine" the moment you search, so this frame is the one that '
            + 'shows there is no ordinal. WIDE BRANCH ONLY: the search field lives in the '
            + 'nav column, which the 1100px collapse hides, so below it this state has no '
            + 'surface to show (see `geometries`).',
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
        notes: 'The body below its threshold: two columns, the category list stood down, and '
            + 'the crumb row naming where you are. A CONTAINER state, not a viewport one — '
            + 'reached by narrowing the mount host, so it appears at every geometry rather '
            + 'than only at the smallest (where it also fires, this body collapsing at 1100 '
            + 'against a 1000px floor).',
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
        notes: 'The one-primitive claim, photographed: three #29 rows in one leaf, each '
            + 'with a heading, a range hint composed from the ONE limits table through the '
            + 'R2 door, and one stepper on the right — one padding, one gap and one '
            + 'control geometry across all three, because there is one row component and '
            + 'one renderer (T13 / T14 / T17 / T20).',
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
        notes: 'D11 with something behind it: two staged MACHINE fields, so the band reads '
            + '"Save (2)" with Cancel beside it — the wording is #31\'s and the count is '
            + 'this screen\'s, which is the whole of the decision. A preference this skin '
            + 'stores would not appear here at all: those are written the moment they '
            + 'change and never make the band dirty.',
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
        notes: 'A3 photographed as an ABSENCE. The capability read fails exactly as the '
            + 'mock makes it fail (/machine/capabilities answers 503 by design, no '
            + 'fixture), so `entries` stays null, every gate reads UNKNOWN and the '
            + 'Lighting leaf renders its heading and NOTHING ELSE — no disabled control, '
            + 'no "unavailable" card. Fail-closed covers UNKNOWN as well as ABSENT, and '
            + 'this is the frame that shows it.',
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
        notes: 'D7 with the capability served: the two-column leaf (an intrinsic auto-fit '
            + 'over a track minimum, not a breakpoint), the Zone and State banks, the four '
            + 'current colours the machine is wearing, and #52\'s preset row. A press '
            + 'writes through the decided pattern — pendingColour, one write in flight, '
            + 'latest-wins, and no timer anywhere on the path.',
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
        notes: 'D9 rebuilt as a thin client over PUT /machine/scaleCalibration. Three step '
            + 'chips (four became three: the machine\'s single latch plus auto-detection '
            + 'replaced Slate\'s left-then-right), the ONE button that swaps label and '
            + 'action in place, and the fixed-height status slot carrying the live '
            + 'countdown — the card is the same height in every state, which is the one '
            + 'layout rule that survived loadcell-cal.js. The wizard takes the same '
            + 'measure as every other leaf (T1). It ships WITHOUT a reset-to-default '
            + 'control (F3/Q1), and that hole is recorded rather than drawn.',
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
        notes: 'The 2-up #51 card grid over the served skin list, with the active skin '
            + 'marked — and D8\'s "Leave this skin" button above it as a plain #29 row '
            + 'from the registry. One leaf, both mechanisms: the primitive renders the '
            + 'heading and the rows for all thirty-seven leaves, and the bespoke half adds '
            + 'only what §4.4 says this one needs. Both sit in the pane\'s one measure box.',
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
        notes: '#40 ui-tile-grid in situ — the only screen it ships on, and §4.4\'s "only '
            + 'genuinely fluid layout in the old app" rebuilt as an intrinsic auto-fill '
            + 'over `minmax(min(280px, 100%), 1fr)` rather than a breakpoint. Each tile is '
            + 'the endonym over the English name with "· partial" where the catalogue is, '
            + 'and exactly one tile carries aria-pressed. The TRACK is elastic and the two '
            + 'frames differ in it (bench 2 x 362px, floor 2 x 316px); the column COUNT is '
            + 'the same at both, because the leaf measure caps the pane below three tracks '
            + 'at every capture geometry — that reflow is the render suite\'s claim, not '
            + 'this photograph\'s. The list is handed in the way the app hands it in, from '
            + 'the i18n manifest: six here so the grid has something to place, while v1 '
            + 'itself ships English only (D2).',
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
        notes: 'The resting shell — two rows (--ui-band-h then the rest, seamed by the '
            + 'header underline), #31 in commit mode at zero changes (D11 renders "Close" '
            + 'alone), the #32 tablist in the band\'s CENTRE track at its own width — '
            + 'now holding <step-matrix>: ONE grid over the sticky row-label rail and '
            + 'three step columns, ten content-derived rows and no literal track list '
            + '(E1). Three steps is the capture SET rather than a posed width — the '
            + 'column minimum is the widest control in it (#42\'s five-key rank, 376 '
            + 'plus the cell rhythm = 400 measured), so three columns FILL at desktop '
            + '(1fr) and scroll horizontally at bench and floor, with the rail sticky '
            + 'at the scrollport edge. The middle step HOLDS, which is the cell that '
            + 'swaps #4 for #43, and the first carries an exit condition so the #41 '
            + 'band shows a sentence and its add slots. Compact density (C3): the caps '
            + 'are 64 and the rhythm one step tighter, and no control height moved.',
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
        notes: 'The 1fr 1fr 2fr panel with its field rows, and D11 at a non-zero count so '
            + 'the band reads "Save (4)" with Cancel beside it — the wording is #31\'s and '
            + 'the count is all this screen supplies. At bench the panel is 3-up (1281 > '
            + '1164) and at floor 2-up (1000), so the two branches are one capture pair '
            + 'rather than a posed width.',
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
        notes: 'Two prose columns, each its own scroll region with a visible scrollbar '
            + '(T16 is a live scrollbar hidden), rendered from profile-modes.js '
            + 'reviewStepSpec output AS DATA. Scrolled on purpose: E6 is a scroll restore '
            + 'written to a NON-scrolling element, and a frame of a column parked '
            + 'mid-list is the picture of the element that actually scrolls. At bench two '
            + 'columns (1281 > 1146), at floor one. THE PREVIEW CHART IS NOW ABOVE THEM: '
            + 'the fixture mounts <editor-preview> into this panel\'s chart row (fix-3), '
            + 'so this frame gained a plot it did not have and the columns start lower. '
            + 'That is the panel the app ships — the chart row was an empty auto row of '
            + 'zero height only because nothing was ever mounted into it.',
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
        notes: 'The review tab AT REST, which is the preview chart\'s own frame: a #9 '
            + 'ui-chart-card in the review panel\'s chart row, plotting the SAME draft the '
            + 'matrix holds (row chart-preview). The card is the editor\'s only chart '
            + '(chart-C6) and its channel colours are read from CSS at build time '
            + '(chart-C5), so the two themes are the picture of the palette actually '
            + 'reaching the plot rather than of six baked literals. Distinct from '
            + 'editor--review, which scrolls a prose COLUMN to show that the column is the '
            + 'element that scrolls (E6); this one is unscrolled so the plot is whole.',
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
        notes: '#53 ARMED and open over the steps panel, opened by a REAL PRESS on the '
            + 'temperature cell of step 1 — the matrix resolves the entry from the one '
            + 'ranges door and the keypad is armed with it, so the hint in frame is the '
            + 'TABLE\'S and not a band posed here (B2). Row numpad-flows. The page behind '
            + 'is inert and the shell owns the scrim; an unarmed #53 renders its '
            + 'unavailable panel, so a frame is only worth taking once the pad is armed.',
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
        notes: 'The exit dialog open on step 1, which is the step carrying an exit — the '
            + 'three-part sentence (type, direction, threshold) as three composed controls: '
            + '#3 for the channel, #3 for the direction, #4 for the number armed off the '
            + 'door. Row editor-dialogs. NOT the hidden control set (C8): what is in frame '
            + 'is the visible sentence and nothing else.',
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
        notes: 'The lever dialog over a LEVER STEP the fixture hands it directly — the '
            + 'matrix\'s three steps are another cluster\'s capture set and a fourth column '
            + 'would re-pose it. Three feel presets (#3), Spring and Give as #4 steppers '
            + 'armed off the door, and P0 in a #43 locked box: shown, never editable here, '
            + 'because a feel preset moves spring and give and NEVER the barista\'s P0. '
            + 'The box\'s label carries the whole accessible reading, so what is in frame '
            + 'and what is announced are the same value (fix-3, c-editing-surfaces-5).',
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
        notes: 'The History ROUTE, entered by clicking the Live foot band\'s affordance '
            + 'rather than by assigning a hash — the Live screen is REMOVED from the '
            + 'document, not hidden behind it, which is the whole of overlay -> route '
            + 'and why there is no aria-modal anywhere in the frame (H9). Three rows: '
            + 'the band at --ui-band-h, the compare bar at its own height (auto), and '
            + 'the page region. THE BAND IS H3\'s FIX IN FRAME: pickers flex 1 1 0 with '
            + 'a min-content floor and the tab bank flex 0 1 auto, so the bank is what '
            + 'gives and both pickers render ONE width (T9 — Slate shows 250 and '
            + '213.578 on this same screen). Each picker is #45\'s pick disc beside #7, '
            + 'and the disc\'s selected paint is the four dials and nothing else. The '
            + 'compare bar (#44) is SHOWN because the flow page has a time axis; on the '
            + 'data page it derives itself away and the row measures zero. AMENDED IN '
            + 'PLACE by the pages cluster, exactly as editor--steps was: the region now '
            + 'holds the real flow page, two #9 chart cards on RATIO TRACKS (1.2fr / 1fr, '
            + 'no px anywhere) each with a #10 key, drawing two REAL recorded shots of '
            + 'the same profile — A solid, B in the same hue, dashed and faded, which is '
            + 'chart-C7\'s cap/dash/opacity applied to every series rather than inside one '
            + 'plugin. AT THE 1000x600 FLOOR THIS FRAME SHOWS H1\'s OTHER BRANCH: the '
            + 'region is 404.75 tall against a 488 threshold, so the page honestly shows '
            + 'ONE plot and a selector rather than two unusable strips. The two geometries '
            + 'therefore photograph two different layouts, and that is the row\'s point.',
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
        notes: 'The DATA page: §4.5\'s auto / auto / minmax(0,1fr) — shot A by phase, '
            + 'shot B by phase, and the shot list, which is the page\'s one scroll '
            + 'region with a VISIBLE scrollbar and a floor of --ui-history-list-min-h '
            + '(3 x --ui-list-row, an M18 proposal carried as a token). All three tables '
            + 'are ONE component, #34, and the two phase tables are Live\'s own '
            + 'PHASE_COLUMNS and phaseRows() — the same columns array the Live foot band '
            + 'renders, imported rather than re-declared (H5: Slate has three '
            + 'implementations and a stranded fourth column template). H4 IS IN THE '
            + 'FRAME: every cell sits inside a role="row" that owns it, where '
            + '#hv-data-grid-{a,b} is a role="grid" with 28 children and no rows at all. '
            + 'THE COMPARE BAR IS ABSENT AND THE BAND IS ONE ROW SHORTER FOR IT — a table '
            + 'has no time axis to slide, so the bar derives itself away rather than '
            + 'being shown dead. Every Out cell is a DASH (B5/Q17): no fixture carries an '
            + 'actualYield, and no shot is downloaded to find one.',
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
        notes: 'THE THIRD History tab, and the surface Ben reversed D1 for. The band '
            + 'now carries THREE tabs and the tab bank\'s floor moved with them '
            + '(3 x --ui-hit-min + 2 gaps, history-header.js). The upper card is the '
            + 'derived-channel time chart: puck resistance R and load impedance Z, BOTH ON '
            + 'THE ONE LEFT AXIS, drawn in log10. THERE IS NO POWER TRACE AND NO SECOND '
            + 'AXIS — Ben, 25 August 2026: "Power will be on the Pressure/Flow chart, not '
            + 'on the resistance / impedance chart. No second axis on these charts." An '
            + 'earlier version of this caption promised a visible right-hand axis at '
            + '0-15 W from POWER_AXIS_MAX; that constant was deleted with the axis '
            + '(commit 9fcc1d2) and the caption outlived the screen it described, which is '
            + 'this fork\'s own defect class. ReaPrime still DERIVES W — only the charting '
            + 'moved. THE TRACES HAVE HOLES AND THE HOLES ARE '
            + 'THE POINT: ReaPrime gates all three channels at 0.3 mL/s and 0.3 bar and '
            + 'OMITS the key below it, so a gap is the server being honest — 34 readings '
            + 'of 50 samples on shot A. The lower card is the P-Q trajectory with the #11 '
            + 'TIME KEY beside it, which is where --ui-timekey-w and --ui-timekey-strip-w '
            + 'get their first consumers in this tree. A/B throughout: A solid, B dashed '
            + 'and faded at 0.72, on both charts. AT THE 1000x600 FLOOR THIS FRAME SHOWS '
            + 'H1\'s OTHER BRANCH — the region is 404.75 against a 436 threshold, so the '
            + 'page honestly shows ONE plot and a selector.',
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
        notes: 'H1\'s single-plot branch on the power page, with the SECOND plot chosen — '
            + 'the one frame in the set that shows the P-Q trajectory at its full track. '
            + 'Pressure against flow: the only chart in the skin whose x axis is not time, '
            + 'which is why the colour IS the time axis and the #11 key beside it is that '
            + 'axis\'s legend (chart-C14: Slate\'s gradient key was aria-hidden while '
            + 'being the trajectory\'s only axis legend — here it is a group with a name). '
            + 'Q16\'s CORRESPONDENCE MARKS ARE IN THIS FRAME and this is the first time '
            + 'they have been on a screen in either tree: round instants on A\'s clock, a '
            + 'filled dot on A\'s path with its "3s" label, a hollow ring on B\'s at the '
            + 'instant the 1.5 s offset says corresponds, and a faint dotted link between '
            + 'them. Slide the alignment and the B ends walk along B\'s path — "when A was '
            + '12 seconds in, where was B?". THE LOOK IS A PINNED DEFERRED QUESTION for '
            + 'Ben: he decides it, this frame is what there is to decide about. DECLARED '
            + 'INTO THE FLOOR ONLY: at the bench both plots show, so this row would be '
            + 'byte-identical to history--power and a duplicate image looks like coverage.',
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
        notes: 'One settings LEAF, photographed in its own right rather than through an '
            + 'archetype — the pairing state for the old app\'s capture of the same leaf. '
            + 'Derived from settings-nav.js: this row exists because the leaf does, and it '
            + 'is desktop-only because 1920x1200 is the geometry the old app was captured '
            + 'at and therefore the only one where a pair can be made. The capability array '
            + 'is SERVED (all seven of SERVED_CAPABILITIES) so a gated leaf photographs its '
            + 'content rather than its fail-closed blank; settings--bespoke-gated is the row '
            + 'that photographs the refusal.',
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

async function show(id) {
    const state = STATES.find((s) => s.id === id);
    if (!state) throw new Error(`unknown screen state: ${id}`);

    delete document.body.dataset.screensSettled;
    delete document.body.dataset.screenFault;
    current = id;

    const fixture = FIXTURES[state.fixture];
    const module = await import(fixture.module);
    /* Both fixtures do their work at import time and publish a global; `ready` is the
     * promise that says the module finished, and neither resolves to anything else. */
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

// Every state has a distinct id or the battery would overwrite its own captures.
const ids = STATES.map((s) => s.id);
if (new Set(ids).size !== ids.length) {
    throw new Error(`duplicate screen state ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
}
