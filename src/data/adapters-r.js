/**
 * THE R-TAGGED ADAPTER MODULE — the one place in Decal where a server answer that ReaPrime does not yet serve is written down.
 */

import { limitsFor } from '../lib/machine-limits.js';

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

export const PROFILE_MODE_BIT = Object.freeze({
    power: 0x1,
    lever: 0x2,
    hold: 0x4,
    powerExit: 0x8,
});

export const PROFILE_MODE_MASK = PROFILE_MODE_BIT.power
    | PROFILE_MODE_BIT.lever
    | PROFILE_MODE_BIT.hold
    | PROFILE_MODE_BIT.powerExit;

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
            note: 'no steam or fan row: their bands are machine-dependent and there is no honest stand-in',
        });
    }
    if (!Array.isArray(entries)) {
        return answer(name, {
            value: limitsFor(null),
            known: false,
            basis: 'unreadable capability answer',
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
