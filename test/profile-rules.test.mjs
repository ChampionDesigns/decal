
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    FALLBACK_PROFILE_TITLES,
    FAVOURITES_KEY,
    FAVOURITES_SEEDED_KEY,
    FAVOURITE_SLOT_COUNT,
    PROFILE_LISTING_QUERY,
    ProfileRulesError,
    TAG_PREFIX_PATTERN,
    UNTITLED_PROFILE_KEY,
    autoPopulateFavourites,
    createMetadataWriteChain,
    emptyAssignments,
    isEmptyAssignments,
    isListable,
    loadFavouriteAssignments,
    loadLoadedProfileId,
    LOADED_PROFILE_KEY,
    partitionProfiles,
    readProfileListing,
    restorableProfiles,
    rememberedRecord,
    saveFavouriteAssignments,
    saveLoadedProfileId,
    seedFavouriteSlots,
    FAVOURITE_HEAL_BASIS,
    livingFavouriteTarget,
    healFavouriteAssignments,
    shortProfileTitle,
    shouldAutoPopulate,
    stripCategoryPrefix,
    stripRemainingDelimiter,
    stripTagPrefix,
} from '../src/lib/profile-rules.js';
import { PROFILE_VISIBILITY } from '../src/data/rea-profile.js';
import { readReaFile } from '../scripts/lib/rea-source.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE = JSON.parse(readFileSync(
    `${REPO}tools/rea-fixtures/api__v1__profiles~includeHidden=true.json`, 'utf8'));

const record = (id, title, extra = {}) => ({
    id,
    profile: { title, version: '2', steps: [] },
    visibility: PROFILE_VISIBILITY.VISIBLE,
    isDefault: false,
    parentId: null,
    metadata: null,
    ...extra,
});

/** `{ok,status,data}` built by hand: those three fields ARE the routes/consumer contract. */
const ok = (data, extra = {}) => ({ ok: true, status: 200, data, notModified: false, ...extra });
const httpFail = (status, problem = null) => ({
    ok: false, kind: 'http', status, message: `-> ${status}`, problem,
});

function recordingTransport(responder) {
    const calls = [];
    return {
        calls,
        async request(path, options = {}) {
            const call = { path, ...options };
            calls.push(call);
            return responder(call, calls.length - 1);
        },
    };
}

function recordingLogger() {
    const lines = [];
    const self = {
        debug: (...a) => lines.push(['debug', ...a]),
        info: (...a) => lines.push(['info', ...a]),
        warn: (...a) => lines.push(['warn', ...a]),
        error: (...a) => lines.push(['error', ...a]),
        scope: () => self,
        lines,
    };
    return self;
}

/** A KV backend that fails its first `writesToFail` writes and then recovers. */
function flakyBackend(writesToFail) {
    const store = new Map();
    let writes = 0;
    return {
        store,
        get writes() { return writes; },
        async get(key) { return store.get(key); },
        async set(key, value) {
            writes += 1;
            if (writes <= writesToFail) throw new Error('KV unavailable');
            store.set(key, value);
        },
        async remove(key) { store.delete(key); },
    };
}

const routerOver = (kv, logger) => createStorageRouter({
    backends: { [LAYERS.kv]: kv, [LAYERS.local]: createMemoryBackend(), [LAYERS.session]: createMemoryBackend(), [LAYERS.kvNumpad]: createMemoryBackend() },
    logger,
});

const titlesOf = (records) => records.map((r) => r.profile.title);

describe('rule 1 — soft-deleted and hidden profiles are filtered from listings', () => {
    test('both named states are dropped and everything else lists', () => {
        assert.equal(isListable(record('a', 'A')), true);
        assert.equal(isListable(record('b', 'B', { visibility: PROFILE_VISIBILITY.HIDDEN })), false);
        assert.equal(isListable(record('c', 'C', { visibility: PROFILE_VISIBILITY.DELETED })), false);
    });

    test('a visibility this build has not seen is LISTED and COUNTED, never silently dropped', () => {
        const parts = partitionProfiles([record('a', 'A'), record('x', 'X', { visibility: 'quarantined' })]);
        assert.deepEqual(parts.listable.map((r) => r.id), ['a', 'x']);
        assert.deepEqual(parts.unknown.map((r) => r.id), ['x']);
    });

    test('the four buckets are exhaustive and disjoint', () => {
        const all = [
            record('v', 'V'),
            record('h', 'H', { visibility: PROFILE_VISIBILITY.HIDDEN }),
            record('d', 'D', { visibility: PROFILE_VISIBILITY.DELETED }),
        ];
        const p = partitionProfiles(all);
        assert.equal(p.listable.length + p.hidden.length + p.deleted.length, all.length);
        assert.deepEqual(p.hidden.map((r) => r.id), ['h']);
        assert.deepEqual(p.deleted.map((r) => r.id), ['d']);
    });

    test('MEASURED on the recorded listing: 147 records, 78 listable, 69 hidden, 0 deleted', () => {
        const p = partitionProfiles(FIXTURE);
        assert.equal(p.all.length, 147);
        assert.equal(p.listable.length, 78);
        assert.equal(p.hidden.length, 69);
        assert.equal(p.deleted.length, 0);
        assert.equal(p.unknown.length, 0, 'the fixture uses only the three documented spellings');
    });

    test('restore-to-factory (D6) reads the hidden bundled records the same listing carries', () => {
        const restorable = restorableProfiles(FIXTURE);
        assert.ok(restorable.length > 0, 'DELETE on a bundled profile HIDES it — that set is what D6 offers back');
        assert.ok(restorable.every((r) => r.isDefault === true && r.visibility === PROFILE_VISIBILITY.HIDDEN));
    });

    test('the listing is read with includeHidden=true and NOTHING else', async () => {
        const transport = recordingTransport(() => ok(FIXTURE));
        const result = await readProfileListing(transport);
        assert.equal(transport.calls.length, 1);
        assert.equal(transport.calls[0].path, '/profiles');
        assert.equal(transport.calls[0].method, 'GET');
        assert.deepEqual(transport.calls[0].query, { includeHidden: true });
        assert.deepEqual(Object.keys(PROFILE_LISTING_QUERY), ['includeHidden'],
            'parentId WINS over the other two at the handler — do not send it alongside a filter');
        assert.equal(result.ok, true);
        assert.equal(result.listable.length, 78);
    });

    test('a 304 is an ordinary answer — the transport already replayed the stored body', async () => {
        const transport = recordingTransport(() => ok(FIXTURE, { status: 304, notModified: true }));
        const result = await readProfileListing(transport);
        assert.equal(result.ok, true);
        assert.equal(result.notModified, true);
        assert.equal(result.listable.length, 78);
    });

    test('a transport failure is reported as one, with the envelope intact', async () => {
        const failure = httpFail(500);
        const result = await readProfileListing(recordingTransport(() => failure));
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'transport');
        assert.equal(result.failure, failure);
        assert.deepEqual(result.listable, []);
    });

    test('a 200 whose body is not an array is NOT an empty listing', async () => {
        const result = await readProfileListing(recordingTransport(() => ok({ profiles: [] })));
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'shape');
        assert.equal(result.failure, null);
    });

    test('an empty listing IS a real answer', async () => {
        const result = await readProfileListing(recordingTransport(() => ok([])));
        assert.equal(result.ok, true);
        assert.deepEqual(result.listable, []);
    });
});

describe('rule 2 — the three-step title-prefix stripping ladder', () => {
    test('step 1: a SPACED delimiter is a category; keep the tail', () => {
        assert.equal(stripCategoryPrefix('A-Flow / default-dark'), 'default-dark');
        assert.equal(stripCategoryPrefix('D-Flow / default'), 'default');
        assert.equal(stripCategoryPrefix('Baseline • Ultra Low Contact'), 'Ultra Low Contact');
    });

    test('step 1 declines an unspaced slash — that is step 2 and step 3\'s question', () => {
        assert.equal(stripCategoryPrefix('GHC/manual flow control'), 'GHC/manual flow control');
        assert.equal(stripCategoryPrefix('Light/Medium'), 'Light/Medium');
    });

    test('step 1 declines a half it cannot name — profile-folders owns that rule', () => {
        assert.equal(stripCategoryPrefix('Trailing / '), 'Trailing /');
        assert.equal(stripCategoryPrefix(' / Leading'), '/ Leading');
    });

    test('step 1 splits at the FIRST delimiter, so a two-bullet title keeps its leaf whole', () => {
        assert.equal(stripCategoryPrefix('Baseline • Medium Contact • 6 Bar'), 'Medium Contact • 6 Bar');
    });

    test('step 2: a 2+ uppercase/digit tag prefix goes', () => {
        assert.equal(stripTagPrefix('GHC/manual pressure control'), 'manual pressure control');
        assert.equal(stripTagPrefix('DE1/Espresso'), 'Espresso');
        assert.equal(stripTagPrefix('V60 / something'), 'something');
    });

    test('step 2 COUNTEREXAMPLES: one uppercase letter, or mixed case, is not a tag', () => {
        assert.equal(stripTagPrefix('A/B testing'), 'A/B testing');
        assert.equal(stripTagPrefix('Light/Medium'), 'Light/Medium');
        assert.equal(TAG_PREFIX_PATTERN.test('A/B testing'), false);
        assert.equal(TAG_PREFIX_PATTERN.test('Light/Medium'), false);
    });

    test('step 3: any remaining SLASH is a category too', () => {
        assert.equal(stripRemainingDelimiter('Tea portafilter/Yunnan green'), 'Yunnan green');
        assert.equal(stripRemainingDelimiter('Pour over basket/V60 22g in, 375g out'), 'V60 22g in, 375g out');
        assert.equal(stripRemainingDelimiter('Espresso'), 'Espresso');
    });

    test('step 3 is SLASH-only, so it cannot peel a second bullet off a leaf', () => {
        assert.equal(stripRemainingDelimiter('Medium Contact • 6 Bar'), 'Medium Contact • 6 Bar');
    });

    test('the ladder end to end', () => {
        assert.equal(shortProfileTitle('A-Flow / default-dark'), 'default-dark');
        assert.equal(shortProfileTitle('GHC/manual flow control'), 'manual flow control');
        assert.equal(shortProfileTitle('Tea portafilter/Yunnan green'), 'Yunnan green');
        assert.equal(shortProfileTitle('Baseline • Medium Contact • 6 Bar'), 'Medium Contact • 6 Bar');
        assert.equal(shortProfileTitle('Extractamundo Dos!'), 'Extractamundo Dos!');
    });

    test('RECORDED: step 3 takes the tail of both step-2 counterexamples, as the source does', () => {
        assert.equal(shortProfileTitle('A/B testing'), 'B testing');
        assert.equal(shortProfileTitle('Light/Medium'), 'Medium');
    });

    test('MEASURED: step 2 has no unique effect on the recorded library', () => {
        const titles = [...new Set(titlesOf(FIXTURE))];
        assert.equal(titles.length, 77);
        const tagged = titles.filter((t) => TAG_PREFIX_PATTERN.test(t));
        assert.deepEqual(tagged.sort(), ['GHC/manual flow control', 'GHC/manual pressure control']);
        for (const title of tagged) {
            const withoutStep2 = stripRemainingDelimiter(stripCategoryPrefix(title));
            assert.equal(withoutStep2, shortProfileTitle(title));
        }
    });

    test('MEASURED: no recorded title carries two slashes, so first-vs-last is unobservable there', () => {
        const twoSlashes = [...new Set(titlesOf(FIXTURE))].filter((t) => t.split('/').length > 2);
        assert.deepEqual(twoSlashes, []);
    });

    test('MEASURED: every recorded title still has a label after the ladder', () => {
        const empty = [...new Set(titlesOf(FIXTURE))].filter((t) => shortProfileTitle(t) === '');
        assert.deepEqual(empty, []);
    });

    test('a title that strips to nothing returns \'\' — the wording is a screen\'s', () => {
        assert.equal(shortProfileTitle(''), '');
        assert.equal(shortProfileTitle(null), '');
        assert.equal(shortProfileTitle('   '), '');
        assert.equal(UNTITLED_PROFILE_KEY, 'Untitled');
    });
});

describe('rule 3 — metadata writes serialize through one chain', () => {
    const base = () => record('profile:abc', 'Some profile', { metadata: { dose: 18 } });

    /** A transport that holds each PUT open for a tick and answers with the merged record. */
    function slowPutTransport({ failAt = -1 } = {}) {
        const bodies = [];
        let inFlight = 0;
        let peak = 0;
        const transport = {
            bodies,
            get peak() { return peak; },
            async request(path, options = {}) {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                bodies.push({ path, method: options.method, body: options.body });
                await new Promise((resolve) => setTimeout(resolve, 5));
                inFlight -= 1;
                if (bodies.length - 1 === failAt) return httpFail(500);
                return ok({ ...base(), metadata: options.body.metadata });
            },
        };
        return transport;
    }

    test('two concurrent writers do not interleave, and the second reads the first\'s result', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        const first = chain.mutate(base(), (meta) => ({ ...meta, grinderSetting: '4.2' }));
        const second = chain.mutate(base(), (meta) => ({ ...meta, targetYield: 36 }));
        await Promise.all([first, second]);

        assert.equal(transport.bodies.length, 2);
        assert.equal(transport.peak, 1, 'two PUTs were in flight at once — the chain did not serialize');
        assert.equal(chain.peakConcurrency(), 1);
        assert.deepEqual(transport.bodies[0].body, { metadata: { dose: 18, grinderSetting: '4.2' } });
        assert.deepEqual(transport.bodies[1].body, { metadata: { dose: 18, grinderSetting: '4.2', targetYield: 36 } });
    });

    test('ten concurrent writers all land, in order, each on the last one\'s result', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        const runs = [];
        for (let i = 0; i < 10; i += 1) runs.push(chain.mutate(base(), (meta) => ({ ...meta, [`k${i}`]: i })));
        await Promise.all(runs);
        assert.equal(transport.peak, 1);
        assert.equal(transport.bodies.length, 10);
        assert.deepEqual(
            Object.keys(transport.bodies[9].body.metadata).sort(),
            ['dose', 'k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'].sort(),
            'the tenth write carries all nine before it — nothing was clobbered',
        );
    });

    test('a failed write does not wedge the queue', async () => {
        const transport = slowPutTransport({ failAt: 0 });
        const chain = createMetadataWriteChain({ transport, logger: recordingLogger() });
        const first = await chain.mutate(base(), (meta) => ({ ...meta, a: 1 }));
        const second = await chain.mutate(base(), (meta) => ({ ...meta, b: 2 }));
        assert.equal(first.ok, false);
        assert.equal(second.ok, true);
        // The failed write left no phantom: the second reads the record it started from.
        assert.deepEqual(transport.bodies[1].body, { metadata: { dose: 18, b: 2 } });
        assert.equal(chain.pending(), 0);
    });

    test('the body is metadata-only — no `profile` key, so the id and the hashes do not move', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await chain.mutate(base(), (meta) => ({ ...meta, note: 'x' }));
        assert.deepEqual(Object.keys(transport.bodies[0].body), ['metadata']);
        assert.equal(transport.bodies[0].method, 'PUT');
    });

    test('the id reaches the path percent-encoded — record ids carry a colon', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await chain.mutate(base(), (meta) => meta);
        assert.equal(transport.bodies[0].path, '/profiles/profile%3Aabc');
    });

    test('`null` from a transform is REFUSED — it does not clear, it silently keeps', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await assert.rejects(
            () => chain.mutate(base(), () => null),
            (error) => error instanceof ProfileRulesError && /return \{\} to clear/.test(error.message),
        );
        assert.equal(transport.bodies.length, 0, 'nothing was sent');
        // And the queue is still usable after the refusal.
        const after = await chain.mutate(base(), () => ({}));
        assert.equal(after.ok, true);
        assert.deepEqual(transport.bodies[0].body, { metadata: {} });
    });

    test('clearing IS expressible — an empty map replaces the stored one wholesale', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await chain.mutate(base(), () => ({}));
        assert.deepEqual(transport.bodies[0].body, { metadata: {} });
    });

    test('a Profile handed where a ProfileRecord belongs is refused — the rename bug, structurally', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await assert.rejects(
            () => chain.mutate({ title: 'Not a record', steps: [] }, (meta) => meta),
            (error) => error instanceof ProfileRulesError && /has no id/.test(error.message),
        );
        assert.equal(transport.bodies.length, 0);
    });

    test('two DIFFERENT profiles share the one queue and each reads its OWN base', async () => {
        const transport = slowPutTransport();
        const chain = createMetadataWriteChain({ transport });
        await Promise.all([
            chain.mutate(record('profile:one', 'One', { metadata: { a: 1 } }), (m) => ({ ...m, x: 1 })),
            chain.mutate(record('profile:two', 'Two', { metadata: { b: 2 } }), (m) => ({ ...m, y: 2 })),
        ]);
        assert.deepEqual(transport.bodies[0].body, { metadata: { a: 1, x: 1 } });
        assert.deepEqual(transport.bodies[1].body, { metadata: { b: 2, y: 2 } },
            'the second read its OWN record, not the first profile\'s response');
    });

    test('a transport is required', () => {
        assert.throws(() => createMetadataWriteChain({}), ProfileRulesError);
    });
});

describe('rule 3\'s premise, re-read at the pin', () => {
    const dart = (rel) => readReaFile(rel).text;

    test('a supplied metadata map REPLACES wholesale — there is no server-side merge', () => {
        const record = dart('lib/src/models/data/profile_record.dart');
        assert.match(record, /metadata:\s*metadata \?\? this\.metadata,/);
        const controller = dart('lib/src/controllers/profile_controller.dart');
        assert.match(controller, /existing\.copyWith\(profile: profile, metadata: metadata\)/);
    });

    test('`metadata: null` therefore KEEPS the stored map — which is why a null transform is refused', () => {
        const record = dart('lib/src/models/data/profile_record.dart');
        assert.ok(!/metadata:\s*null/.test(record), 'nothing in copyWith clears the metadata');
    });

    test('a metadata-only body keeps the id, because the hashes come from the unchanged profile', () => {
        const record = dart('lib/src/models/data/profile_record.dart');
        assert.match(record, /final newProfile = profile \?\? this\.profile;/);
        assert.match(record, /final hashes = ProfileHash\.calculateAll\(newProfile\);/);
    });

    test('a bundled profile refuses CONTENT edits and accepts metadata ones', () => {
        const controller = dart('lib/src/controllers/profile_controller.dart');
        assert.match(controller, /if \(existing\.isDefault && profile != null\) \{\s*throw ArgumentError\('Cannot modify default profile content'\)/);
    });

    test('DELETE is a soft delete, and on a bundled profile it is a HIDE — rule 1\'s premise', () => {
        const controller = dart('lib/src/controllers/profile_controller.dart');
        assert.match(controller, /if \(existing\.isDefault\) \{\s*final hidden = existing\.copyWith\(visibility: Visibility\.hidden\)/);
        assert.match(controller, /final deleted = existing\.copyWith\(visibility: Visibility\.deleted\)/);
    });

    test('the listing handler serves both back when includeHidden is on', () => {
        const handler = dart('lib/src/services/webserver/profile_handler.dart');
        assert.match(handler, /final includeHidden = params\['includeHidden'\] == 'true';/);
        assert.match(handler, /return jsonOkConditional\(/);
    });

    test('the three visibility spellings are the handler\'s, not ours', () => {
        const record = dart('lib/src/models/data/profile_record.dart');
        assert.match(record, /enum Visibility \{ visible, hidden, deleted \}/);
        assert.deepEqual(Object.values(PROFILE_VISIBILITY), ['visible', 'hidden', 'deleted']);
    });
});

describe('rule 4 — fallback titles, so first launch is never an empty rail', () => {
    test('the five titles are transcribed verbatim', () => {
        assert.deepEqual([...FALLBACK_PROFILE_TITLES], [
            'Default',
            'Best practice (light roast)',
            "80's Espresso",
            'Rao Allongé',
            'Gentle and sweet',
        ]);
        assert.equal(FAVOURITE_SLOT_COUNT, 5);
    });

    test('MEASURED: the named titles are unique on the FILTERED listing and ambiguous on the raw one', () => {
        const count = (records, title) => records
            .filter((r) => r.profile.title.toLowerCase() === title.toLowerCase()).length;
        const listable = partitionProfiles(FIXTURE).listable;
        for (const title of FALLBACK_PROFILE_TITLES) {
            assert.equal(count(listable, title), 1, `${title} should resolve to exactly one listable record`);
        }
        const ambiguous = FALLBACK_PROFILE_TITLES.filter((t) => count(FIXTURE, t) > 1);
        assert.deepEqual(ambiguous, ['Default', 'Gentle and sweet'],
            'seeding from the unfiltered listing would put a superseded record in 2 of 5 slots');
    });

    test('stage 1 fills every slot from the recorded listing, by position', () => {
        const listable = partitionProfiles(FIXTURE).listable;
        const { assignments, stage, filled } = seedFavouriteSlots(listable);
        assert.equal(stage, 'named');
        assert.equal(filled, 5);
        const byId = new Map(listable.map((r) => [r.id, r.profile.title]));
        for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
            assert.equal(byId.get(assignments[slot]), FALLBACK_PROFILE_TITLES[slot]);
        }
    });

    test('a title that does not resolve leaves ITS OWN slot empty and does not shuffle the rest', () => {
        const listing = [record('profile:d', 'Default'), record('profile:g', 'Gentle and sweet')];
        const { assignments, stage, filled } = seedFavouriteSlots(listing);
        assert.equal(stage, 'named');
        assert.equal(filled, 2);
        assert.deepEqual(assignments, {
            0: 'profile:d', 1: null, 2: null, 3: null, 4: 'profile:g',
        });
    });

    test('stage 2: not one named title on the machine falls back to the first N alphabetically', () => {
        const listing = [
            record('profile:z', 'Zulu'), record('profile:a', 'Alpha'),
            record('profile:m', 'Mike'), record('profile:b', 'Bravo'),
        ];
        const { assignments, stage } = seedFavouriteSlots(listing);
        assert.equal(stage, 'alphabetical');
        assert.deepEqual(assignments, {
            0: 'profile:a', 1: 'profile:b', 2: 'profile:m', 3: 'profile:z', 4: null,
        });
    });

    test('no profiles at all is `empty` — a rail with nothing to put on it', () => {
        const { assignments, stage } = seedFavouriteSlots([]);
        assert.equal(stage, 'empty');
        assert.equal(isEmptyAssignments(assignments), true);
    });

    test('the ranker seam runs first and ignores ids that are not in the listing', () => {
        const listing = [record('profile:a', 'Alpha'), record('profile:b', 'Bravo')];
        const { assignments, stage } = seedFavouriteSlots(listing, {
            rank: () => ['profile:b', 'profile:gone', 'profile:a'],
        });
        assert.equal(stage, 'ranked');
        assert.deepEqual(assignments, { 0: 'profile:b', 1: 'profile:a', 2: null, 3: null, 4: null });
    });

    test('a ranker that resolves to nothing falls through to the named titles', () => {
        const listing = [record('profile:d', 'Default')];
        const { assignments, stage } = seedFavouriteSlots(listing, { rank: () => ['profile:gone'] });
        assert.equal(stage, 'named');
        assert.equal(assignments[0], 'profile:d');
    });

    test('an empty rail is spelled one way, and an absent slot is empty', () => {
        assert.deepEqual(emptyAssignments(3), { 0: null, 1: null, 2: null });
        assert.equal(isEmptyAssignments(emptyAssignments()), true);
        assert.equal(isEmptyAssignments({}), true);
        assert.equal(isEmptyAssignments(null), true);
        assert.equal(isEmptyAssignments({ 0: null, 3: 'profile:x' }), false);
    });
});

describe('rule 5 — auto-populate marks itself retryable', () => {
    const listing = () => [record('profile:d', 'Default'), record('profile:g', 'Gentle and sweet')];

    test('a user save marks the rail user-initialised', async () => {
        const kv = flakyBackend(0);
        const storage = routerOver(kv);
        const result = await saveFavouriteAssignments(storage, { 0: 'profile:d' });
        assert.deepEqual(result, { ok: true, saved: true, marked: true, retryable: false });
        assert.equal(await storage.get(FAVOURITES_SEEDED_KEY), true);
    });

    test('auto-populate does NOT mark it — that is the whole rule', async () => {
        const kv = flakyBackend(0);
        const storage = routerOver(kv);
        const result = await saveFavouriteAssignments(storage, { 0: 'profile:d' }, { markUserInitialized: false });
        assert.deepEqual(result, { ok: true, saved: true, marked: false, retryable: true });
        assert.equal(await storage.get(FAVOURITES_SEEDED_KEY), undefined);
        assert.deepEqual(await storage.get(FAVOURITES_KEY), { 0: 'profile:d' });
    });

    test('the marker is NEVER written on the strength of a write that failed', async () => {
        const logger = recordingLogger();
        const kv = flakyBackend(1);
        const storage = routerOver(kv, logger);
        const result = await saveFavouriteAssignments(storage, { 0: 'profile:d' }, { logger });
        assert.deepEqual(result, { ok: false, saved: false, marked: false, retryable: true });
        assert.equal(await storage.get(FAVOURITES_SEEDED_KEY), undefined);
        assert.equal(kv.writes, 1, 'the marker write was not even attempted');
    });

    test('shouldAutoPopulate: empty AND never chosen', () => {
        assert.equal(shouldAutoPopulate({ assignments: emptyAssignments(), seeded: false }), true);
        assert.equal(shouldAutoPopulate({ assignments: emptyAssignments(), seeded: true }), false,
            'somebody cleared every slot on purpose — respect it');
        assert.equal(shouldAutoPopulate({ assignments: { 0: 'profile:d' }, seeded: false }), false);
    });

    test('THE RETRY PATH: a failing first launch, then a recovering second', async () => {
        const logger = recordingLogger();
        const kv = flakyBackend(1);            // the first write fails, everything after works
        const storage = routerOver(kv, logger);

        // Launch 1 — nothing stored, nothing marked, so it seeds. The write fails.
        const first = await loadFavouriteAssignments(storage);
        assert.equal(shouldAutoPopulate(first), true);
        const run1 = await autoPopulateFavourites({ storage, records: listing(), logger });
        assert.equal(run1.ran, true);
        assert.equal(run1.stage, 'named');
        assert.equal(run1.save.saved, false);
        assert.equal(run1.retryable, true);

        // Launch 2 — the failed run left NO trace, so the same decision is taken again.
        const second = await loadFavouriteAssignments(storage);
        assert.equal(second.seeded, false);
        assert.equal(shouldAutoPopulate(second), true, 'a failed populate must not look like a user choice');
        const run2 = await autoPopulateFavourites({ storage, records: listing(), logger });
        assert.equal(run2.save.saved, true);
        assert.equal(run2.save.marked, false, 'still unmarked — the slots themselves are what stop the next run');

        // Launch 3 — the rail is populated, so nothing re-seeds even though the flag is unset.
        const third = await loadFavouriteAssignments(storage);
        assert.equal(third.seeded, false);
        assert.equal(isEmptyAssignments(third.assignments), false);
        assert.equal(shouldAutoPopulate(third), false);
        assert.deepEqual(third.assignments, { 0: 'profile:d', 1: null, 2: null, 3: null, 4: 'profile:g' });
    });

    test('auto-populate seeds from the LISTABLE half of a raw listing', async () => {
        const kv = flakyBackend(0);
        const storage = routerOver(kv);
        const raw = [
            record('profile:hidden-default', 'Default', { visibility: PROFILE_VISIBILITY.HIDDEN }),
            record('profile:visible-default', 'Default'),
        ];
        const run = await autoPopulateFavourites({ storage, records: raw });
        assert.equal(run.assignments[0], 'profile:visible-default');
    });

    test('nothing to seed from writes nothing at all', async () => {
        const kv = flakyBackend(0);
        const storage = routerOver(kv);
        const run = await autoPopulateFavourites({ storage, records: [] });
        assert.equal(run.ran, false);
        assert.equal(run.stage, 'empty');
        assert.equal(kv.writes, 0);
        assert.equal(run.retryable, true);
    });

    test('a stored rail that is not an object is not trusted as one', async () => {
        const kv = flakyBackend(0);
        const storage = routerOver(kv);
        await kv.set('favouriteProfiles', ['profile:d']);
        const loaded = await loadFavouriteAssignments(storage);
        assert.equal(loaded.stored, null);
        assert.deepEqual(loaded.assignments, emptyAssignments());
    });
});

describe('the remembered profile id — the fact R1 cannot recover from a title', () => {
    const records = [
        { id: 'profile:a', profile: { title: 'Extractamundo Dos!' } },
        { id: 'profile:b', profile: { title: 'Extractamundo Dos!' } },
        { id: 'profile:c', profile: { title: 'Lever Classic' } },
    ];

    test('it round-trips through the KV layer', async () => {
        const storage = routerOver(createMemoryBackend());
        assert.equal(await loadLoadedProfileId(storage), null, 'nothing remembered yet');
        assert.equal(await saveLoadedProfileId(storage, 'profile:b'), true);
        assert.equal(await storage.get(LOADED_PROFILE_KEY), 'profile:b');
        assert.equal(await loadLoadedProfileId(storage), 'profile:b');
    });

    test('an empty id is not written — an absence must not become a stored empty string', async () => {
        const storage = routerOver(createMemoryBackend());
        assert.equal(await saveLoadedProfileId(storage, ''), false);
        assert.equal(await saveLoadedProfileId(storage, null), false);
        assert.equal(await loadLoadedProfileId(storage), null);
    });

    test('IT RESOLVES WHAT THE TITLE CANNOT: two records, one title, one right answer', () => {
        /* R1 answers `ambiguous` here and is right to — eleven records share one title on
         * the bench machine. The remembered id is the fact the skin already had. */
        assert.equal(rememberedRecord(records, 'profile:b', 'Extractamundo Dos!').id, 'profile:b');
    });

    test('THE TITLE IS STILL THE CHECK, so a profile loaded by something else is not claimed', () => {
        assert.equal(rememberedRecord(records, 'profile:c', 'Extractamundo Dos!'), null);
        assert.equal(rememberedRecord(records, 'profile:gone', 'Extractamundo Dos!'), null);
    });

    test('no title, no listing, no id — three absences, all null and none a guess', () => {
        assert.equal(rememberedRecord(records, 'profile:a', null), null);
        assert.equal(rememberedRecord(records, 'profile:a', ''), null);
        assert.equal(rememberedRecord(null, 'profile:a', 'Extractamundo Dos!'), null);
        assert.equal(rememberedRecord(records, null, 'Extractamundo Dos!'), null);
    });
});

const hidden = (id, title, extra = {}) => record(id, title, {
    visibility: PROFILE_VISIBILITY.HIDDEN, ...extra,
});

describe('rule 6 — a favourite slot never points at a record the library is hiding', () => {
    test('a VISIBLE record is left exactly where it is', () => {
        const records = [record('p:a', 'Lever Classic')];
        const answer = livingFavouriteTarget(records, 'p:a');
        assert.equal(answer.id, 'p:a');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.VISIBLE);
        assert.equal(answer.moved, false);
    });

    test('THE FORWARD SHAPE: a superseded parent resolves to its visible child', () => {
        const records = [
            hidden('p:old', 'Pressure Tuning', { createdAt: '2026-08-27T10:59:10' }),
            record('p:new', 'Pressure Tuning', { parentId: 'p:old', createdAt: '2026-08-27T19:14:56' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:old');
        assert.equal(answer.id, 'p:new');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.DESCENDANT);
        assert.equal(answer.moved, true);
    });

    test('a chain of hidden records resolves to the visible tip, not the first child', () => {
        const records = [
            hidden('p:0', 'P', { createdAt: '2026-08-27T10:00:00' }),
            hidden('p:1', 'P', { parentId: 'p:0', createdAt: '2026-08-27T11:00:00' }),
            hidden('p:2', 'P', { parentId: 'p:1', createdAt: '2026-08-27T12:00:00' }),
            record('p:3', 'P', { parentId: 'p:2', createdAt: '2026-08-27T13:00:00' }),
        ];
        assert.equal(livingFavouriteTarget(records, 'p:0').id, 'p:3');
    });

    test('a BRANCHING subtree takes the newest visible record by createdAt', () => {
        const records = [
            hidden('p:root', 'Pressure Tuning', { createdAt: '2026-08-27T10:59:10' }),
            record('p:early', 'Pressure Tuning', { parentId: 'p:root', createdAt: '2026-08-27T11:39:06' }),
            hidden('p:mid', 'Pressure Tuning', { parentId: 'p:root', createdAt: '2026-08-27T11:45:25' }),
            record('p:deep', 'Pressure Tuning', { parentId: 'p:mid', createdAt: '2026-08-27T19:14:56' }),
            record('p:middling', 'Pressure Tuning', { parentId: 'p:mid', createdAt: '2026-08-27T15:56:08' }),
        ];
        assert.equal(livingFavouriteTarget(records, 'p:root').id, 'p:deep');
    });

    test('createdAt decides, NOT updatedAt — a re-shown old version must not outrank a new one', () => {
        const records = [
            hidden('p:root', 'P', { createdAt: '2026-08-27T10:00:00' }),
            record('p:old', 'P', {
                parentId: 'p:root', createdAt: '2026-08-27T11:00:00', updatedAt: '2026-08-27T23:59:00',
            }),
            record('p:new', 'P', {
                parentId: 'p:root', createdAt: '2026-08-27T20:00:00', updatedAt: '2026-08-27T20:00:00',
            }),
        ];
        assert.equal(livingFavouriteTarget(records, 'p:root').id, 'p:new',
            'the newest BORN version wins; updatedAt moves on a visibility flip alone');
    });

    test('THE BACKWARD SHAPE: a hidden dead end resolves UP to its visible parent', () => {
        const records = [
            hidden('p:gran', 'Extractamundo Dos! (2)', { createdAt: '2026-08-23T08:18:27' }),
            record('p:parent', 'Extractamundo Dos! (2)', {
                parentId: 'p:gran', createdAt: '2026-08-23T09:16:39', updatedAt: '2026-08-27T20:28:48',
            }),
            hidden('p:child', 'Extractamundo Dos! (2)', {
                parentId: 'p:parent', createdAt: '2026-08-27T20:28:17', updatedAt: '2026-08-27T20:28:48',
            }),
        ];
        const answer = livingFavouriteTarget(records, 'p:child');
        assert.equal(answer.id, 'p:parent');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.ANCESTOR);
        assert.equal(answer.moved, true);
    });

    test('a descendant BEATS an ancestor — down is tried before up', () => {
        const records = [
            record('p:anc', 'P', { createdAt: '2026-08-01T00:00:00' }),
            hidden('p:slot', 'P', { parentId: 'p:anc', createdAt: '2026-08-02T00:00:00' }),
            record('p:desc', 'P', { parentId: 'p:slot', createdAt: '2026-08-03T00:00:00' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:slot');
        assert.equal(answer.id, 'p:desc');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.DESCENDANT);
    });

    test('A7 — a hidden record with a wholly hidden family answers NOTHING, and moves nothing', () => {
        const records = [
            hidden('p:a', 'P'),
            hidden('p:b', 'P', { parentId: 'p:a' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:a');
        assert.equal(answer.id, null);
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.NO_LIVING_RECORD);
        assert.equal(answer.moved, false);
    });

    test('A7 — an id that is not in the corpus is left alone, never cleared and never guessed', () => {
        const records = [record('p:a', 'Rao Allongé'), record('p:b', 'Rao Allongé')];
        const answer = livingFavouriteTarget(records, 'p:missing');
        assert.equal(answer.id, null);
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.NOT_IN_CORPUS);
        assert.equal(answer.moved, false);
    });

    test('a parent CYCLE terminates instead of hanging the rail', () => {
        // Nothing ReaPrime writes contains one, but the corpus is server data.
        const records = [
            hidden('p:a', 'P', { parentId: 'p:b' }),
            hidden('p:b', 'P', { parentId: 'p:a' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:a');
        assert.equal(answer.id, null);
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.NO_LIVING_RECORD);
    });

    test('a self-parenting row does not put a live tip inside its own subtree', () => {
        const records = [hidden('p:a', 'P', { parentId: 'p:a' })];
        assert.equal(livingFavouriteTarget(records, 'p:a').id, null);
    });
});

describe('rule 6 over a whole rail', () => {
    const corpus = () => [
        // slot 0's family: the backward shape.
        hidden('p:e-gran', 'Extractamundo Dos! (2)', { createdAt: '2026-08-23T08:18:27' }),
        record('p:e-parent', 'Extractamundo Dos! (2)', { parentId: 'p:e-gran', createdAt: '2026-08-23T09:16:39' }),
        hidden('p:e-child', 'Extractamundo Dos! (2)', { parentId: 'p:e-parent', createdAt: '2026-08-27T20:28:17' }),
        // slots 1 and 2: already correct, and one of them is a bundled template.
        record('p:lever', 'Lever Classic'),
        record('p:80s', "80's Espresso", { isDefault: true }),
        // slot 4's family: the forward shape.
        hidden('p:pt-old', 'Pressure Tuning', { createdAt: '2026-08-27T10:59:10' }),
        record('p:pt-new', 'Pressure Tuning', { parentId: 'p:pt-old', createdAt: '2026-08-27T19:14:56' }),
    ];
    const rail = () => ({ 0: 'p:e-child', 1: 'p:lever', 2: 'p:80s', 3: null, 4: 'p:pt-old' });

    test('both stale slots are healed, both directions, in one pass', () => {
        const result = healFavouriteAssignments(rail(), corpus());
        assert.equal(result.healed, true);
        assert.deepEqual(result.assignments, {
            0: 'p:e-parent', 1: 'p:lever', 2: 'p:80s', 3: null, 4: 'p:pt-new',
        });
        assert.deepEqual(result.changes.map((c) => [c.slot, c.basis]), [
            [0, FAVOURITE_HEAL_BASIS.ANCESTOR],
            [4, FAVOURITE_HEAL_BASIS.DESCENDANT],
        ]);
    });

    test('an already-correct rail reports NO change, so nothing is written', () => {
        const healed = healFavouriteAssignments(rail(), corpus()).assignments;
        const again = healFavouriteAssignments(healed, corpus());
        assert.equal(again.healed, false, 'healing is idempotent — the second launch writes nothing');
        assert.deepEqual(again.changes, []);
        assert.deepEqual(again.assignments, healed);
    });

    test('an empty slot stays empty — healing never fills a slot nobody chose', () => {
        const result = healFavouriteAssignments(rail(), corpus());
        assert.equal(result.assignments[3], null);
    });

    test('THE PARTIAL MAP: a short rail comes back with all five slots', () => {
        const result = healFavouriteAssignments({ 2: 'p:lever' }, corpus());
        assert.deepEqual(Object.keys(result.assignments), ['0', '1', '2', '3', '4']);
        assert.deepEqual(result.assignments, { 0: null, 1: null, 2: 'p:lever', 3: null, 4: null });
    });

    test('junk in, a complete empty rail out — never a throw and never a short map', () => {
        for (const junk of [null, undefined, 'nonsense', 42, []]) {
            const result = healFavouriteAssignments(junk, corpus());
            assert.deepEqual(result.assignments, emptyAssignments(), `for ${JSON.stringify(junk)}`);
            assert.equal(result.healed, false);
        }
    });

    test('an unresolvable id RIDES THROUGH rather than being cleared', () => {
        const result = healFavouriteAssignments({ ...rail(), 1: 'p:vanished' }, corpus());
        assert.equal(result.assignments[1], 'p:vanished',
            'a listing that failed must not cost the user a favourite');
    });

    test('a bundled template is NOT dragged onto a profile derived from it', () => {
        const records = [
            record('p:factory', 'Rao Allongé', { isDefault: true }),
            record('p:mine', 'Rao Allongé', { parentId: 'p:factory', createdAt: '2026-08-28T09:00:00' }),
        ];
        const result = healFavouriteAssignments({ 3: 'p:factory' }, records);
        assert.equal(result.assignments[3], 'p:factory');
        assert.equal(result.healed, false);
    });
});

describe('rule 6 — the convergence case, decided rather than stumbled into', () => {
    test('two slots on two versions of ONE profile both heal, and the duplicate stands', () => {
        const records = [
            hidden('p:v1', 'P', { createdAt: '2026-08-01T00:00:00' }),
            hidden('p:v2', 'P', { parentId: 'p:v1', createdAt: '2026-08-02T00:00:00' }),
            record('p:v3', 'P', { parentId: 'p:v2', createdAt: '2026-08-03T00:00:00' }),
        ];
        const result = healFavouriteAssignments({ 0: 'p:v1', 1: null, 2: 'p:v2', 3: null, 4: null }, records);
        assert.equal(result.assignments[0], 'p:v3');
        assert.equal(result.assignments[2], 'p:v3', 'both converge; neither slot is sacrificed');
        assert.equal(result.changes.length, 2, 'and both moves are reported, not one');
    });
});

describe('rule 6 — a SOFT-DELETED record is not a living row either', () => {
    const deleted = (id, title, extra = {}) => record(id, title, {
        visibility: PROFILE_VISIBILITY.DELETED, ...extra,
    });

    test('a slot ON a deleted record is healed away from it', () => {
        const records = [
            record('p:live', 'P', { createdAt: '2026-08-01T00:00:00' }),
            deleted('p:dead', 'P', { parentId: 'p:live', createdAt: '2026-08-02T00:00:00' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:dead');
        assert.equal(answer.id, 'p:live');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.ANCESTOR);
    });

    test('a deleted DESCENDANT is never chosen as the living version', () => {
        const records = [
            hidden('p:root', 'P', { createdAt: '2026-08-01T00:00:00' }),
            record('p:keep', 'P', { parentId: 'p:root', createdAt: '2026-08-02T00:00:00' }),
            deleted('p:dead', 'P', { parentId: 'p:root', createdAt: '2026-08-09T00:00:00' }),
        ];
        assert.equal(livingFavouriteTarget(records, 'p:root').id, 'p:keep',
            'the deleted record is newer and must still lose');
    });

    test('a deleted ANCESTOR is never chosen either', () => {
        const records = [
            record('p:live', 'P', { createdAt: '2026-08-01T00:00:00' }),
            deleted('p:mid', 'P', { parentId: 'p:live', createdAt: '2026-08-02T00:00:00' }),
            hidden('p:slot', 'P', { parentId: 'p:mid', createdAt: '2026-08-03T00:00:00' }),
        ];
        const answer = livingFavouriteTarget(records, 'p:slot');
        assert.equal(answer.id, 'p:live', 'the walk passes THROUGH the deleted ancestor');
        assert.equal(answer.basis, FAVOURITE_HEAL_BASIS.ANCESTOR);
    });
});
