/**
 * selector-loop-fixture — the Profile selector, booted against the REAL mock, driven.
 *
 * the core-loop-and-REST cluster.
 *
 * WHAT IS REAL HERE, and it is nearly everything: `createAppBoot`, `createReaTransport`
 * (so `If-None-Match` and the 304-with-stored-body are the shipping code's, not a
 * simulation), `createProfileLibraryStore`, `profile-rules.js`, `adapters-r.js`,
 * `createProfileArmStore`, and `<selector-screen>` through `index.html`'s importmap. The
 * listing, the workflow report and the favourites map come off `tools/mock_rea.py`
 * serving its recorded fixtures over a real socket.
 *
 * TWO THINGS ARE SUBSTITUTED, AND BOTH ARE STATED HERE RATHER THAN DISCOVERED LATER:
 *
 * 1. THE FETCH IS WRAPPED, NOT REPLACED. `answer(method, pathname, …)` scripts ONE path;
 *    everything else goes to the mock. It is a wrapper rather than a fake transport
 *    because the interesting behaviour — conditional GETs, the 304 turn, the typed 400
 *    all lives INSIDE `rea-transport.js`, and a fake transport is exactly the layer that
 *    would skip it.
 *
 *    THE THREE PATHS THAT MUST BE SCRIPTED, and why the mock cannot answer them:
 *      POST /machine/profile        the mock CAN answer it — 200 null, from the contract
 *                                   row's own success branch — which is the armed case
 *                                   and is used unscripted. The REFUSAL (400 Unsupported
 *                                   profile) is a state no recording carries, so the rule's
 *                                   subject is scripted, with the body spelled exactly as
 *                                   the contract row spells it.
 *      POST /profiles/restore/…     the row's success body is a typed document
 *                                   (ProfileRecord.toJson), so `write_response` answers
 *                                   501 rather than inventing a server. The round trip is
 *                                   therefore scripted — with a REAL fixture record,
 *                                   visibility flipped, not a hand-written one.
 *      GET  /profiles/<id>/lineage  no recording exists; the mock's endpoint fallback is
 *                                   deleted so it is an honest 503.
 *
 * 2. THE `local` AND `session` STORAGE LAYERS ARE MEMORY, injected through
 *    `createAppBoot({backends})`. The favourites rail is a `kv` row, and the mock has no
 *    recording for `GET /store/decal/favouriteProfiles` — an honest 503 the router
 *    absorbs into "absent", which is a real first-launch and is the state rule 4 exists
 *    for. Injecting a memory `kv` makes the rail deterministic ACROSS a reload inside one
 *    test, which is what rule 5's marker needs to be observable at all.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
const { createMemoryBackend } = await import('../../src/lib/storage-backends.js');
const { LAYERS } = await import('../../src/lib/storage-routes.js');
await import('../../src/screens/selector-screen.js');

/* ---------------------------------------------------------------------------
 * The scripted fetch
 * ------------------------------------------------------------------------- */

const answers = new Map();
const calls = [];

const key = (method, pathname) => `${String(method).toUpperCase()} ${pathname}`;

const scriptedFetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const url = new URL(href, globalThis.location.href);
    const method = (init.method || 'GET').toUpperCase();
    const sent = new Headers(init.headers || {});
    calls.push({ method, path: url.pathname, query: url.search, ifNoneMatch: sent.get('if-none-match') });
    const answer = answers.get(key(method, url.pathname));
    if (answer) {
        /* THE CONDITIONAL BRANCH IS EMULATED HERE BECAUSE THE MOCK CANNOT DO IT.
         * `tools/mock_rea.py` serves recorded bodies and sends NO ETag at all, so nothing
         * ever reaches `rea-transport.js`'s etag store and the conditional path — which
         * IS shipping code, and is what the `conditional` gate on the getProfiles row
         * promises — has no way to run end to end against the instrument. So a scripted
         * answer may declare itself conditional and behave the way jsonOkConditional
         * does: an ETag on the first answer, 304 with no body once the client sends the
         * matching If-None-Match back. Recorded as a finding, not papered over. */
        if (answer.etag) {
            const matched = sent.get('if-none-match');
            if (matched && matched === answer.etag) {
                return new Response(null, { status: 304, headers: { etag: answer.etag } });
            }
            return new Response(JSON.stringify(answer.body), {
                status: answer.status,
                headers: { 'content-type': 'application/json', etag: answer.etag },
            });
        }
        return new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), {
            status: answer.status,
            headers: { 'content-type': 'application/json' },
        });
    }
    return globalThis.fetch(input, init);
};

/** A socket factory that never dials. This screen opens no channel. */
const createSocket = () => ({
    addEventListener() {}, removeEventListener() {}, send() {}, close() {},
    readyState: 3,
});

let boot = null;
let screen = null;

/**
 * The implicit ARIA role of the elements that are operable without one. Short on purpose:
 * these are the tags a listbox's subtree could plausibly grow, and anything else that
 * matters carries an explicit `role` and is read from that.
 */
const IMPLICIT_ROLE = Object.freeze({
    a: 'link', button: 'button', input: 'textbox', select: 'combobox',
    summary: 'button', textarea: 'textbox',
});

/**
 * The listbox's flattened subtree — see `listboxRoles()` for what is reported and why.
 * Returns { roles, walked, elements }: the role histogram, the number of shadow roots the
 * walk entered, and the number of elements it saw.
 */
function listboxWalk() {
    const box = screen.shadowRoot.getElementById('rows');
    const roles = {};
    let walked = 0;
    let elements = 0;
    /* `inert` IS CARRIED DOWN rather than looked up. Element.closest does not cross a
     * shadow boundary, and the attribute lives on the HOST - <ui-favourite-slot inert> -
     * while the element being judged is the button inside its shadow root. A lookup
     * therefore reports "not inert" for every inert mark on the screen. */
    const visit = (root, inertHere = false) => {
        for (const el of root.querySelectorAll('*')) {
            elements += 1;
            const inert = inertHere || el.hasAttribute('inert')
                || el.closest('[inert]') !== null;
            const explicit = el.getAttribute('role');
            const tag = el.tagName.toLowerCase();
            /* A <button aria-hidden="true"> would still be a tab stop, so aria-hidden is
             * NOT taken as "not in the tree" for an operable element — only for the
             * presentational nodes that are already unreported. */
            /* presentation / none MEANS "no role", and it is honoured here where
             * aria-hidden deliberately is not. The difference is reachability: a
             * <button aria-hidden="true"> is still a tab stop and still lands focus, so
             * hiding it from the tree only makes it a control nobody can name. An element
             * whose role is presentation AND which cannot be focused is not a control at
             * all - it is paint - and that is what the rule's "only items and groups" is a
             * claim about.
             *
             * SO IT IS GATED ON INERTNESS, not taken on the author's word. ui-favourite-slot
             * renders role="presentation" only on its `inert` branch, because the ARIA layout layout spec
             * ignores presentation on a focusable element and inert is what makes it
             * unfocusable. A presentation role on something still reachable falls through
             * to the implicit role below and fails this test, which is the right answer. */
            const decorative = (explicit === 'presentation' || explicit === 'none')
                && (inert || el.getAttribute('tabindex') === '-1');
            const role = decorative ? null : (explicit || IMPLICIT_ROLE[tag]
                || (el.hasAttribute('tabindex') ? `(focusable:${tag})` : null));
            if (role) roles[role] = (roles[role] ?? 0) + 1;
            if (el.shadowRoot) { walked += 1; visit(el.shadowRoot, inert); }
        }
    };
    visit(box);
    return { roles, walked, elements };
}

/** Everything the tests need, and every method answers a PLAIN, SMALL value. */
const api = {
    /**
     * Build the real shell against the mock on `port`, and mount the screen.
     *
     * `boot.start()` is deliberately NOT called: it opens six sockets and loads a screen
     * module through the route table, neither of which this cluster is about. The boot
     * OBJECT — transport, storage, arm — is what the screen takes.
     */
    async mount({ port }) {
        boot = createAppBoot({
            fetch: scriptedFetch,
            createSocket,
            location: { hostname: '127.0.0.1', protocol: 'http:', port },
            backends: {
                [LAYERS.kv]: createMemoryBackend(),
                [LAYERS.local]: createMemoryBackend(),
                [LAYERS.session]: createMemoryBackend(),
            },
        });
        const stage = document.getElementById('stage');
        screen = document.createElement('selector-screen');
        screen.boot = boot;
        stage.appendChild(screen);
        await screen.updateComplete;
        await api.settled();
        return { mounted: true, calls: calls.length };
    },

    /** Wait until the listing has landed (or failed) and the screen has re-rendered. */
    async settled(deadlineMs = 8000) {
        const stop = Date.now() + deadlineMs;
        for (;;) {
            const state = screen?.store?.get();
            if (state && state.status !== 'idle' && state.status !== 'loading') break;
            if (Date.now() > stop) return false;
            await new Promise((r) => setTimeout(r, 25));
        }
        await screen.updateComplete;
        return true;
    },

    answer(method, pathname, status, body, etag = null) {
        answers.set(key(method, pathname), { status, body, etag });
        return true;
    },

    /** How many requests to this path carried an If-None-Match header. */
    conditionalCalls(pathname) {
        return calls.filter((c) => c.path === pathname && c.ifNoneMatch).length;
    },

    forget(method, pathname) { return answers.delete(key(method, pathname)); },

    /** How many times a path was fetched, by method. The request-volume oracle. */
    countCalls(method, pathname) {
        return calls.filter((c) => c.method === method.toUpperCase() && c.path === pathname).length;
    },

    /**
     * How many times a path ENDING IN a suffix was fetched, by method.
     *
     * The exact-path counter above cannot ask about a route whose path carries an id, and
     * the rule's deferred half is exactly that shape: `/api/v1/profiles/<id>/purge`. Counting
     * every DELETE to `/api/v1/profiles` used to serve as a stand-in and stopped being
     * one the day the SOFT delete (Hide) got a control.
     */
    countCallsEndingIn(method, suffix) {
        return calls.filter((c) => c.method === method.toUpperCase()
            && typeof c.path === 'string' && c.path.endsWith(suffix)).length;
    },

    /** A small, plain snapshot. Never the state object — CDP cannot serialise it. */
    state() {
        const s = screen?.store?.get();
        if (!s) return null;
        return {
            status: s.status,
            records: s.records.length,
            listable: s.listable.length,
            restorable: s.restorable.length,
            selectedId: s.selectedId,
            loaded: {
                id: s.loaded.id, known: s.loaded.known, provisional: s.loaded.provisional,
                reason: s.loaded.reason, basis: s.loaded.basis,
                candidates: s.loaded.candidates ? s.loaded.candidates.length : 0,
            },
            favourites: Object.values(s.favourites.assignments).filter(Boolean).length,
            seeded: s.favourites.seeded,
            refusal: s.refusal ? { kind: s.refusal.kind, error: s.refusal.error, message: s.refusal.message } : null,
            restore: { status: s.restore.status, filename: s.restore.filename },
            versions: { status: s.versions.status, count: s.versions.records.length },
            reads: { ...s.reads },
        };
    },

    async reload() { await screen.store.load(); await screen.updateComplete; return api.state(); },

    /** Record ids from the listing, so a test never types one. */
    ids({ limit = 5, withFilename = false } = {}) {
        const s = screen.store.get();
        const from = withFilename ? s.restorable : s.listable;
        return from.slice(0, limit).map((r) => r.id);
    },

    /** One record's title, by id. */
    titleOf(id) {
        const r = screen.store.recordFor(id);
        return r ? (r.profile.title ?? null) : null;
    },

    /* ---- the loop, driven ---------------------------------------------- */

    async search(text) {
        const field = screen.shadowRoot.getElementById('filter');
        field.value = text;
        field.dispatchEvent(new CustomEvent('search', { detail: { value: text }, bubbles: true, composed: true }));
        await screen.updateComplete;
        return api.optionCount();
    },

    /**
     * Click the Nth PROFILE row. Family rows are skipped: they are rows in the same list
     * and clicking one folds a family rather than selecting anything, so a probe that
     * counted them would sometimes fold instead of pick — which is precisely the bug
     * this helper would then be hiding.
     */
    async clickRow(index = 0) {
        const rows = [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')]
            .filter((el) => !el.classList.contains('family-row'));
        if (!rows[index]) return null;
        rows[index].click();
        await screen.updateComplete;
        return rows[index].dataset.id ?? null;
    },

    async select(id) { screen.store.select(id); await screen.updateComplete; return api.state().selectedId; },

    /**
     * How many PROFILE rows the tree is showing.
     *
     * `[role="treeitem"]` since the list became a tree ("Make families
     * collapse") — a listbox owns options and cannot own a disclosure, so a collapsible
     * grouped single-select list is a tree. The family rows carry the same role and are
     * excluded here: this number answers "how many profiles can be seen", which is what
     * every assertion built on it was ever about.
     */
    optionCount() {
        return [...screen.shadowRoot.querySelectorAll('#rows [role="treeitem"]')]
            .filter((el) => !el.classList.contains('family-row')).length;
    },

    /** How many FAMILY rows the tree is showing, and how many of them are open. */
    families() {
        const rows = [...screen.shadowRoot.querySelectorAll('#rows .family-row')];
        return {
            count: rows.length,
            open: rows.filter((el) => el.getAttribute('aria-expanded') === 'true').length,
            names: rows.map((el) => el.dataset.folder),
        };
    },

    /**
     * Open every family, and answer how many rows that revealed.
     *
     * WHY THE SUITE CALLS THIS ONCE AT THE TOP. Families ship SHUT, which is the previous skin's own
     * default (`readOpenFolders` returns an empty set) and the state that makes 91
     * profiles legible. Every assertion below about "the listing" is about the whole
     * listing, so the drive opens the tree first and the FOLD gets a test of its own.
     */
    async expandAll() {
        for (const row of [...screen.shadowRoot.querySelectorAll('#rows .family-row')]) {
            if (row.getAttribute('aria-expanded') !== 'true') row.click();
            await screen.updateComplete;
        }
        return api.optionCount();
    },

    /** Fold one family by name, or unfold it. Answers the tree's new shape. */
    async toggleFamily(name) {
        const find = () => [...screen.shadowRoot.querySelectorAll('#rows .family-row')]
            .find((el) => el.dataset.folder === name);
        const row = find();
        if (!row) return null;
        row.click();
        await screen.updateComplete;
        /* RE-QUERIED, NOT REUSED. The family row is followed by a group when it is open
         * and by nothing when it is shut, so the template's shape changes and Lit may
         * hand back a different element. Reading the attribute off the reference held
         * across the press reports the state BEFORE it. */
        return { open: find()?.getAttribute('aria-expanded') === 'true', rows: api.optionCount() };
    },

    /**
     * Every role inside the listbox, FLATTENED, so the rule's fourth half is countable.
     *
     * IT WALKS SHADOW ROOTS, AND THAT IS THE WHOLE POINT. This probe used to be one
     * `box.querySelectorAll('*')`, which does not cross a shadow boundary — so it could
     * never see the <button> each <ui-list-row> renders INSIDE ITSELF, and the role
     * assertion passed vacuously over the exact children it exists to police (78 of them,
     * measured through CDP Accessibility.getFullAXTree). The accessibility tree is
     * computed over the flattened tree; a probe that is not must not be read as one.
     *
     * WHAT IT REPORTS, and why not simply every tag: an accessibility tree is not a DOM
     * dump. An element with an explicit `role` is reported under that role, and a natively
     * interactive element with no role is reported under its IMPLICIT one — a <button>
     * inside an option becomes `button`, which is exactly what the AX tree exposed and what
     * calls a non-option child. Presentational containers (a <div>, a <span>, a <slot>
     * with no role and nothing operable about them) are not reported: a flattened walk is
     * full of them, they are what shadow DOM is made of, and they are not what the rule is
     * about. `walked` is the guard on the guard — it counts the shadow roots the walk
     * entered, so a regression to a light-DOM-only probe shows up as a zero rather than as
     * a green assertion.
     */
    listboxRoles() {
        return listboxWalk().roles;
    },

    /** The same walk, reporting how far it reached — see listboxRoles(). */
    listboxWalk,

    /** Tag names of the listbox's options — the rule's "how many row implementations". */
    optionTags() {
        const box = screen.shadowRoot.getElementById('rows');
        const tags = {};
        for (const el of box.querySelectorAll('[role="treeitem"]')) {
            const tag = el.tagName.toLowerCase();
            tags[tag] = (tags[tag] ?? 0) + 1;
        }
        return tags;
    },

    /**
     * How every option answers the row-actions question — the rule's half, restated.
     *
     * the rule is "the row is implemented TWICE and the affordance added to the first never
     * reached the second", so what it asks of this list is UNIFORMITY: one template, one
     * answer, every row. Both numbers are reported rather than one derived, because
     * "78 of 78 agree" and "the agreed answer is this one" are different facts and the
     * old tree failed the first.
     *
     * REWRITTEN, audit. `withNoOverflow` counted the `no-overflow`
     * attribute, which was every row's way of suppressing #26's built-in affordance.
     * That affordance was deleted and the attribute with it, so the count would now be
     * a uniform ZERO and would pass while measuring nothing.
     *
     * IT IS REPORTED PER CLASS, and that is a stronger statement than the attribute
     * count it replaces. A tree here holds two kinds of item: PROFILE rows, which carry
     * a record and get a row menu, and FAMILY rows, which are folders and get none.
     * "All 92 agree" was true of the old attribute only because it was written on every
     * row regardless; the real claim is that each class is uniform and the two classes
     * are exhaustive, so no row falls between them. `withButton` keeps its meaning
     * exactly — it walks the row's SHADOW root, which is where the non-item child used
     * to come from, and it must be 0 across every row of either kind.
     */
    optionAffordance() {
        const box = screen.shadowRoot.getElementById('rows');
        const options = box.querySelectorAll('[role="treeitem"]');
        const counts = {
            options: options.length,
            withButton: 0,
            profileRows: 0,
            profileRowsWithActions: 0,
            folderRows: 0,
            folderRowsWithActions: 0,
        };
        for (const el of options) {
            if (el.shadowRoot?.querySelector('button')) counts.withButton += 1;
            const slotted = Boolean(el.querySelector(':scope > [slot="actions"]'));
            if (el.hasAttribute('data-folder')) {
                counts.folderRows += 1;
                if (slotted) counts.folderRowsWithActions += 1;
            } else {
                counts.profileRows += 1;
                if (slotted) counts.profileRowsWithActions += 1;
            }
        }
        return counts;
    },

    /** The listbox's own aria state, and whether the id it names actually resolves. */
    listboxAria() {
        const root = screen.shadowRoot;
        const box = root.getElementById('rows');
        const active = box.getAttribute('aria-activedescendant');
        return {
            role: box.getAttribute('role'),
            tabindex: box.getAttribute('tabindex'),
            label: box.getAttribute('aria-label'),
            activedescendant: active,
            resolves: Boolean(active && root.getElementById(active)),
            activeIsOption: Boolean(active && root.getElementById(active)?.getAttribute('role') === 'treeitem'),
            optionsWithTabindex: box.querySelectorAll('[role="treeitem"][tabindex]').length,
        };
    },

    /** Press a key on the listbox and report where the active option went. */
    async key(name) {
        const box = screen.shadowRoot.getElementById('rows');
        box.focus();
        box.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
        await screen.updateComplete;
        return {
            activedescendant: box.getAttribute('aria-activedescendant'),
            selectedId: screen.store.get().selectedId,
        };
    },

    /** Which row carries the loaded highlight, and whether it is marked provisional. */
    highlight() {
        /* PROFILE ROWS ONLY. A family row carries `provenance` too — it is where its
         * "N profiles" count is painted — and counting those as highlights would report
         * a loaded profile on every family in the tree. */
        const rows = [...screen.shadowRoot.querySelectorAll('#rows [role="treeitem"]')]
            .filter((el) => !el.classList.contains('family-row'));
        const marked = [];
        for (const row of rows) {
            const provenance = row.getAttribute('provenance');
            if (provenance) {
                marked.push({
                    id: row.dataset.id,
                    provenance,
                    provisional: row.hasAttribute('data-r1-provisional'),
                });
            }
        }
        return marked;
    },

    /** The favourites rail, as the bank was handed it. */
    favourites() {
        /* THE ROW IS FIVE DISCS, NOT A BANK, because "Can we use slates
         * assign Favorites row... have the ASSIGN FAVOURITE and the 5 round buttons." The
         * `<ui-favourites-bank>` that carried a `.favourites` property went with it, and
         * reading that property off the plain div returned [] rather than failing - which
         * is how this read went on "passing" against an empty rail.
         *
         * THE TRUTH IS THE STORE'S, and the discs render from it, so this reads the store
         * and checks the discs agree. Reading only the DOM would report the paint; reading
         * only the store would not notice a rail that stopped rendering. */
        const { assignments } = screen.store.get().favourites;
        const discs = screen.shadowRoot.querySelectorAll('.assign-row ui-favourite-slot');
        if (discs.length !== 5) return [];
        return [0, 1, 2, 3, 4].map((slot) => assignments[slot] ?? null);
    },

    /**
     * Press one slot on the favourites strip.
     *
     * THE DETAIL CARRIES `slot`, WHICH IS 1-BASED, because <ui-favourites-bank> answers
     * with the mark a person reads rather than with an array index — and because an
     * EMPTY slot has no value to identify it by, which is the case the strip exists to
     * serve since the ruling ("if I select one and then press the favorite
     * button at the bottom it should change that favorite"). `index` rides along
     * unchanged: it is ui-bank's own word for the item's position.
     *
     * Answers the ASSIGNMENTS after the press, not the selection: a press assigns now.
     */
    async pickFavourite(slot = 0) {
        /* PRESS THE DISC, which is what the row is made of. It used
         * to read `.favourites` off a `<ui-favourites-bank>` and synthesise a `change`
         * event; the bank is gone, so both halves were reaching past the real control. */
        const disc = screen.shadowRoot.querySelectorAll('.assign-row ui-favourite-slot')[slot];
        disc.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
        /* THE WRITE IS ASYNC AND THE PRESS IS NOT. `setFavourite` persists through the
         * storage router before it patches the store, so a single `updateComplete`
         * returns the assignments as they were — which reads as "the press did nothing"
         * and is how this helper first reported a working assignment as a failure. Wait
         * for the map to actually change, with a bound so a real failure still fails. */
        const before = JSON.stringify(screen.store.get().favourites.assignments);
        for (let i = 0; i < 50; i += 1) {
            await screen.updateComplete;
            if (JSON.stringify(screen.store.get().favourites.assignments) !== before) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return screen.store.get().favourites.assignments;
    },

    /** Empty one slot, so the "add to favourites" branch has somewhere to land. */
    async clearFavourite(slot) {
        await screen.store.setFavourite(slot, null);
        await screen.updateComplete;
        return api.favourites();
    },

    /**
     * What the selected row's overflow menu offers right now.
     *
     * THE ROW MENU, because the detail pane's `<ui-menu id="actions">` is three worded
     * buttons ("Copy the previous skin"). `#actions` is a div now, its `.items`
     * is undefined, and the `|| []` swallowed that into an empty answer.
     */
    menuOffers() {
        const id = screen.store.get().selectedId;
        const host = screen.shadowRoot.getElementById(`opt-${id}`);
        const menu = host?.querySelector('ui-menu.row-menu')
            ?? screen.shadowRoot.querySelector('ui-menu.row-menu');
        return (menu?.items || []).map((i) => (i.separator ? '--' : i.id));
    },

    /**
     * Put the selected profile on a named slot, through the row's own menu.
     *
     * "ADD TO FAVOURITES" IS GONE, and with it the first-empty-slot rule it carried. The
     * row menu offers all five slots BY NUMBER, each labelled with what it currently holds
     * - which is the previous skin's design and is why the implicit version was redundant rather than
     * merely unreachable. So this names the slot instead of asking for "the next one".
     *
     * AND IT WAITS THE SAME WAY `pickFavourite` DOES, which it did not until 27 August
     * 2026. The paragraph above that helper spells the reason out — "THE WRITE IS ASYNC
     * AND THE PRESS IS NOT. `setFavourite` persists through the storage router before it
     * patches the store, so a single `updateComplete` returns the assignments as they
     * were" — and the lesson was learnt in one of the two helpers that press a favourite
     * and not in the other. This one slept a FIXED 30 ms and then read, which is a bet on
     * how long a round trip through the router takes rather than a wait for the thing it
     * is waiting for.
     *
     * WHAT IT COST, measured on before the fix: `test/render/
     * selector-core-loop.render.test.mjs` "an empty slot is a value, and every slot is
     * offered BY NUMBER" failed two runs in three ON AN IDLE BOX — `after[4]` came back
     * `null`, the pre-write map, and the failure read as "the named slot did not take it"
     * when the slot had taken it a few milliseconds after this helper stopped looking.
     * That is the worst shape a flake can have: it accuses the code under test of the one
     * thing the test exists to prove.
     *
     * BOUNDED, so a genuinely refused assignment still fails rather than hanging: the
     * duplicate guard legitimately refuses a profile the rail already holds, and this
     * helper must report that as an unchanged map and not as a timeout.
     */
    async addFavourite(slot = 4) {
        const id = screen.store.get().selectedId;
        const host = screen.shadowRoot.getElementById(`opt-${id}`);
        const menu = host?.querySelector('ui-menu.row-menu')
            ?? screen.shadowRoot.querySelector('ui-menu.row-menu');
        const before = JSON.stringify(screen.store.get().favourites.assignments);
        menu.dispatchEvent(new CustomEvent('select', {
            detail: { id: `assign:${slot + 1}` }, bubbles: true, composed: true,
        }));
        for (let i = 0; i < 50; i += 1) {
            await screen.updateComplete;
            if (JSON.stringify(screen.store.get().favourites.assignments) !== before) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await screen.updateComplete;
        return api.favourites();
    },

    /**
     * Press the band's Confirm. Returns the arm outcome.
     *
     * THERE IS NO SECOND PRESS, because "Pressing confirm in the profile
     * selector doesn close the page, just asks for confirmation." A button labelled
     * Confirm that opened a dialog asking you to confirm asked the same question twice,
     * and the previous skin's own Confirm writes the workflow and leaves. `dialogOpened` is
     * kept and answers `false`, so a caller that used to read it now reads the FACT
     * rather than an undefined.
     */
    async confirmLoad() {
        screen.shadowRoot.getElementById('confirm').click();
        await new Promise((r) => setTimeout(r, 60));
        await screen.updateComplete;
        return { dialogOpened: false, ...api.state() };
    },

    /**
     * Dismiss the refusal — the store's own word for it, and the same call the screen
     * makes at the point of asking again. A suite that measures the pane WITH and WITHOUT
     * the banner needs to be able to put the screen back.
     */
    async clearRefusal() {
        screen.store.clearRefusal();
        await screen.updateComplete;
        return api.state().refusal;
    },

    /** The refusal banner's rendered text, or null. */
    refusalText() {
        const banner = screen.shadowRoot.getElementById('refusal');
        if (!banner) return null;
        const box = banner.getBoundingClientRect();
        return {
            headline: banner.textContent.trim(),
            /* #49 declares no `kind` — its whole properties map is {_hasHeadline,
             * _hasRemedy} — so an attribute here would be the rule's "markup that does nothing".
             * Reported so the suite can assert the ABSENCE rather than trusting it. */
            kindAttr: banner.getAttribute('kind'),
            attributes: [...banner.attributes].map((a) => a.name).sort(),
            height: box.height,
            inDetailPane: Boolean(banner.closest('[slot="summary"]')),
        };
    },

    /** The rail as the store holds it, for choosing a subject the guard will accept. */
    rawFavourites() { return { ...screen.store.get().favourites.assignments }; },

    /** The listable records, for the same. */
    rawListable() {
        return screen.store.get().listable.map((r) => ({ id: r.id, title: r.profile?.title ?? '' }));
    },

    /**
     * Open the versions surface for the selected profile.
     *
     * THROUGH THE ROW MENU, because that is where the door is. It
     * used to dispatch on `#actions`, the detail pane's overflow menu; the "Copy the previous skin"
     * on the three-buttons question replaced that menu with Hide / Reset / Edit, so
     * `#actions` is now a div and a `select` event on it reaches no handler at all.
     *
     * IT DRIVES THE SELECTED ROW'S OWN MENU and not the first one on screen, because
     * `#onRowMenuSelect` is passed the row's id rather than reading the selection - a
     * different row's menu would open the lineage of a different profile and this test
     * would still see a dialog.
     */
    async versions() {
        const id = screen.store.get().selectedId;
        const host = screen.shadowRoot.getElementById(`opt-${id}`);
        const row = host?.querySelector('ui-menu.row-menu')
            ?? screen.shadowRoot.querySelector('ui-menu.row-menu');
        row.dispatchEvent(new CustomEvent('select', {
            detail: { id: 'versions' }, bubbles: true, composed: true,
        }));
        await new Promise((r) => setTimeout(r, 60));
        await screen.updateComplete;
        const dialog = screen.shadowRoot.getElementById('versions');
        return {
            open: dialog.open === true,
            status: screen.store.get().versions.status,
            rows: dialog.querySelectorAll('.dialog-list ui-list-row').length,
            text: dialog.querySelector('.dialog-list').textContent.trim(),
        };
    },

    /** — open the restore surface and report what it offers. */
    async openRestore() {
        const button = screen.shadowRoot.getElementById('restore-open');
        if (!button) return { present: false };
        button.click();
        await screen.updateComplete;
        const dialog = screen.shadowRoot.getElementById('restore');
        await dialog.updateComplete;
        return {
            present: true,
            open: dialog.open === true,
            offers: dialog.querySelectorAll('.dialog-list ui-button').length,
        };
    },

    /** Restore the first offer and report the round trip. */
    async restoreFirst() {
        const dialog = screen.shadowRoot.getElementById('restore');
        const button = dialog.querySelector('.dialog-list ui-button');
        if (!button) return null;
        const id = button.dataset.id;
        const filename = button.dataset.filename;
        button.click();
        await new Promise((r) => setTimeout(r, 200));
        await screen.updateComplete;
        return { id, filename, ...api.state() };
    },

    /**
     * THE SUMMARY STRIP AS A PERSON SEES IT, in the order it is painted.
     *
     * READ THROUGH THE TILE'S OWN SHADOW ROOT, not off the bound attribute, because the
     * claim `cmp-seh-1` is about is what the strip SAYS. An absent reading is the tile's
     * own dash plus its own "no reading" sentence for a screen reader, and neither of
     * those is visible from outside #34 — an attribute probe would report `value=""` and
     * call it an answer, which is exactly the difference between a value the profile does
     * not state and a value the strip failed to paint.
     */
    tiles() {
        return [...screen.shadowRoot.querySelectorAll('#summary ui-stat-tile')].map((tile) => {
            const inner = tile.shadowRoot;
            return {
                key: tile.dataset.tile,
                label: (inner.getElementById('label').textContent || '').trim(),
                value: tile.getAttribute('value') ?? '',
                unit: tile.getAttribute('unit') ?? '',
                /* What is painted where the number goes: the reading, or the dash. */
                reading: (inner.getElementById('reading').textContent || '').trim(),
                /* The dash is aria-hidden and a sentence stands in its place. */
                spokenUnit: (inner.getElementById('unit')?.textContent || '').trim(),
                absent: Boolean(inner.getElementById('a11y')),
            };
        });
    },

    /** Select by the profile's own title — the fixture record a test names, not row 0. */
    async selectByTitle(title) {
        const record = (screen.store.get().records || [])
            .find((r) => r?.profile?.title === title);
        if (!record) return null;
        screen.store.select(record.id);
        await screen.updateComplete;
        return record.id;
    },

    /** The detail pane's numbers and notes, for the select half of the loop. */
    detail() {
        const root = screen.shadowRoot;
        const card = root.getElementById('preview');
        return {
            title: root.getElementById('detail-title').textContent.trim(),
            tiles: api.tiles(),
            notes: (root.getElementById('notes').value || '').slice(0, 40),
            chartEmpty: card.hasAttribute('empty'),
            series: card.derivation?.ok ? card.derivation.series.targetPressure.x.length : 0,
            stepMarks: card.derivation?.ok ? card.derivation.stepMarks.length : 0,
        };
    },

    /** — the plot host's own inset, measured, and the frame's beside it. */
    chartHost() {
        const card = screen.shadowRoot.getElementById('preview');
        const root = card.shadowRoot;
        const plot = root.querySelector('[part="plot"]');
        const frame = root.querySelector('[part="frame"]');
        const well = root.querySelector('[part="well"]');
        const s = getComputedStyle(plot);
        const f = getComputedStyle(frame);
        return {
            plotPadding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft],
            framePadding: [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft],
            plotWidth: plot.clientWidth,
            plotHeight: plot.clientHeight,
            wellWidth: well.clientWidth,
            wellHeight: well.clientHeight,
            canvasWidth: root.querySelector('canvas') ? root.querySelector('canvas').clientWidth : 0,
        };
    },
};

globalThis.__sel = api;
ready = Promise.resolve(true);

}
