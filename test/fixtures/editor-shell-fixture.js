/**
 * editor-shell-fixture — the profile editor's shell, mounted and driven, for Gate B.
 *
 * Wave 5.5, the shell-and-panels cluster (`editor-skeleton`, `settings-panel`,
 * `review-panel`, `tablist-and-selection`).
 *
 * WHY THIS ONE IS SMALL, and it is not an omission: the editor SKELETON has no data
 * layer. It imports nothing from `src/data/` and nothing from `src/stores/`, opens no
 * socket, makes no request and reads no storage key — every one of those has its own row
 * in this wave. So there is no transport to wrap and no boot to build: the fixture
 * creates the element, mounts what a caller mounts, and lets Lit render. That is the
 * same reason `settings-shell-fixture.js` gives for its own size.
 *
 * IT DRIVES WHAT THE RENDER SUITE DRIVES. `test/render/editor-skeleton.render.test.mjs`
 * mounts `<editor-screen>` into a `#stage` and moves it with the same four levers this
 * exposes — the selected tab (through the tab bar, the way a user does it), the change
 * count, the review data, and the stage's inline size, which is the ONLY input the two
 * panels' container queries have. A capture posed by some other means would be a picture
 * of a state no test asserts.
 *
 * B2 — THIS FIXTURE STATES NO RANGE, and that is deliberate rather than incidental. "A
 * second hand-written ranges table anywhere — a leaf, a stepper default, a numpad hint, A
 * TEST FIXTURE THAT RESTATES MAXIMA — is a BLOCK." So the settings rows below compose
 * only the primitives that HAVE no min/max (#6 ui-text-field, #5 ui-switch), and the
 * review lines carry the bounds they were handed on the segment, the way
 * `reviewStepSpec` emits them. Nothing here declares a limit; the numbers that appear are
 * carried, not authored.
 *
 * IT STATES NONE BECAUSE IT ASKS THE DOOR, which is a stronger thing than intending to.
 * `RANGES` below is one `createEditorRanges` instance and `numSeg` reads every bound, step
 * and unit off it. The sentence above was once true of the matrix and FALSE of the review
 * — four `num` segments carried typed bounds, and 80/105/step 1 for temperature agreed
 * with no table in the tree (machine-limits declares brewTemp {70, 110, step 0.5}). A
 * fixture that claims B2 in its header and breaks it 160 lines down is worse than one
 * that never mentioned it, so the claim now has a mechanism under it.
 *
 * THE MOCK IS INDIFFERENT AND THE STATE ROWS SAY SO. The battery starts a mock per state
 * because Live and the selector need one; this screen would render identically against a
 * dead port. `park` is named because the Live states already start it, which keeps the
 * walk at two mock processes rather than three.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

await import('../../src/screens/editor-screen.js');
await import('../../src/screens/step-matrix.js');
await import('../../src/screens/editor-preview.js');
await import('../../src/screens/editor-overlays.js');
await import('../../src/components/ui-text-field.js');
await import('../../src/components/ui-switch.js');

const { createEditorRanges } = await import('../../src/lib/editor-ranges.js');
const { r2MachineLimits, machineClassFromServedSet } = await import('../../src/data/adapters-r.js');
const { adoptTypeRoles } = await import('../../src/components/type-roles.js');

/**
 * THE ONE LIGHT-DOM ROLE USER IN THE TREE, AND IT HAS TO ASK (DQ-2-C).
 *
 * `fieldRow` below builds its markup with `document.createElement`, so the two switch
 * rows' labels are LIGHT-DOM elements. `#13`'s roles travel as a `css` fragment adopted
 * into shadow roots, and no shadow sheet reaches the document — so `class="ui-caption"`
 * out here rendered nothing at all. Surface 2's census caught it: eight spans at
 * `--ui-text` instead of `--ui-muted`, with no measure cap, two of them 914px wide,
 * looking in the source exactly like every styled caption in the app.
 *
 * `adoptTypeRoles` is the door `type-roles.js` states for precisely this, and calling
 * it is the whole fix — one call, at import, before anything renders. Idempotent, and
 * scoped to this page: the screens walk loads one fixture per state in a fresh document.
 */
adoptTypeRoles(document);

/**
 * THE ONE RANGES DOOR, built once and shared by everything in this file that needs a
 * bound — the matrix's `ranges` property and the review's `num` segments alike.
 *
 * It is built from `r2MachineLimits()` — the R2 adapter, the only way any surface reaches
 * `machine-limits.js` — with a non-empty capability set, which is ReaPrime's own "this is
 * a Bengle" (`de1handler.dart` emits the seven inside one BengleInterface branch). The
 * frame therefore photographs the bounds the machine actually serves.
 *
 * ONE door, not one per consumer: two doors in one fixture is how the second table gets
 * back in, because the second one is always built "just for the review".
 *
 * THE CLASS COMES OFF THE SAME SERVED SET (27 August 2026). Since Ben's flow-ceiling lift
 * the AUTHORING half is per-machine too — a flow step's target and a pressure step's flow
 * limit reach 20 mL/s on a Bengle and 15 and 8 on a DE1 — so the door is told the class as
 * well as the table, and both are derived from the one capability array above rather than
 * asserted twice. Without it the frame would claim to photograph a Bengle while showing
 * the DE1's flow ceilings, which is the drift the sentence above promises it does not have.
 */
const SERVED_CAPABILITIES = [{ id: 'machine' }];
const RANGES = createEditorRanges({
    machineLimits: r2MachineLimits(SERVED_CAPABILITIES).value,
    machineClass: machineClassFromServedSet(SERVED_CAPABILITIES),
});

/**
 * The mount host, created on demand — the same id and the same reason as the selector's
 * and the settings shell's: `#stage` is what the render suite's stage carries, and a
 * fixture must not have two mount protocols. Created inside `#mount` rather than shipped
 * in the page, because an always-present sibling with a viewport block-size would push
 * every other capture down.
 */
function stage() {
    let host = document.getElementById('stage');
    if (!host) {
        host = document.createElement('div');
        host.id = 'stage';
        document.getElementById('mount').append(host);
    }
    host.style.inlineSize = host.style.inlineSize || '100%';
    host.style.blockSize = host.style.blockSize || '100dvh';
    return host;
}

/**
 * The editor's own field rows — a COMPOSITION, not a component (Part 10 §9: a component
 * not on the 57-item inventory is scope invention, and "settings field row / toggle row"
 * carry no inventory number). A label over a control, which is the anatomy
 * `--ui-editor-field-min-h` is derived from.
 *
 * ONE LABEL PER ROW, AND WHICH ONE DEPENDS ON THE CONTROL (parity surface 4, DQ-2-C).
 * The first version authored a `.ui-caption` span for every row AND handed the same
 * string to the control, so each of the six text rows painted its label TWICE — once
 * bright and unstyled, once muted by `ui-text-field`'s own `.label` — and stood 128px
 * tall against the 96 its own floor token describes. `--ui-editor-field-min-h` is
 * written from `#6 ui-text-field renders exactly that (ui-text-field.js .label … over a
 * --ui-control-h control)` (styles/tokens.css), so the component's label IS the row's
 * label line and a second one is not a caption, it is a duplicate.
 *
 * `#5 ui-switch` is the other case and it is the opposite: it is a leaf with no slot,
 * and its own header says "its label is a sibling in the light DOM … which is also what
 * lets aria-labelledby reach it". So the switch rows keep the span, and now WIRE it —
 * `control.label = …` was an expando on a component with no `label` property, so both
 * switches shipped with no accessible name at all, which is bug T15's own shape ("four
 * of twenty switches have no accessible name") reproduced in a fixture.
 */
const FIELDS = [
    { id: 'title', label: 'Profile name', kind: 'text', value: 'Gentle and sweet' },
    { id: 'author', label: 'Author', kind: 'text', value: 'Ben' },
    { id: 'beverage', label: 'Beverage', kind: 'text', value: 'espresso' },
    { id: 'tank', label: 'Tank temperature', kind: 'text', value: '20 °C' },
    { id: 'volume-count', label: 'Count volume from', kind: 'text', value: 'step 1' },
    { id: 'hidden', label: 'Hidden from the library', kind: 'switch', value: false },
    { id: 'default', label: 'Machine default', kind: 'switch', value: false },
    { id: 'notes', label: 'Notes', kind: 'text', value: 'Long bloom, then a slow decline.' },
];

function fieldRow(field) {
    const row = document.createElement('div');
    row.slot = 'settings';
    row.className = 'editor-field';
    row.dataset.field = field.id;
    row.style.display = 'grid';
    row.style.gap = 'var(--ui-space-2)';
    row.style.minInlineSize = '0';

    if (field.kind === 'switch') {
        const label = document.createElement('span');
        label.className = 'ui-caption';
        label.id = `label-${field.id}`;
        label.textContent = field.label;
        const control = document.createElement('ui-switch');
        control.setAttribute('aria-labelledby', label.id);
        control.checked = field.value;
        row.append(label, control);
    } else {
        const control = document.createElement('ui-text-field');
        control.label = field.label;
        control.value = field.value;
        row.append(control);
    }
    return row;
}

/**
 * THE STEPS THE MATRIX EDITS, in the shape ReaPrime serves — the same keys all 890
 * steps of the 147-record fixture carry. VALUES ONLY: not one minimum, maximum or
 * increment is written here, because "a test fixture that restates maxima is a second
 * ranges table and a BLOCK" (B2). Every bound in the captured frame arrives through
 * `createEditorRanges`, behind the R2 door, exactly as the screen will hand it over.
 *
 * THREE STEPS IS THE CAPTURE SET, AND DESKTOP IS THE FILL FRAME. At the step column
 * minimum (400px measured — #42's five-key rank plus the cell rhythm) three columns need
 * 160 + 3 x 400 + seams = 1363, so both Gate A geometries SCROLL: measured through this
 * fixture's own mount, the matrix is 1266 wide at BENCH and 975 at FLOOR against that
 * same 1363 scrollWidth, with tracks `160px 400px 400px 400px` at both. The fill regime
 * (1fr columns, 160 + 3 x 585.7, no overflow) is DESKTOP's, 1920 wide.
 *
 * NO STEP COUNT PUTS BENCH AND FLOOR ON OPPOSITE SIDES OF THE FLIP, so the two Gate A
 * frames are never the fill/scroll pair: at N=2 the flip is at a matrix clientWidth of
 * 962 (swept at 1px, 977 -> 976 on the stage, 962 fills / 961 scrolls) and BOTH Gate A
 * widths are above it, so both FILL; at N=3 both scroll. Gate B photographs one regime
 * at Gate A and the other at desktop, which is what `tools/screens/screens.js`'
 * `editor--steps` note and `_digests/matrix.json` both already say.
 *
 * The middle step HOLDS, which is the one cell that swaps #4 for #43 (a stepper for the
 * read-only locked value box), and the first carries an exit condition and a volume so
 * the band shows both an occupied sentence and its add slots.
 */
const STEPS = [
    {
        name: 'Preinfusion',
        pump: 'flow',
        transition: 'fast',
        exit: { type: 'pressure', condition: 'over', value: 4 },
        volume: 0,
        seconds: 25,
        weight: 0,
        temperature: 90,
        sensor: 'water',
        flow: 4,
        limiter: { value: 9, range: 0.6 },
    },
    {
        name: 'Hold',
        pump: 'pressure',
        transition: 'hold',
        exit: null,
        volume: 0,
        seconds: 10,
        weight: 0,
        temperature: 92,
        sensor: 'coffee',
        pressure: 6,
        limiter: { value: 8, range: 0.6 },
    },
    {
        name: 'Decline',
        pump: 'flow',
        transition: 'smooth',
        exit: null,
        volume: 0,
        seconds: 40,
        weight: 36,
        temperature: 92,
        sensor: 'coffee',
        flow: 2.2,
        limiter: { value: 9, range: 0.6 },
    },
];

/**
 * ONE `num` SEGMENT, in `reviewStepSpec`'s own shape — `['num', slot, value, step, unit,
 * min, max]` — with every bound, the increment and the unit READ OFF THE DOOR at
 * `RANGES.rangeFor(field)` and not one of them typed here.
 *
 * This is B2 at the only place this fixture could break it. The four slots were written
 * as literals (`…, 1, '°C', 80, 105`), and one of the three bands agreed with no table in
 * the tree: `machine-limits.js` declares brewTemp {70, 110, step 0.5}, so 80/105/step 1
 * was a FOURTH answer for the one field B2's own text cites. The others were a verbatim
 * transcription (pressure, seconds) and a restatement with a different increment (weight,
 * step 1 in `profile-modes.js`, typed 0.1 here) — all four are now the table's.
 *
 * `revFmt` renders integers as integers whatever the step is, so nothing painted moves:
 * the change is in the `data-min`/`data-max`/`data-step` the panel forwards, which is
 * exactly the value a slot would be upgraded into a control against.
 */
const numSeg = (slot, field, value, ctx = {}) => {
    const range = RANGES.rangeFor(field, ctx);
    return ['num', slot, value, range.step, range.unit, range.min, range.max];
};

/**
 * The review, in `reviewStepSpec`'s own shape. THE WORDING IS THE PORT'S and the bounds
 * ride on the segment — this fixture types neither a range nor a sentence of its own.
 */
const reviewBlock = (n) => ({
    id: `step-${n}`,
    heading: `Step ${n}`,
    lines: [
        [['t', 'Set '], ['tog', 'probe', 'coffee'], ['t', ' temperature to '],
            numSeg('temperature', 'stepTemperature', 92 + (n % 3))],
        [['t', 'Raise pressure to '],
            numSeg('pressure', 'stepTarget', 6 + (n % 4), { pump: 'pressure' }),
            ['t', ' over '], numSeg('seconds', 'stepSeconds', 8 + n)],
        [['t', 'Move on when the shot reaches '], numSeg('weight', 'stepWeight', 36)],
    ],
});

const REVIEW_COLUMNS = [
    { id: 'a', blocks: Array.from({ length: 6 }, (_, i) => reviewBlock(i + 1)) },
    { id: 'b', blocks: Array.from({ length: 6 }, (_, i) => reviewBlock(i + 7)) },
];

/**
 * A LEVER STEP, for the lever dialog's frame — and it is NOT in `STEPS` on purpose.
 *
 * `openLever()` takes the step it edits as an argument, so the dialog can be posed over
 * a lever pull without a fourth column appearing in the matrix. The matrix cluster's
 * `editor--steps` note calls three steps "the capture SET rather than a posed width" and
 * names what each column is for; adding a step to `STEPS` would silently re-pose another
 * cluster's frame to get this one.
 *
 * VALUES ONLY (B2) — a P0, a spring and a give, no bound of any kind. The dialog arms
 * every control from `RANGES` above, which is the same door the matrix and the review
 * segments read.
 */
const LEVER_STEP = {
    name: 'Lever pull',
    pump: 'lever',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 25,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    pressure: 8,
    leverSpring: 0.4,
    leverGive: 0.8,
    limiter: { value: 0, range: 0.6 },
};

/**
 * THE DRAFT the preview plots — the profile shape ReaPrime serves, wrapped around the
 * same `STEPS` the matrix holds, so the chart and the matrix are pictures of ONE profile
 * rather than two coincidentally similar ones. Read and never written here: <editor-preview>
 * takes a whole draft and derives; no surface in this file writes a step.
 */
const DRAFT = {
    version: 2,
    title: 'Gentle and sweet',
    notes: '',
    author: 'Ben',
    beverage_type: 'espresso',
    steps: STEPS,
    target_volume: 0,
    target_weight: 36,
    target_volume_count_start: 0,
    tank_temperature: 0,
};

let screen = null;
let matrix = null;
let preview = null;
let overlays = null;

const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await screen?.updateComplete;
    const root = screen?.shadowRoot;
    await root?.getElementById('band')?.updateComplete;
    await root?.getElementById('tabs')?.updateComplete;
    await root?.getElementById('settings-panel')?.updateComplete;
    await root?.getElementById('review-panel')?.updateComplete;
    await matrix?.updateComplete;
    await preview?.updateComplete;
    await overlays?.updateComplete;
    /* THE CARD AND THE BODIES, each awaited in its own right. A #9 card builds its plot
     * in its own update and a dialog body is a second element inside the shell — "a
     * dialog body or numpad must be ARMED before it is measured", and a frame taken
     * before either settled photographs an empty box that says nothing about the screen. */
    await preview?.renderRoot?.getElementById('card')?.updateComplete;
    for (const id of ['numpad', 'exit', 'lever']) {
        await overlays?.renderRoot?.querySelector(`#${id}`)?.updateComplete;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
};

/**
 * The matrix, mounted the way a screen mounts it: a LIGHT-DOM child in `slot="steps"`,
 * holding the draft's steps and the ONE ranges door — `RANGES` above, the same instance
 * the review's segments read their bounds off.
 */
function stepMatrix() {
    const el = document.createElement('step-matrix');
    el.slot = 'steps';
    el.ranges = RANGES;
    el.steps = STEPS;
    return el;
}

/**
 * THE EDITING SURFACES, mounted the way the screen mounts them: LIGHT-DOM children in
 * `slot="preview"` and `slot="overlays"`, which is the contract `editor-screen.js` states
 * (the preview forwards into the review panel's chart row; the overlay region takes no
 * track at all). Same arrangement `test/harness/editor.js` builds for the render suite,
 * so a battery frame and a measurement are of one screen and not two.
 *
 * WHY THEY WERE MISSING, recorded because the gap cost a whole cluster its pixels: this
 * fixture was written for the shell-and-panels cluster, whose four rows genuinely have no
 * preview and no overlay, and the editing cluster then shipped without adding them — so
 * every editing surface in the wave contributed ZERO frames to Gate B while three editor
 * states photographed the panels around them.
 *
 * ONE DOOR STILL (B2): `overlays.ranges` is `RANGES`, the same instance the matrix and
 * the review segments hold. Both dialogs and the keypad arm off it, so nothing in this
 * file states a bound and a posed keypad's hint is the table's.
 */
function editingSurfaces() {
    const chart = document.createElement('editor-preview');
    chart.slot = 'preview';
    chart.profile = DRAFT;

    const region = document.createElement('editor-overlays');
    region.slot = 'overlays';
    region.ranges = RANGES;
    region.steps = STEPS;
    return { chart, region };
}

const api = {
    /** Create the screen inside `#stage`. Idempotent: a second call reuses the first. */
    async mount() {
        const host = stage();
        if (!screen) {
            screen = document.createElement('editor-screen');
            screen.reviewColumns = REVIEW_COLUMNS;
            matrix = stepMatrix();
            screen.append(matrix);
            const surfaces = editingSurfaces();
            preview = surfaces.chart;
            overlays = surfaces.region;
            screen.append(preview, overlays);
            for (const field of FIELDS) screen.append(fieldRow(field));
            /* THE SOURCE IS THE SCREEN, set after both are in the tree — setting it
             * moves the listeners, which is <editor-overlays>'s own stated behaviour.
             * The states below drive the three PUBLIC ROUTES rather than a press,
             * because a posed capture must not depend on hit-testing a cell that a
             * narrower geometry may have scrolled out of frame. */
            overlays.source = screen;
            host.append(screen);
        }
        await settle();
        return screen;
    },

    /** The element, for a driver that wants to reach past this surface. */
    screen: () => screen,

    /** The matrix, for the same reason. */
    matrix: () => matrix,

    /** The preview chart and the overlay region, for the same reason again. */
    preview: () => preview,
    overlays: () => overlays,

    /**
     * THE THREE PUBLIC ROUTES, forwarded verbatim. Each one closes whatever else the
     * region had open before it opens — the arbitration is the element's, not this
     * fixture's, and a state that posed two open overlays would be photographing a
     * screen the code cannot produce.
     */
    async openNumpad(options = {}) {
        const opened = overlays.openNumpad(options);
        await settle();
        return opened;
    },

    async openExitCondition(options = {}) {
        const opened = overlays.openExitCondition(options);
        await settle();
        return opened;
    },

    /** The lever dialog, over `LEVER_STEP` — see its note for why it is not in `STEPS`. */
    async openLever(options = {}) {
        const opened = overlays.openLever({ step: LEVER_STEP, ...options });
        await settle();
        return opened;
    },

    /**
     * THE KEYPAD, OPENED BY A REAL PRESS on a matrix value cell — the whole route, not a
     * posed call: the matrix resolves the entry from `RANGES`, puts it on its own `edit`
     * event, and <editor-overlays> arms #53 with THAT entry. A direct `openNumpad({field})`
     * would arm the pad off a second lookup, and the frame would stop being evidence that
     * the cell and the keypad agree about their bound (B2).
     *
     * `.click()` on the element rather than a hit test at a coordinate: the matrix is its
     * own scrollport on both axes, so at the narrow geometry the cell a coordinate lands
     * on is a function of scroll position. The press is real either way — this is the
     * same element a finger reaches.
     */
    async openNumpadFromCell(row = 'temperature', index = 0) {
        const cell = matrix?.renderRoot?.querySelector(`[data-cell="${row}-${index}"]`);
        const control = cell?.querySelector('ui-stepper')?.renderRoot?.querySelector('#value');
        if (!control) {
            throw new Error(`editor fixture: no value control in the ${row} cell of step ${index + 1}`);
        }
        /* AN UNARMED MATRIX HAS NO ROUTE. With `editable` off this control is a div, the
         * press lands on nothing and the state photographs the panel behind an overlay
         * that never opened — silently, and settling normally. Refuse to pretend. */
        if (control.tagName !== 'BUTTON') {
            throw new Error('editor fixture: the value cell is not pressable — call editable(true) '
                + 'before opening the keypad from a cell, or this frame is just the steps panel');
        }
        control.click();
        await settle();
        const opened = overlays.renderRoot.querySelector('#numpad')?.open === true;
        if (!opened) throw new Error('editor fixture: the press did not open the keypad');
        return opened;
    },

    /**
     * ARM THE MATRIX FOR EDITING. `editable` is OFF by default and that is the matrix's
     * own stated default — "NO NUMPAD, NO DIALOG … a value cell promises nothing"
     * (step-matrix.js header) — so the shell cluster's `editor--steps` frame is right to
     * photograph the resting matrix and this does not touch it.
     *
     * The EDITING states need it on, and not for appearance: with `editable` off a value
     * cell renders as a div with no handler at all, so there is no route to press and the
     * keypad cannot be reached. The first version of this cluster's numpad state left it
     * off, drove "cleanly", settled, and wrote a frame BYTE-IDENTICAL to `editor--steps`
     * at all four theme x geometry sets — a state that existed and proved nothing, which
     * is E8's defect in a capture rather than in a layout engine. The state readback below
     * reports `numpad`, so the drive can now assert it drove what it meant to.
     */
    async editable(on = true) {
        if (matrix) matrix.editable = Boolean(on);
        await settle();
    },

    /** Scroll the matrix — it is its own scrollport, on both axes (§4.3). */
    async scrollMatrix(left = 0, top = 0) {
        if (matrix) {
            matrix.scrollLeft = left;
            matrix.scrollTop = top;
        }
        await settle();
    },

    /** The stage, so a state can narrow it and reach a collapsed branch. */
    stage,

    /**
     * Select a panel THROUGH THE TAB BAR, which is the one owner of which panel shows.
     * Setting the screen's `tab` attribute instead would photograph a state the tab bar
     * has not yet synced, and the panels would still be the previous tab's.
     */
    async tab(value) {
        const bar = screen.shadowRoot.getElementById('tabs');
        const index = ['steps', 'settings', 'review'].indexOf(value);
        const button = bar.shadowRoot?.getElementById('tablist')
            ?.shadowRoot?.getElementById(`item-${index}`);
        if (!button) throw new Error(`editor fixture: no tab button for '${value}'`);
        button.click();
        await settle();
        return screen.getAttribute('tab');
    },

    /** D11's count — the only thing this screen tells the band. */
    async changeCount(n) {
        screen.changeCount = n;
        await settle();
    },

    /** Re-point the stage: the only input the panels' container queries have. */
    async width(value) {
        stage().style.inlineSize = value;
        await settle();
    },

    /** Scroll a review column, so a capture can show the region is a region. */
    async scrollReview(top) {
        const column = screen.shadowRoot.getElementById('review-panel')
            ?.shadowRoot?.querySelector('.column');
        if (column) column.scrollTop = top;
        await settle();
    },

    /** A readback, so a driver can assert it drove what it meant to. */
    state() {
        const root = screen.shadowRoot;
        const columns = (id) => getComputedStyle(
            root.getElementById(id).shadowRoot.getElementById('panel'),
        ).gridTemplateColumns.trim().split(/\s+/).length;
        const matrixColumns = matrix
            ? getComputedStyle(matrix).gridTemplateColumns.trim().split(/\s+/).length
            : 0;
        /* THE OVERLAY CENSUS, read off the composed tree the same way the render suite
         * reads it: a native <dialog> per overlay, and how many of them are actually
         * open. `open` is the number a state asserts — "exactly one" is the arbitration's
         * claim, and a frame taken with zero open is a frame of the screen behind it. */
        const flag = (id) => overlays?.renderRoot?.querySelector(id)?.open === true;
        const card = preview?.renderRoot?.getElementById('card');
        return {
            tab: screen.getAttribute('tab'),
            changeCount: screen.changeCount,
            settingsColumns: columns('settings-panel'),
            reviewColumns: columns('review-panel'),
            fields: [...screen.querySelectorAll('.editor-field')].length,
            steps: matrix ? matrix.steps.length : 0,
            matrixColumns,
            matrixScrollsX: matrix ? matrix.scrollWidth > matrix.clientWidth : false,
            numpad: flag('#numpad'),
            exit: flag('#exit'),
            lever: flag('#lever'),
            openOverlays: ['#numpad', '#exit', '#lever'].filter(flag).length,
            /* The chart's own instruments (#9 keeps them), so "the preview is a plot"
             * is a readback and not a look at the picture. */
            chartBuilds: card ? card.buildCount : 0,
            chartHasPlot: Boolean(card?.plotHandle),
        };
    },
};

globalThis.__editor = api;
ready = Promise.resolve(true);

}
