// THE R-TAGGED ADAPTER MODULE — the one place in Decal where a server answer that
// ReaPrime does not yet serve is written down.
//
// DECISIONS.md, "Upstream work stays out of the overnight run":
//
//   "R1–R8 and F1–F3 are NOT in scope for the unattended build. Where the skin needs a
//    ReaPrime field that does not exist yet, it goes through ONE NAMED ADAPTER PER MISSING
//    FIELD, in a single module, each marked with its R-number — so when the upstream item
//    lands, the swap is a mechanical, greppable edit rather than a hunt."
//
// ── THE SWAP DISCIPLINE ──────────────────────────────────────────────────────────────
//
//  1. ONE FILE. Every interim answer lives here. A call site never hand-writes a server
//     truth, never reads a machine name, and never recomputes a value the server owns.
//  2. ONE ADAPTER PER MISSING FIELD, and its exported name begins with its R-number
//     (`r1…`, `r2…`, `r3…`). An adapter with no R-number is a finding; so is a served
//     field consumed directly where the spec says an adapter (SCOPE Part 10 §10).
//  3. EVERY ADAPTER IS PURE. It takes a server answer the caller already holds and
//     returns a decision. It performs no request, so it can never become a second,
//     undeclared route.
//  4. EVERY ANSWER IS MARKED. `{ known, provisional, basis, swapWhen }` travels with the
//     value: a consumer can always tell an interim answer from a served one, and an
//     "I cannot answer" from a "no". Nothing here returns a plausible default.
//  5. THE SWAP IS DELETION. When the upstream item ships, the adapter body becomes a read
//     of the served field and then the whole row goes. `R_ADAPTERS` below names, for each
//     row, the exact field to read once it exists. Grep the R-number; there is one hit
//     per consumer.
//  6. NOT A WORKAROUND HATCH. This pattern is for UPSTREAM gaps only. Routing around a
//     failure of this build is out of scope for it (SCOPE Part 10 §11).
//
// WHAT IT IS NOT: a place to sniff. A3 is absolute — the skin learns what a machine can do
// from `GET /api/v1/machine/capabilities` and from nothing else, never from the model
// string. Every adapter here reads a SERVED field (the capability list itself, `GHC` and
// `extra.profileModeCaps` on `GET /api/v1/machine/info`, the workflow report, the profile
// listing). `test/adapters-r.test.mjs` asserts this module's code contains no machine-name
// read at all. The failure mode that argument comes from is on record: a Bengle that
// advertised as a plain DE1 becomes a `UnifiedDe1`, so `model` reads "Bengle" while
// capabilities returns `[]` and every Bengle route 404s — the sniffing skin then shows
// three settings pages whose every call fails.
//
// ReaPrime read AS WRITTEN at 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
// `de1handler.dart` (capabilities, `_infoHandler`, `_bengleFirmwareGate`),
// `machine.dart` (`MachineInfo.toJson` — the key is `GHC`), `unified_de1.dart`
// (`extra['profileModeCaps']`, `_readProfileModeCaps`, `_assertProfileModeSupported`),
// `workflow.dart` / `profile.dart` / `profile_record.dart` (R1), `workflow_handler.dart`.
// This module issues no request of its own and therefore declares no route.
//
// The ONE limits table (R2/B2) lives in `../lib/machine-limits.js` and is reached only
// through `r2MachineLimits` below. The numbers live there and nowhere else — this module
// carries no limit number at all, which `test/adapters-r.test.mjs` asserts against this
// file's own source.
import { limitsFor } from '../lib/machine-limits.js';

/**
 * The register. One row per missing server field; the row IS the swap instruction.
 *
 * `outputs` is what the audit greps for (SCOPE Part 10 §13, lane 3): a second hand-written
 * copy of one of these answers anywhere else in the tree is the defect this module exists
 * to make impossible.
 */
export const R_ADAPTERS = Object.freeze([
    Object.freeze({
        tag: 'R1',
        adapter: 'r1LoadedProfileId',
        missingField: "the loaded profile's id on GET /api/v1/workflow",
        why: 'workflow.dart emits `profile: profile.toJson()` and Profile.toJson has no id;'
            + ' ProfileRecord carries `final String id` but the workflow report serialises a bare Profile.',
        servedInstead: "the report's TOP-LEVEL `id` is the WORKFLOW's uuid (workflow.dart toJson) — reading it as the profile's is the same defect with a different key",
        interim: 'title match against the profile listing, ambiguity reported rather than resolved',
        provisional: true,
        swapWhen: "GET /api/v1/workflow carries the ProfileRecord id: read report.profile.id and delete the match",
        outputs: Object.freeze(['loadedProfileId']),
        status: 'shipping-provisional',
    }),
    Object.freeze({
        tag: 'R2',
        adapter: 'r2MachineLimits',
        missingField: 'a machine limits endpoint (pressure, flow, power, temperatures, steam, dose ranges)',
        why: 'the ranges are hand-written tables in the old skin that no firmware change updates; B3 is that rot already visible.',
        servedInstead: null,
        interim: 'EXACTLY ONE limits table in the skin, never two — src/lib/machine-limits.js, reached only through this adapter. The steam envelope is machine-dependent and comes from the served capability answer, never from a machine name (A3).',
        provisional: true,
        swapWhen: 'the limits endpoint serves the ranges per machine type; every numeric component takes min/max/step from that answer',
        outputs: Object.freeze(['machineLimits']),
        status: 'shipping-provisional',
    }),
    Object.freeze({
        tag: 'R3',
        adapter: 'r3GroupHeadControllerCapability',
        missingField: 'a group-head-controller entry in GET /api/v1/machine/capabilities',
        why: 'the served set is seven fixed entries and GHC is not one of them; the GHC strip today renders on every machine (L1).',
        servedInstead: 'MachineInfo.toJson key `GHC` (bool) on GET /api/v1/machine/info',
        interim: "read the served `GHC` flag — a served field, not a machine name",
        provisional: true,
        swapWhen: "the capability set carries a groupHeadController entry: ask the capability store and delete this",
        outputs: Object.freeze(['groupHeadControllerCapability']),
        status: 'shipping-provisional',
    }),
    Object.freeze({
        tag: 'R3',
        adapter: 'r3PuckEstimatorCapability',
        missingField: 'a puck-estimator entry in GET /api/v1/machine/capabilities',
        why: 'the estimator gates the sensor poll (a 15 s poll runs for ever on a machine that has none) and there is no entry for it.',
        servedInstead: 'the capability list itself: de1handler emits the seven together IFF `de1 is BengleInterface`, which is the same predicate the estimator sensor exists behind',
        interim: 'a non-empty served capability list means the machine CAN carry the estimator; it does not promise the firmware runs the observer',
        provisional: true,
        swapWhen: "the set carries a puckEstimator entry: ask the capability store for that entry and delete the inference",
        outputs: Object.freeze(['puckEstimatorCapability']),
        status: 'shipping-provisional',
    }),
    Object.freeze({
        tag: 'R3',
        adapter: 'r3MilkProbeCapability',
        missingField: 'a milk-probe entry in GET /api/v1/machine/capabilities',
        why: 'the milk-probe steam UI is one of the four things the served seven do not cover.',
        servedInstead: 'the capability list itself — same predicate as the estimator',
        interim: 'as R3 puck estimator: non-empty set means the machine can carry the probe',
        provisional: true,
        swapWhen: 'the set carries a milkProbe entry',
        outputs: Object.freeze(['milkProbeCapability']),
        status: 'shipping-provisional',
    }),
    Object.freeze({
        tag: 'R3',
        adapter: 'r3ProfileModeCapabilities',
        missingField: 'profile-mode entries (Power / Lever / HOLD / power exit) in GET /api/v1/machine/capabilities',
        why: 'ReaPrime never names the bits over the API; the mask is served as an opaque integer on machine/info.',
        servedInstead: "extra.profileModeCaps on GET /api/v1/machine/info (unified_de1.dart `_readProfileModeCaps`)",
        interim: 'decode the four bits as a UI-OFFER HINT ONLY — the authority is the arm-time 400 refusal (B9)',
        provisional: true,
        swapWhen: 'the capability set names the four modes',
        outputs: Object.freeze(['profileModeCapabilities']),
        status: 'shipping-provisional',
    }),
]);

/** Every R-number this module carries an adapter for. */
export const R_TAGS = Object.freeze([...new Set(R_ADAPTERS.map((row) => row.tag))]);

/** Every output name the final review's lane 3 audit greps for across the tree. */
export const R_ADAPTER_OUTPUTS = Object.freeze(R_ADAPTERS.flatMap((row) => [...row.outputs]));

/** Look a row up by adapter name. Throws rather than returning a blank row. */
export function rAdapter(name) {
    const row = R_ADAPTERS.find((entry) => entry.adapter === name);
    if (!row) throw new Error(`adapters-r: no register row for "${name}"`);
    return row;
}

/**
 * The shape every adapter returns.
 *
 * `known: false` is "this adapter cannot answer yet" — a first-class outcome, never
 * coerced to a `no`. `provisional` is always true here by construction: a served answer
 * does not come through this module at all.
 */
function answer(adapterName, { value, known, basis, note = null }) {
    const row = rAdapter(adapterName);
    return Object.freeze({
        tag: row.tag,
        adapter: adapterName,
        value,
        known,
        provisional: true,
        basis,
        note,
        swapWhen: row.swapWhen,
    });
}

const isObject = (value) => !!value && typeof value === 'object';
const hasOwn = (source, key) => isObject(source) && Object.hasOwn(source, key);

/* ═══════════════════════════════════════════════════════════ R3 · capability entries */

/**
 * Every adapter here takes the SERVED capability entries as its input — the array from
 * `{capabilities: […]}`, read by the capability store, which owns that answer. `null`
 * means "no answer held", which is never the same as `[]` ("this machine is not a
 * Bengle" — ReaPrime's own answer, and a real one).
 *
 * The store is in `src/stores/`, and nothing in `src/data/` may import from there, so the
 * direction is right by construction: the store reads the route and hands the answer down.
 */

/**
 * THE INFERENCE, stated once so it is reviewable in one place.
 *
 * `de1handler.dart` adds all seven entries inside a single `if (de1 is BengleInterface)`,
 * and `_bengleFirmwareGate` answers 404 on the same predicate. So a NON-EMPTY served set
 * is exactly "this machine is a BengleInterface" — read from ReaPrime's own answer, not
 * from a model string. Both Bengle-only sensors sit behind that same predicate.
 *
 * What it does NOT promise: that the firmware on this Bengle runs the observer, or that
 * the probe is plugged in. It is the difference between "can have" and "has", which is
 * why it gates a POLL rather than a display.
 */
function sensorCapabilityFromServedSet(adapterName, entries) {
    if (entries === null || entries === undefined) {
        return answer(adapterName, {
            value: null,
            known: false,
            basis: 'no capability answer held yet',
        });
    }
    if (!Array.isArray(entries)) {
        return answer(adapterName, { value: null, known: false, basis: 'unreadable capability answer' });
    }
    return answer(adapterName, {
        value: entries.length > 0,
        known: true,
        basis: 'served capability set is non-empty (de1handler emits the seven iff BengleInterface)',
        note: 'can-have, not has: the sensor registers lazily on the first decoded frame',
    });
}

/** R3 — can this machine carry the puck estimator? Gates the sensor poll. */
export function r3PuckEstimatorCapability(entries) {
    return sensorCapabilityFromServedSet('r3PuckEstimatorCapability', entries);
}

/** R3 — can this machine carry the milk probe? Gates the sensor poll and the milk UI. */
export function r3MilkProbeCapability(entries) {
    return sensorCapabilityFromServedSet('r3MilkProbeCapability', entries);
}

/** Sensor kind -> its R3 adapter. The kinds are `rea-names.js`'s `SENSOR_ID_SUFFIX` keys. */
export const R3_SENSOR_CAPABILITY = Object.freeze({
    puckEstimator: r3PuckEstimatorCapability,
    milkProbe: r3MilkProbeCapability,
});

/**
 * R3 — does this machine have group-head-controller hardware?
 *
 * THE NAMED EXAMPLE in the spec. `MachineInfo.toJson` writes the key as `GHC` (a bool)
 * from `groupHeadControllerPresent`, which `unified_de1.dart` computes from the MMR
 * `ghcInfo` word. An absent key is NOT a `false`: it is an older or different server, and
 * the honest answer is "not known".
 *
 * @param {object|null} machineInfo  a GET /api/v1/machine/info body
 */
export function r3GroupHeadControllerCapability(machineInfo) {
    const name = 'r3GroupHeadControllerCapability';
    if (!hasOwn(machineInfo, 'GHC')) {
        return answer(name, { value: null, known: false, basis: 'machine/info answer has no GHC key' });
    }
    const flag = machineInfo.GHC;
    if (typeof flag !== 'boolean') {
        return answer(name, { value: null, known: false, basis: 'GHC present but not a boolean' });
    }
    return answer(name, { value: flag, known: true, basis: 'MachineInfo.toJson GHC' });
}

/* ───────────────────────────────────── R3 · profile modes (a HINT, never authority) */

/**
 * The four capability bits, carried over from the old `machine.js` — the one thing that
 * survives it. ReaPrime never names these over the API; it serves the raw word.
 *
 * bit0 Power · bit1 Lever · bit2 HOLD · bit3 cross-variable power exit.
 */
export const PROFILE_MODE_BIT = Object.freeze({
    power: 0x1,
    lever: 0x2,
    hold: 0x4,
    powerExit: 0x8,
});

/**
 * The defined mask. It MUST cover the highest defined bit: a power-exit-capable machine
 * returns 0x9/0xB/0xF, and a mask that stopped at 0x7 would fail its own unknown-bits rule
 * and zero a legitimate word — hiding Power, Lever and HOLD along with it.
 *
 * `unified_de1.dart` `_readProfileModeCaps` applies the identical `caps & ~0xF` test on its
 * side and fails closed to 0, so the two sides agree by construction rather than by luck.
 */
export const PROFILE_MODE_MASK = PROFILE_MODE_BIT.power
    | PROFILE_MODE_BIT.lever
    | PROFILE_MODE_BIT.hold
    | PROFILE_MODE_BIT.powerExit;

/**
 * R3 — which advanced pump modes may the UI OFFER?
 *
 * A HINT, and nothing more (B9). The authority is ReaPrime's arm-time refusal: on upload
 * `_assertProfileModeSupported` throws `ProfileModeUnsupportedException` with a message
 * naming the missing modes, which the skin surfaces intact. A bit set here never means
 * "this will work"; a bit clear means "do not offer it".
 *
 * Fail-closed on garbage, as the machine does: any bit outside the defined mask means the
 * whole word is a bad read, so the answer is zero modes rather than a mis-offer.
 *
 * DELIBERATELY NOT PORTED: the old module's `?? info.extra.novelControlCaps` second
 * spelling. A fallback key is a fallback path (A7) — if a server serves the legacy name
 * only, that must be visible, not silently absorbed.
 *
 * @param {object|null} machineInfo  a GET /api/v1/machine/info body
 */
export function r3ProfileModeCapabilities(machineInfo) {
    const name = 'r3ProfileModeCapabilities';
    const extra = isObject(machineInfo) ? machineInfo.extra : null;
    if (!hasOwn(extra, 'profileModeCaps')) {
        return answer(name, {
            value: null,
            known: false,
            basis: 'machine/info extra has no profileModeCaps',
            note: 'stock firmware and every DE1 lack the register; ReaPrime then omits nothing — it serves 0',
        });
    }
    const raw = extra.profileModeCaps;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
        return answer(name, { value: null, known: false, basis: 'profileModeCaps is not a non-negative integer' });
    }
    const garbled = (raw & ~PROFILE_MODE_MASK) !== 0;
    const mask = garbled ? 0 : raw & PROFILE_MODE_MASK;
    return answer(name, {
        value: Object.freeze({
            mask,
            offers: Object.freeze(Object.fromEntries(
                Object.entries(PROFILE_MODE_BIT).map(([mode, bit]) => [mode, (mask & bit) !== 0]),
            )),
        }),
        known: true,
        basis: garbled
            ? 'bits outside the defined mask — fail-closed to no modes, as unified_de1.dart does'
            : 'machine/info extra.profileModeCaps',
        note: 'UI-offer hint only; the arm-time 400 is the authority (B9)',
    });
}

/* ═══════════════════════════════════════════════ R1 · the loaded profile's id */

/**
 * The trap, named in code so it cannot be walked into: the workflow report's TOP-LEVEL
 * `id` is the WORKFLOW's own uuid. This adapter must never read it.
 */
export const R1_WRONG_KEY = 'the workflow report top-level id is the workflow uuid, not the profile id';

/**
 * WHERE THE ID CAME FROM — the machine-readable half of the provisional marking.
 *
 * Every R-adapter answer carries `provisional: true` (the `answer()` helper sets it for
 * the whole layer, because every R item is provisional until it lands), so that flag
 * cannot tell a consumer whether THIS answer used the title match. `basis` says so in
 * English and a consumer that string-matched it would be reading prose.
 *
 * So the source is a value. A screen marks its highlight provisional when the source is
 * `title-match`, and stops marking it the day the source becomes `workflow-id` — which is
 * R1 landing, visible in the rendered tree with nothing to remember to change.
 * `profile-listbox.js` R1_PROVISIONAL_HIGHLIGHT is the consumer.
 */
export const R1_SOURCE = Object.freeze({
    /** `report.profile.id` — R1 HAS LANDED. */
    WORKFLOW_ID: 'workflow-id',
    /** The interim: matched by title against the listing. PROVISIONAL. */
    TITLE_MATCH: 'title-match',
    /**
     * The title matched more than one record and the served BODY matched exactly one
     * of them. Still provisional, and still not a guess — see `bodyMatch` below.
     */
    BODY_MATCH: 'body-match',
    /** No id was established at all; `reason` says why. */
    NONE: null,
});

/** Why the id could not be established. Each one is reportable; none is a guess. */
export const R1_UNRESOLVED = Object.freeze({
    NO_WORKFLOW: 'noWorkflow',
    NO_TITLE: 'noTitle',
    NO_LISTING: 'noListing',
    NO_MATCH: 'noMatch',
    AMBIGUOUS: 'ambiguous',
});

/**
 * Deep value equality for two served JSON bodies.
 *
 * NOT `JSON.stringify` ON BOTH: two objects that carry the same values in a different
 * KEY ORDER stringify differently, and nothing in the transport promises an order. This
 * walks the values instead, so the comparison is of what the two bodies SAY.
 *
 * `Object.is` on the leaves rather than `===`, so a NaN in a numeric field compares
 * equal to itself rather than failing a match on a field neither side chose.
 */
function sameBody(a, b) {
    if (Object.is(a, b)) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => sameBody(item, b[i]));
    }
    if (!isObject(a) || !isObject(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => hasOwn(b, key) && sameBody(a[key], b[key]));
}

/**
 * R1 — the loaded profile's id, PROVISIONALLY, by title match.
 *
 * THIS PATH IS PROVISIONAL AND IS MARKED AS SUCH ON EVERY ANSWER. It is the decided
 * interim (SCOPE Part 7, R1 "Gates"): the selector may fall back to a title match, visibly
 * marked as provisional in code, until the report carries the id — and the provisional path
 * must not survive v1 sign-off.
 *
 * It breaks on duplicate titles and on any rename, and ~70 bundled profiles of which 34
 * share a prefix is exactly the population where it breaks. So AMBIGUITY IS REPORTED, NOT
 * RESOLVED: two records with the same title yield no id and a reason, never the first one.
 * Picking the first is how a highlight lands on the wrong row and nobody finds out.
 *
 * @param {object|null} workflowReport  a GET /api/v1/workflow body
 * @param {Array|null} profileRecords   a GET /api/v1/profiles body — ProfileRecord.toJson rows
 */
export function r1LoadedProfileId(workflowReport, profileRecords) {
    const name = 'r1LoadedProfileId';
    const unresolved = (reason, basis) => answer(name, {
        value: Object.freeze({ id: null, title: null, reason, source: R1_SOURCE.NONE }),
        known: false,
        basis,
    });

    if (!isObject(workflowReport)) return unresolved(R1_UNRESOLVED.NO_WORKFLOW, 'no workflow report held');
    const profile = isObject(workflowReport.profile) ? workflowReport.profile : null;
    const title = profile && typeof profile.title === 'string' && profile.title !== '' ? profile.title : null;
    if (title === null) return unresolved(R1_UNRESOLVED.NO_TITLE, 'workflow report carries no profile title');

    // If the report ever starts carrying the id, say so loudly rather than title-matching
    // anyway: that is the swap signal, and it should be seen the first time it happens.
    if (hasOwn(profile, 'id')) {
        return answer(name, {
            value: Object.freeze({ id: profile.id, title, reason: null, source: R1_SOURCE.WORKFLOW_ID }),
            known: true,
            basis: 'the workflow report now carries profile.id — R1 HAS LANDED, delete this adapter',
        });
    }

    if (!Array.isArray(profileRecords)) {
        return unresolved(R1_UNRESOLVED.NO_LISTING, 'no profile listing held to match against');
    }
    const matches = profileRecords.filter(
        (record) => isObject(record)
            && typeof record.id === 'string'
            && isObject(record.profile)
            && record.profile.title === title,
    );
    if (matches.length === 0) {
        return answer(name, {
            value: Object.freeze({ id: null, title, reason: R1_UNRESOLVED.NO_MATCH, source: R1_SOURCE.NONE }),
            known: false,
            basis: 'no profile in the listing carries this title',
        });
    }
    if (matches.length > 1) {
        /* THE TITLE IS AMBIGUOUS; THE BODY IS NOT. Measured on Ben's machine,
         * 25 August 2026: the loaded profile is "Baseline • Ultra Low Contact Dos
         * Bengelitos" and TWO records carry that title — one the PARENT of the other,
         * which is what saving an edit leaves behind ("editing keeps the old version").
         * With no id served, this answered `ambiguous`, the shell seated no record, and
         * the editor mounted around nothing: a blank page from the Live band's Edit.
         *
         * THIS IS NOT PICKING ONE. The workflow report carries the WHOLE profile body —
         * steps, notes, target weight, every field the record carries — and the store is
         * CONTENT-ADDRESSED: `ProfileController.create` computes the record id from the
         * profile and returns the existing record when the content is already stored, so
         * two records CANNOT hold the same body. A body that equals exactly one
         * candidate therefore identifies it; measured on those two, one matched on all
         * ten fields and the other differed in `steps`.
         *
         * IT STAYS UNRESOLVED WHEN THE BODY DOES NOT DECIDE. None and several both fall
         * through to the answer below with the candidates named, exactly as before — a
         * narrower rule, not a looser one. */
        const byBody = matches.filter((record) => sameBody(profile, record.profile));
        if (byBody.length === 1) {
            return answer(name, {
                value: Object.freeze({
                    id: byBody[0].id,
                    title,
                    reason: null,
                    source: R1_SOURCE.BODY_MATCH,
                    candidates: Object.freeze(matches.map((record) => record.id)),
                }),
                known: true,
                basis: `${matches.length} profiles share this title; the served body matches exactly one`,
            });
        }
        return answer(name, {
            value: Object.freeze({
                id: null,
                title,
                reason: R1_UNRESOLVED.AMBIGUOUS,
                source: R1_SOURCE.NONE,
                candidates: Object.freeze(matches.map((record) => record.id)),
            }),
            known: false,
            basis: byBody.length === 0
                ? `${matches.length} profiles share this title and the served body matches none of them`
                : `${matches.length} profiles share this title and ${byBody.length} bodies match — never resolved by picking one`,
        });
    }
    return answer(name, {
        value: Object.freeze({ id: matches[0].id, title, reason: null, source: R1_SOURCE.TITLE_MATCH }),
        known: true,
        basis: 'title match against the profile listing — PROVISIONAL (R1)',
    });
}

/* ═══════════════════════════════════════════════ R2 · machine limits (SLOT RESERVED) */

/**
 * R2 — the machine's allowed ranges. THE ONE TABLE, AND THE ONLY DOOR TO IT.
 *
 * B2's decided interim is EXACTLY ONE limits table in the skin, never two. The table is
 * `src/lib/machine-limits.js`; this adapter is how every surface reaches it, so there is
 * one greppable place to delete when the endpoint serves the ranges, and no component
 * ever owns a limit. No number appears in this file.
 *
 * THE ONE MACHINE-DEPENDENT ROW. B3's corrected steam envelope shares its floor across
 * both machines but its CEILING differs between Bengle and DE1 (`doc/Skins.md`), so the
 * steam row needs a machine class — and A3 forbids reading it from a model string. The
 * numbers themselves stay in the table module; the input here is therefore the
 * SERVED capability set, exactly as the R3 adapters take it, under the same inference
 * stated once above `sensorCapabilityFromServedSet`: `de1handler.dart` emits the seven
 * entries inside a single `if (de1 is BengleInterface)`, so a non-empty set is
 * ReaPrime's own "this is a Bengle" and `[]` is its own "this is not". `null` is "no
 * answer held yet", which is neither.
 *
 * WHEN THE CLASS IS NOT KNOWN the returned table simply has NO STEAM ROW. Absence is the
 * answer — a steam control renders as unavailable until the capability answer arrives,
 * and A7 forbids standing a plausible ceiling in for the missing one. Every
 * machine-independent row is present either way, because none of them depends on this.
 *
 * @param {Array|null|undefined} entries  the served `capabilities` array, from the store
 */
/**
 * The machine class, from the served capability set and NOTHING ELSE.
 *
 * ONE RULE, ONE PLACE. `r2MachineLimits` below has always inferred the class this way and
 * kept the inference inside itself, which was fine while the limits table was the only
 * consumer. It is not any more: `settings-nav.js` hides one leaf on a Bengle (Ben, 26 Aug
 * 2026 — the flow multiplier "is not needed for the Bengle"), and a second copy of
 * "non-empty means Bengle" is exactly the drift this module exists to prevent.
 *
 * THE INFERENCE, stated once above: `de1handler.dart` emits the seven entries inside a
 * single `if (de1 is BengleInterface)`, so a non-empty set is ReaPrime's own "this is a
 * Bengle" and `[]` is its own "this is not".
 *
 * NULL IS "NOT KNOWN YET", which is neither class and is not a third one. A caller that
 * hides a surface on it would hide it on every machine until the capability read lands;
 * a caller that shows it would flash it away. Both are decisions for the caller to make
 * and to state — see `settings-screen.js`, which shows an unknown machine everything.
 *
 * @param {Array|null|undefined} entries  the served `capabilities` array, from the store
 * @returns {'bengle'|'de1'|null}
 */
export function machineClassFromServedSet(entries) {
    if (entries === null || entries === undefined || !Array.isArray(entries)) return null;
    return entries.length > 0 ? 'bengle' : 'de1';
}

export function r2MachineLimits(entries) {
    const name = 'r2MachineLimits';
    if (entries === null || entries === undefined) {
        return answer(name, {
            value: limitsFor(null),
            known: false,
            basis: 'no capability answer held yet — the machine class is unknown',
            /* TWO ROWS SINCE 27 AUGUST 2026, not one: the fan threshold joined the steam
             * ceiling as machine-dependent (Bengle 40-60, DE1 whatever ReaPrime declares),
             * so it is absent on an unknown class for the same reason and by the same rule. */
            note: 'no steam or fan row: their bands are machine-dependent and there is no honest stand-in',
        });
    }
    if (!Array.isArray(entries)) {
        return answer(name, {
            value: limitsFor(null),
            known: false,
            basis: 'unreadable capability answer',
            /* TWO ROWS SINCE 27 AUGUST 2026, not one: the fan threshold joined the steam
             * ceiling as machine-dependent (Bengle 40-60, DE1 whatever ReaPrime declares),
             * so it is absent on an unknown class for the same reason and by the same rule. */
            note: 'no steam or fan row: their bands are machine-dependent and there is no honest stand-in',
        });
    }
    const machineClass = machineClassFromServedSet(entries);
    return answer(name, {
        value: limitsFor(machineClass),
        known: true,
        basis: `served capability set is ${entries.length > 0 ? 'non-empty' : 'empty'}`
            + ' (de1handler emits the seven iff BengleInterface) — machine class from a served'
            + ' answer, never a model string',
        note: 'the whole table is PROVISIONAL (R2/B2): hand-written in the skin until the'
            + ' limits endpoint serves it',
    });
}
