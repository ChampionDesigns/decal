/**
 * screens.js — one screen state per navigation, full viewport, for Gate B.
 *
 * THE GAP THIS CLOSES. `tools/capture_battery.py --subjects app` short-circuited with
 * "Decal has no screens yet (Waves 2–4), so this path photographs nothing" and wrote a
 * manifest that said the app screens were unwalked. That was true until wave 5.1 built
 * one. Left as it was, the battery would abort-check the mock, photograph nothing, and
 * write a manifest claiming the screen this wave built is unverified — while the states
 * were captured BY HAND through the Gate A harness, which is not reproducible by anyone
 * who was not in the room (wave 5.1, cross-3).
 *
 * AND THE SAME GAP AGAIN, ONE WAVE LATER — WHICH IS WHY THE RULE IS WRITTEN DOWN HERE.
 * Wave 5.3 built the SECOND screen, the profile selector, and this registry still carried
 * six `live--*` rows and nothing else: `--subjects app` photographed the Live screen at
 * every geometry and not one frame of the screen that wave built, and the only images of
 * it were a reviewer's stopgap script parked under `realine-run/waves/5.3/` — the same
 * not-reproducible hand capture, one directory along (wave 5.3, cross-3). THE RULE: a
 * wave that builds or changes a screen adds its rows HERE, in that wave, driving the
 * fixture its own render suite drives. A screen with no row is a screen nobody downstream
 * can photograph, and the manifest will not say so.
 *
 * THE COROLLARY, AND IT COST TWO FALSE PHOTOGRAPHS (wave 5.4, cross-3). The law above is
 * about states that are MISSING. The same law is broken from the other side by a state
 * that is captured at a geometry where it cannot exist: `settings--search-narrowed` drove
 * a search whose field the 1100px collapse had already hidden, and wrote a floor PNG
 * byte-identical to `settings--browse` in both themes. A reviewer diffing the set sees two
 * named states and two images and has no way to learn that one of them photographs
 * nothing. So a state MAY declare `geometries: [...]` — the geometry names from
 * `test/harness/geometry.js` at which it is meaningful — and the battery skips it
 * elsewhere and lists the skip under the manifest's `unverified`, which is where states
 * that are not walked already go. Silence is not coverage; a duplicate image is worse than
 * silence, because it looks like coverage. Omit the field and the state is captured
 * everywhere, which stays the default.
 *
 * ===========================================================================
 * HOW MANY ROWS — THE COUNT, AND WHY IT IS WRITTEN DOWN HERE
 * ===========================================================================
 *
 * A wave reports what it ADDED, and the next wave takes that report's total as its base.
 * Wave 5.4 reported "13 -> 15" for the leaves cluster and "15 -> 19" for the bespoke one,
 * and both were right about their own DELTA and wrong about their BASE: the leaves
 * cluster took 13 (wave 5.3's total) after the skeleton cluster had already added three,
 * and the bespoke cluster then chained off the leaves cluster's wrong 15. One stale base,
 * measured twice, and the fourth wave running to inherit a wrong number (wave 5.4,
 * cross-8). The registry itself was never wrong — every delta landed and every row drives
 * its own suite's fixture — so the remedy is not a code change but a NUMBER WITH A
 * PROVENANCE, kept beside the rows it counts and pinned by measurement in
 * `test/tools-port.test.mjs` so prose here cannot drift from the array below.
 *
 *   REGISTRY STATE COUNT: 34
 *
 *     13  wave 5.3 left it here          6 `live--` + 7 `selector--`
 *     16  wave 5.4 skeleton      (+3)    --browse, --search-narrowed, --collapsed-nav
 *     18  wave 5.4 leaves        (+2)    --leaf-rows, --dirty-save
 *     22  wave 5.4 bespoke       (+4)    --bespoke-gated, --lighting, --wizard, --cards
 *     23  wave 5.4 fix (cross-5) (+1)    --bespoke-tiles
 *     26  wave 5.5 shell         (+3)    editor--steps, editor--settings, editor--review
 *     26  wave 5.5 matrix        (+0)    editor--steps FILLED, no state added or removed
 *     30  wave 5.5 editing (fix-3) (+4)  editor--preview-chart, editor--numpad-over-cell,
 *                                        editor--exit-condition-dialog, editor--lever-dialog
 *     31  wave 5.6 shell         (+1)    history--flow
 *     32  wave 5.6 pages         (+1)    history--data; history--flow FILLED, +0
 *     34  fix run 6 power page   (+2)    history--power, history--power-trajectory
 *
 *   PER SCREEN, at 34:  6 `live--` + 7 `selector--` + 10 `settings--` + 7 `editor--`
 *                       + 4 `history--`
 *
 * HISTORY WENT BOTH WAYS, AND THAT WAS THE PLAN. The shell cluster registered
 * `history--flow` with an empty page region and wrote the rule for whoever filled it: amend
 * in place, as the step matrix did to `editor--steps` (the +0 line above), and add a row
 * only for a genuinely different STATE. The pages cluster did exactly one of each —
 * `history--flow` gained its two chart cards and photographs the same state properly (+0),
 * and `history--data` is a row because the compare bar is ABSENT there and the list
 * SCROLLS, which no amendment to the flow frame could show.
 *
 * CAPTURE FILES ARE A DIFFERENT NUMBER and the two get conflated. States x themes x
 * geometries is the ceiling, not the count: `settings--search-narrowed` declares itself
 * out of the floor (above), so at `--themes dark,light --geometry bench,floor` the ten
 * `settings--` states write 10 x 2 x 2 - 2 = 38 PNGs, not 40. A wave that reports one
 * number must say which one it is.
 *
 * ===========================================================================
 * WHY THE STATES ARE DRIVEN BY THE SUITES' FIXTURES
 * ===========================================================================
 *
 * A screen state is not markup. `pendingAmbiguity` is a server park, `mid-shot` is 220
 * frames over six sockets, and a refusal is a 400 with the server's own sentence in it. A
 * registry of HTML strings — which is what the component gallery is, correctly, for
 * components — cannot express any of them, and a second driver written here would be a
 * second thing to drift from the one the suites assert against.
 *
 * So each state names a FIXTURE and drives it:
 *
 *   `gates`  test/fixtures/live-gates-fixture.js — the real `<live-screen>`, the real
 *            stores, a scripted HTTP transport, and devices frames pushed through the
 *            real reader. The frames are read HERE off the mock's own `/ws/v1/devices`
 *            socket rather than written by hand, exactly as the node side of
 *            `test/live-connection-gates.test.mjs` reads them.
 *   `loop`   test/fixtures/live-loop-fixture.js — the real `createAppBoot`, the real
 *            `<app-root>`, six real WebSockets to the mock. The shot that plays is the
 *            recorded one.
 *   `sel`    test/fixtures/selector-loop-fixture.js — the real `createAppBoot`, the real
 *            `createReaTransport` (so the conditional listing read is the shipping code's),
 *            the real store and rules, and the real `<selector-screen>` over the REST half
 *            of the same mock. It opens NO socket, so its states are indifferent to which
 *            socket script the mock is holding.
 *
 * WHERE EACH ONE MOUNTS. The two Live fixtures are handed a host element; the selector
 * fixture looks up `#stage` itself, because that is the id its render suite's stage
 * carries and the fixture must not have two mount protocols. So `selectorStage()` below
 * creates that host inside `#mount` on demand rather than the page shipping an empty
 * `#stage` beside `#mount` — an always-present sibling with a viewport block-size would
 * push every Live capture down the page.
 *
 * ===========================================================================
 * THE PROTOCOL THE BATTERY DRIVES (mirrors tools/gallery/gallery.js)
 * ===========================================================================
 *
 *     ?state=<id>&theme=<light|dark>&mock=<port>
 *
 *     window.__screens.states()            // [{id, title, fixture, mock, notes, geometries}]
 *     window.__screens.ready               // resolves once the requested state settled
 *     document.body.dataset.screenState    // the id shown
 *     document.body.dataset.screensSettled // '1' once settled
 *     document.body.dataset.screenFault    // set instead, when driving threw
 *
 * WITH NO `state` PARAM THE PAGE MOUNTS NOTHING. That is the enumeration load: the
 * battery reads `states()`, learns which MOCK each state needs (`park` or `shot` — two
 * differently scripted servers, because one process holds one script), and then navigates
 * once per state with that mock's port. A state id is a capture FILENAME, so the ids here
 * are stable identifiers and a rename is a re-baseline.
 */

/* THE ONLY IMPORT IN THIS FILE, AND IT IS DELIBERATE. Everything else here drives the app
 * through fixtures that publish globals, so the registry stays a description of states
 * rather than a second copy of the app. The settings NAVIGATION is the exception, because
 * the coverage question this registry answers — which leaves get photographed — is a
 * question only the nav can answer truthfully. See THE SETTINGS LEAVES, DERIVED, below. */
import { allLeaves, categoryOf, navName } from 'src/lib/settings-nav.js';

/* AND THE CAPABILITY LIST, for the same reason and by the same rule: read off the tree,
 * never written down here. See A FULLY-CAPABLE MACHINE in the derived block below. */
import { SERVED_CAPABILITIES } from 'src/stores/capabilities-store.js';

/* AND THE FIT, for the third time by the same rule: the instrument reproduces the app's
 * ground rather than describing it. `#mount` carries the same zoom and design box
 * app-root does (index.html here), and this is what publishes the three properties both
 * of them read. Without it every capture is a layout at the raw viewport size — which
 * on the bench tablet is 1281 units wide where the app lays out at 1919, and that gap
 * is precisely the one that let a broken rail reach Ben's glass with every gate green. */
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

/**
 * How far below the split's own threshold the collapsed capture sits, in CSS pixels.
 * 80 puts the mount host at 820px, the width the wave 5.3 cross-review's interim captures
 * used, so the two sets are comparable at the only number that decides the branch. The
 * FRAMES still differ and are meant to: that script drove one page through all seven
 * states in sequence, so its collapsed shot carries whatever the six before it left on
 * screen, and every state here starts from a fresh document.
 */
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

/**
 * Drive the selector to its resting state: the real boot against the mock's REST half,
 * the recorded listing landed, the screen rendered. Every selector state starts here,
 * because the battery navigates ONCE PER STATE and a fresh document has nothing.
 */
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

/* ---------------------------------------------------------------------------
 * THE STATES
 * ------------------------------------------------------------------------- */

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
            /* A CONNECTED MACHINE IS ALSO A MACHINE THAT IS TALKING. Until this line the
             * state pushed a devices frame and no snapshot at all, so the screen claimed
             * a connected machine with no telemetry and the gauge cluster photographed
             * five dashes — a picture no real connected machine produces. The frame's
             * channels are the recording's own bytes; only its state word is built, and
             * the fixture says so. */
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

    /* -----------------------------------------------------------------------
     * THE PROFILE SELECTOR (wave 5.3). Seven states, the same seven the wave's
     * cross-review shot by hand before this registry had a row for any of them.
     *
     * EVERY ONE NAMES THE `shot` MOCK AND NONE OF THEM CARES. The selector opens no
     * socket — `selector-loop-fixture.js` hands the boot a socket factory that never
     * dials — so both scripts serve it the same recorded REST fixtures. Naming the one
     * the Live states already need keeps the walk at two mock processes instead of three.
     * --------------------------------------------------------------------- */
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
            /* A prefix carried by the recorded fixture, so the frame is the same frame
             * every time this is shot. The core-loop suite narrows on a different real
             * prefix; this one is what the wave's captures were taken against. */
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
            /* The same refusal the Live states script, spelled once in this file: the
             * selector's transport is scripted by status + body, so the typed result's
             * own `status` and `problem` are what the mock cannot answer. */
            api.answer('POST', '/api/v1/machine/profile', REFUSED.status, REFUSED.problem);
            /* OPEN THE DIALOG FIRST, AND IT IS NOT A FLOURISH. `confirmLoad()` presses the
             * band's Confirm and the dialog's Load back to back; `openConfirm()` is the
             * only one of the two that awaits the dialog's own update before pressing, and
             * without it the close lands before the shell exists and the dialog is still
             * OPEN over the banner when the shutter goes — measured: hostOpen true,
             * nativeOpen true, banner true. That frame is a picture of a dialog labelled
             * as a picture of a refusal, which is the one thing a baseline must never be.
             * Both orderings arm the machine and raise the same banner; this one is also
             * the sequence a person performs. */
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
            /* THE THRESHOLD IS READ, NOT RETYPED. `selector-split.js` exports it beside
             * the container query it could not put a `var()` into; a number spelled again
             * here would drift the day that one moves, and the collapse would quietly stop
             * being photographed. The clearance keeps the frame clear of the boundary —
             * a capture taken AT the threshold is a coin toss between two layouts. */
            const { SPLIT_COLLAPSE_PX } = await import('src/screens/selector-split.js');
            stage.style.inlineSize = `${SPLIT_COLLAPSE_PX - COLLAPSE_CLEARANCE_PX}px`;
            await api.mount({ port: mockPort });
            /* WITH A SELECTION. An empty detail pane collapses to a placeholder, and the
             * question this frame answers is what the two panes do STACKED — whether the
             * chart card and the notes editor still have room once they are below the
             * list rather than beside them. Nothing is measurable in an empty one. */
            await selectFirst(api);
        },
    },

    /* ---------------------------------------------------------------------
     * SETTINGS — wave 5.4, the skeleton-and-navigation cluster.
     *
     * THE RULE AT THE TOP OF THIS FILE, KEPT IN THE WAVE THAT BUILDS THE SCREEN
     * rather than in a fix afterwards: three rows, driving the fixture this
     * screen's own render suite drives. Two waves running have now shipped their
     * registry rows late (5.1 cross-3, 5.3 cross-3); this is the same obligation
     * met on time, and `test/tools-port.test.mjs` turns red the moment a screen
     * file exists with no state naming it.
     *
     * MOCK `park`: the settings skeleton has no data layer at all — no socket, no
     * request, no storage key — so the mock is indifferent and naming the one the
     * Live states already start keeps the walk at two processes.
     *
     * THREE STATES, one per claim this cluster makes that a picture can carry:
     * the three-column resting shell, the search narrowing (T12), and the
     * container-query collapse. The leaves' own rows will add theirs.
     * ------------------------------------------------------------------- */
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
        /* WIDE BRANCH ONLY, AND THE REASON IS A KNOWN HOLE, NOT A CAPTURE PREFERENCE.
         * The search field is slotted into the NAV COLUMN (settings-screen.js:332-340).
         * Below the 1100px collapse the column is `display:none`
         * (settings-master-detail.js:236-238) and the field goes with it, so at the 1000px
         * floor this state drives a search that has no surface: it photographed a frame
         * BYTE-IDENTICAL to `settings--browse` in both themes
         * (dark 09a05951…, light fb42cfba…, measured wave 5.4 cross-3) while claiming to
         * be a different state. Two differently-named states with one image is exactly the
         * failure the registry law at the top of this file exists to prevent — a state
         * nobody downstream can verify.
         *
         * At bench and desktop the two states DO differ, so the driver is doing real work
         * and the collision is geometric. The hole itself is fix-1's deferred question
         * (the field stays in the nav column per LAYOUT_SPEC_DRAFT §4.4:705; it is
         * RECORDED, not closed, and pinned by measurement in
         * test/render/settings-skeleton.render.test.mjs at 1099). Re-taking the floor
         * frames could not fix this — there is nothing to photograph until that question
         * is answered — so the state declares where it is meaningful instead, and the
         * battery lists the skip under `unverified` rather than shipping a false
         * photograph. DELETE THIS LINE the day the field becomes reachable collapsed. */
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
            /* THE THRESHOLD IS READ, NOT RETYPED — the same argument as the selector's
             * collapsed row one section up. `settings-master-detail.js` exports it beside
             * the container query it could not put a var() into, and the clearance keeps
             * the frame off the boundary, where a capture is a coin toss. */
            const { MASTER_DETAIL_COLLAPSE_PX } = await import('src/screens/settings-master-detail.js');
            api.stage().style.inlineSize = `${MASTER_DETAIL_COLLAPSE_PX - COLLAPSE_CLEARANCE_PX}px`;
            await api.mount();
            await api.selectCategory('machine');
        },
    },

    /* THE LEAVES' OWN TWO ROWS — added in the wave that built them, as the rule at the
     * top of this file requires. The skeleton's three photograph the SHELL; these two
     * photograph the thing the shell was built to hold. */
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

    /* THE BESPOKE CLUSTER'S FOUR ROWS, added in the wave that built them (the registry
     * law at the top of this file). Each drives the SAME fixture and the SAME levers
     * `test/render/settings-bespoke.render.test.mjs` drives, so nothing here is a state
     * no test asserts. */
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

    /* THE TILE GRID'S ROW — added by wave 5.4's fix phase (cross-5), and the reason it
     * is a fifth bespoke row rather than one of the four above is worth keeping.
     *
     * The bespoke cluster's four rows cover eight of the nine surfaces a sweep asks for,
     * and the ninth had no row at all: `#40 ui-tile-grid` is one of the ten bespoke
     * components this wave composes, `units-language-select-language` is the ONLY screen
     * it ships on, and `settings--bespoke-cards` is the SKINS grid (`#51 ui-card-grid`),
     * a different component. So nothing downstream photographed #40 in situ at any
     * geometry. That is not the registry law breached as written — the law is per SCREEN
     * and this screen has rows — but it is the gap the law exists to close, and #40 is
     * the one bespoke leaf whose layout is GENUINELY RESPONSIVE (`repeat(auto-fill,
     * minmax(min(280px, 100%), 1fr))`), which is exactly the property two stills at two
     * geometries pin and no source read can.
     *
     * NO `geometries` DECLARATION, DELIBERATELY. `settings--search-narrowed` declines the
     * floor because the collapse leaves it nothing to photograph; this state is the
     * opposite case. The leaf exists at every geometry and the grid's track width is a
     * CONTAINER answer on the leaf pane's own inline-size, so both frames carry a claim.
     *
     * WHAT THE TWO FRAMES ACTUALLY SHOW — MEASURED, NOT ASSUMED, before this row was
     * written, because the finding that asked for it expected more than they deliver:
     *
     *   floor   1000x600  @ dsf 1     grid 643px   2 tracks @ 315.5px   6 tiles, 1 pressed
     *   bench   1281x801  @ dsf 1.5   grid 736px   2 tracks @ 362.1px   6 tiles, 1 pressed
     *   desktop 1920x1200 @ dsf 1     grid 891px   3 tracks @ 289.0px   6 tiles, 1 pressed
     *
     * SAME COLUMN COUNT AT THE TWO THIS WAVE WALKS, DIFFERENT TRACK. What bounds this
     * grid is not the viewport but the leaf's own measure cap (`--ui-measure-wide`, 84ch),
     * so the pane clears three 280px tracks only at DESKTOP — which is in
     * `CAPTURE_MATRIX` and is NOT in wave 5.4's walk (`--geometry bench,floor`). The
     * suite reaches every count by narrowing the STAGE to 760 / 1100 / 1600, a lever a
     * capture has no business pulling because it photographs a box no user ever gets.
     *
     * So at bench and floor the two stills pin what stills can: that #40 is on screen at
     * all, the tile anatomy (endonym over English name, "· partial" where the catalogue
     * is partial), the single `aria-pressed` tile, and an ELASTIC track 46px wider at the
     * bench than at the floor. The column-count reflow stays the render suite's claim
     * (`settings-bespoke.render.test.mjs` §5) — a number that changes with the box is a
     * measurement, and a photograph is not one. THE DAY THE WALK ADDS `desktop` this row
     * pays for itself twice: 3 columns against 2 is the reflow in two files, and
     * `settings--search-narrowed` already declares a `desktop` this wave never visits.
     * That geometry call is recorded as a deferred question, not taken here.
     *
     * THE SIX LANGUAGES ARE THE RENDER SUITE'S OWN LIST, copied from
     * `test/render/settings-bespoke.render.test.mjs` §5 so this row drives the fixture
     * that suite drives with the input that suite drives it with — the registry law's
     * "driving the fixture its own render suite drives", both halves. V1 SHIPS ENGLISH
     * ONLY (D2) and `api.languages()` is the manifest's job simulated, which is the
     * fixture's own documented lever; a one-tile grid is a true picture of v1 and a
     * useless picture of #40. */
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

    /* =====================================================================
     * WAVE 5.5 — THE PROFILE EDITOR'S SHELL AND ITS TWO DATA-FREE PANELS
     *
     * Three states, one per panel, because §4.3's body IS "one of three panels"
     * and a registry that photographed only the resting one would prove the
     * shell and none of what it holds.
     *
     * THE STEPS PANEL WAS A MOUNT REGION AND NOW HOLDS THE MATRIX. The shell
     * cluster photographed the empty cell and said the state would stay when
     * the matrix landed, with only its contents changing. It landed (wave 5.5,
     * the step-matrix cluster) and this is that change: the state count is
     * UNMOVED at 26 and the per-screen split is unmoved at 3 editor states.
     * ===================================================================== */
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

    /* =====================================================================
     * WAVE 5.5 — THE EDITING SURFACES (fix-3, finding c-editing-surfaces-7)
     *
     * FOUR STATES, and before them this cluster's whole deliverable — the
     * preview chart, the keypad and the two dialogs — contributed ZERO pixels
     * to Gate B. The three states above photograph the shell's panels; the
     * fixture could not reach an editing surface at all, because it imported
     * neither editor-preview.js nor editor-overlays.js. It now mounts both,
     * in the two regions <editor-screen> declares for them.
     *
     * WHY EXACTLY THESE FOUR. The cross-reviewer's 44 interim frames carry
     * eleven ids; seven of them are OTHER clusters' surfaces (the matrix's
     * scroll and density, the exit band's slots, the settings collapse) and
     * those clusters' states already exist and already carry those claims —
     * editor--steps was amended in place by the matrix cluster and its note
     * names the scroll and the compact density; editor--settings gets its
     * 3-up/2-up pair from the GEOMETRIES rather than a posed width. Adding
     * them here would re-pose another cluster's frame. The remaining four are
     * this cluster's rows, one frame each: chart-preview, numpad-flows, and
     * editor-dialogs twice, because the two dialogs are two different bodies
     * and one is not evidence for the other.
     *
     * EACH OPENS THROUGH A PUBLIC ROUTE and the arbitration is the element's:
     * opening one overlay closes whatever else was open, so no state here can
     * photograph two open dialogs even if it tried.
     * ===================================================================== */
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

    /* =====================================================================
     * WAVE 5.6 — THE SHOT HISTORY, AS A ROUTE
     *
     * ONE STATE, and it is the route-and-skeleton cluster's whole visible
     * surface: the band (back, picker A, picker B, tab bank), the compare bar
     * on the page that has a time axis, and the page MOUNT REGION.
     *
     * IT IS DRIVEN THROUGH THE REAL SHELL AND ENTERED BY CLICKING LIVE'S OWN
     * AFFORDANCE, not by assigning a hash. The claim this screen exists to
     * make is that History is a ROUTE and not a `display:flex` toggle over the
     * Live DOM (§4.5), so a frame reached by setting the address would
     * photograph the one thing that is not in question and skip the one that
     * is. Entering it the way a person does also means the frame is evidence
     * the way in EXISTS — which is what the whole conversion buys.
     *
     * THE PAGE REGION IS EMPTY IN THIS FRAME, ON PURPOSE AND NOT BY OVERSIGHT.
     * `hist-flow-page` and `hist-data-page` are the pages cluster's rows; this
     * cluster ships the region and its contract. The precedent is exact and
     * one wave old: `editor--steps` photographed an empty mount cell and the
     * matrix cluster AMENDED THE STATE IN PLACE when it landed, adding no row
     * and removing none. This state is to be amended the same way — the frame
     * gains the two pages and the count does not move.
     * ===================================================================== */
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
                /* THE SHORT LABEL FORM, which is the screen's stated contract ("the
                 * labels are the consumer's, and they are a short form") and not a
                 * flattering choice. The first frame of this state used the mock's own
                 * full title and the band overflowed at the design floor with the tab
                 * bank pushed off the right edge entirely -- that is M10, and it is
                 * recorded as an open measurement in history-header.js with both
                 * numbers rather than hidden by posing a narrow label. What this frame
                 * shows is the band at its intended measure; what M10 owes is the
                 * budget that keeps it there. */
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

    /* =====================================================================
     * WAVE 5.6, THE PAGES CLUSTER — +1, and the ledger line above says so.
     *
     * A GENUINELY DIFFERENT STATE, which is the bar the note at the top of the
     * History block sets: "a cluster that needs a genuinely different STATE —
     * the data page, whose compare bar is absent and whose list scrolls — adds
     * one and appends its own ledger line". Both halves of that sentence are
     * true here and neither is true of the flow frame, so this is a row rather
     * than a second amendment.
     * ===================================================================== */
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

    /* =====================================================================
     * FIX RUN 6, THE POWER PAGE — +2, and the ledger line above says so.
     *
     * TWO ROWS AND NOT ONE, for the reason the header's COROLLARY gives. The
     * page has H1's two branches like the flow page, but unlike the flow page
     * the two plots on it are DIFFERENT KINDS of chart: at the bench both show
     * and one frame carries everything, while at the 1000x600 floor the page
     * shows ONE plot and a selector — and which one is a property. A single
     * row would therefore photograph the trajectory at the bench and never at
     * the floor, and the manifest would not say so.
     *
     * So `history--power` is the page's default (the derived-channel chart is
     * what the selector opens on) and `history--power-trajectory` declares
     * itself INTO THE FLOOR ONLY: at the bench it would be byte-identical to
     * the row above it, which is the `settings--search-narrowed` failure
     * exactly — "a duplicate image is worse than silence, because it looks
     * like coverage".
     *
     * BOTH STAGE A NON-ZERO OFFSET, and that is the point rather than a
     * flourish: a time offset cannot move a P-Q path, so what the compare bar
     * moves on this page is Q16's CORRESPONDENCE MARKS. Staged at zero, the
     * frame would photograph the feature switched off.
     * ===================================================================== */
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

/* ---------------------------------------------------------------------------
 * THE SETTINGS LEAVES, DERIVED — NOT LISTED
 * -------------------------------------------------------------------------
 *
 * THE THIRD TIME THIS FILE'S OWN LAW WAS BROKEN, AND THE REASON THIS BLOCK IS A
 * DERIVATION RATHER THAN THIRTY-SEVEN MORE ROWS. The header states the rule — a screen
 * with no row is a screen nobody downstream can photograph — and records it being broken
 * twice, by wave 5.3 and again by wave 5.4. It was broken a third time and nobody noticed,
 * because it was broken at a level the rule does not reach: the settings rows above
 * photograph ARCHETYPES (`settings--leaf-rows` drives ONE leaf, machine-flush, and stands
 * in for every leaf of rows), while the old app photographs ONE STATE PER LEAF — thirty of
 * them. So twenty-seven leaves that exist, navigate and render were not missed by this
 * registry; they were UNPHOTOGRAPHABLE THROUGH IT, and no manifest could say so, because
 * the archetype row is present and green.
 *
 * A hand-written list of thirty-seven rows would close today's gap and reopen it on the
 * next leaf anyone adds. So the list is not written: it is READ OFF THE NAVIGATION, which
 * is the same move `capture_battery.py` now makes for its unverified list — derive the
 * coverage claim from the structure that defines it, and the two cannot drift. Add a leaf
 * to `settings-nav.js` and it is photographed; delete one and its state goes with it.
 *
 * DESKTOP ONLY, AND THAT IS THE POINT RATHER THAN AN ECONOMY. These states exist to be
 * PAIRED against the old app's own captures, and those were taken at one geometry —
 * 1920x1200, which is also the tablet's. A leaf photographed at the bench and the floor
 * as well would treble the frames and none of the extra ones would have a counterpart to
 * be compared against. The archetype rows above keep the full matrix, because their job is
 * the opposite one: they answer how a leaf BEHAVES as the viewport moves. `geometries` is
 * the field the header's corollary added for exactly this kind of statement.
 *
 * ONE ROW PER LEAF, DRIVEN THE WAY THE ARCHETYPE ROW DRIVES ITS ONE LEAF: mount, serve
 * the capability array, select the category the nav itself says the leaf belongs to,
 * select the leaf. Nothing here types a leaf id, a category id or a capability name —
 * all three come from the tree.
 *
 * A FULLY-CAPABLE MACHINE, AND WHY THAT IS THE RIGHT STAGING FOR THIS ROW (parity
 * surface 3). The mock answers /machine/capabilities with 503 BY DESIGN, so a drive that
 * serves nothing leaves every gate at UNKNOWN and every gated leaf fail-closed — which is
 * correct behaviour and the wrong photograph for THIS row's one job. Measured before the
 * fix: `accessories-cup-warmer`, `accessories-lighting`, `calibration-load-cells` and
 * `machine-sleep-wake-schedules` each photographed an eyebrow, a title and NOTHING ELSE,
 * so four of the thirty-seven pairing states could not be paired with the old app's
 * capture of the same leaf at all. Three are the bespoke cluster's gated leaves
 * (`LEAF_CAPABILITY` in settings-bespoke-leaf.js) and the fourth is a ROUTE row gated at
 * `settings-leaf-model.js` — four gates, one cause.
 *
 * The list is `SERVED_CAPABILITIES` — the seven entries `de1handler.dart` adds — so a
 * capability added to the machine is served here the first time this runs, exactly as a
 * leaf added to the nav is photographed here the first time this runs. A hand-written
 * array would drift from the store the day the eighth entry lands.
 *
 * THE FAIL-CLOSED FRAME IS NOT LOST, and that is why this is safe: `settings--bespoke-
 * gated` above serves `null` deliberately and photographs A3 as an absence. The two rows
 * now say different things on purpose — one shows the leaf, one shows the refusal — where
 * before they said the same thing by accident.
 */
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
    /* Wave 5.6. The ROUTE fixture, not a screen-in-isolation one: this is the only
     * registry entry that drives a whole `<app-root>` with the real route table,
     * because the state it stages is reached by navigating rather than by mounting. */
    history: {
        module: '../../test/fixtures/history-route-fixture.js',
        api: () => globalThis.__history,
    },
};

/* ---------------------------------------------------------------------------
 * Mounting and settling — the gallery's own two functions, for the same reason:
 * a capture taken one frame early is a baseline that is wrong forever.
 * ------------------------------------------------------------------------- */

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
    /* Deliberately NOT settled: the battery records the state as unsettled, which is what
     * the manifest's `unverified` list is for. A PNG of a broken drive that claims to be
     * the state is worse than a missing one. */
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
