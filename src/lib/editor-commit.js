/**
 * What the profile editor sends when a draft is saved, and what it refuses to send.
 */

export const OUTCOME_SOURCE = Object.freeze({
    /** The server said it. Only reachable once R8 lands and a reader is injected. */
    SERVER: 'server',
    /** The server did not say. The R8 gap, reported as itself. */
    ABSENT: 'absent',
});

/** How much a dirty-state answer is worth. */
export const CHANGE_TELL = Object.freeze({
    /** Draft and baseline were both readable and were compared field by field. */
    COMPARED: 'compared',
    /** They were not comparable. The count is 0 and the screen is CLEAN — the surviving rule. */
    CANNOT_TELL: 'cannot-tell',
});

export const PROFILE_RECORD_KEYS = Object.freeze([
    'id', 'profile', 'metadataHash', 'compoundHash', 'parentId',
    'visibility', 'isDefault', 'createdAt', 'updatedAt', 'metadata',
]);

/**
 * The profile-level keys the editor can change. Compared as scalars; `steps` is compared
 * as a list below. These are the DE1 v2 shape's own keys, as they arrive on
 * `record.profile` — not a re-spelling.
 */
const PROFILE_SCALAR_KEYS = Object.freeze([
    'title', 'notes', 'author', 'beverage_type', 'version',
    'target_volume', 'target_weight', 'target_volume_count_start', 'tank_temperature',
]);

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep structural equality over JSON-ish values. Used ONLY to count what a person changed
 * in the draft in front of them; it is never applied to a hash and never stands in for one.
 */
function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) {
        return (a ?? null) === (b ?? null);
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => sameValue(item, b[i]));
    }
    if (typeof a === 'object' || typeof b === 'object') {
        if (!isObject(a) || !isObject(b)) return false;
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) if (!sameValue(a[key], b[key])) return false;
        return true;
    }
    return false;
}

export function changeCountOf(draft, baseline) {
    const groups = changeGroupsOf(draft, baseline);
    if (!groups.known) {
        // CANNOT TELL -> CLEAN, applied at its one site.
        return Object.freeze({
            count: 0, clean: true, tell: CHANGE_TELL.CANNOT_TELL, fields: Object.freeze([]),
        });
    }

    const fields = fieldNamesOf(groups);
    return Object.freeze({
        count: fields.length,
        clean: fields.length === 0,
        tell: CHANGE_TELL.COMPARED,
        fields: Object.freeze(fields),
    });
}

export function changeGroupsOf(draft, baseline) {
    const empty = {
        known: false,
        scalars: Object.freeze([]),
        changed: Object.freeze([]),
        added: Object.freeze([]),
        removed: Object.freeze([]),
        wholesale: false,
        count: 0,
    };
    if (!isObject(draft) || !isObject(baseline)) return Object.freeze(empty);

    const scalars = [];
    for (const key of PROFILE_SCALAR_KEYS) {
        if (!sameValue(draft[key], baseline[key])) scalars.push(key);
    }

    const changed = [];
    const added = [];
    const removed = [];
    let wholesale = false;

    const a = Array.isArray(draft.steps) ? draft.steps : null;
    const b = Array.isArray(baseline.steps) ? baseline.steps : null;
    if (a === null || b === null) {
        if (a !== b) wholesale = true;
    } else {
        const shared = Math.min(a.length, b.length);
        for (let i = 0; i < shared; i += 1) {
            if (!sameValue(a[i], b[i])) changed.push(i);
        }
        for (let i = shared; i < a.length; i += 1) added.push(i);
        for (let i = shared; i < b.length; i += 1) removed.push(i);
    }

    const count = scalars.length + changed.length + added.length + removed.length
        + (wholesale ? 1 : 0);

    return Object.freeze({
        known: true,
        scalars: Object.freeze(scalars),
        changed: Object.freeze(changed),
        added: Object.freeze(added),
        removed: Object.freeze(removed),
        wholesale,
        count,
    });
}

function fieldNamesOf(groups) {
    const fields = [...groups.scalars];
    if (groups.wholesale) fields.push('steps');
    for (const i of groups.changed) fields.push(`steps[${i}]`);
    for (const i of groups.added) fields.push(`steps[${i}] added`);
    for (const i of groups.removed) fields.push(`steps[${i}] removed`);
    return fields;
}

export function headerCommitFor(change) {
    const count = typeof change === 'number' ? change : (change && change.count) || 0;
    const n = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
    return Object.freeze({ commit: n > 0, changeCount: n });
}

/**
 * There is no outcome field on `ProfileRecord` at the pin. This is the default reader and
 * it says so by returning null — the single seam R8 replaces.
 */
export const NO_SERVER_OUTCOME = () => null;

export function saveReportFrom(record, {
    route = null, status = null, before = null, readOutcome = NO_SERVER_OUTCOME,
} = {}) {
    if (!isObject(record)) {
        return Object.freeze({
            recorded: false,
            route,
            status,
            reason: 'the save response carried no ProfileRecord',
            outcome: null,
            outcomeSource: OUTCOME_SOURCE.ABSENT,
        });
    }

    const served = typeof readOutcome === 'function' ? readOutcome(record) : null;
    const beforeId = isObject(before) && typeof before.id === 'string' ? before.id : null;
    const beforeMeta = isObject(before) && typeof before.metadataHash === 'string'
        ? before.metadataHash : null;
    const afterId = typeof record.id === 'string' ? record.id : null;
    const afterMeta = typeof record.metadataHash === 'string' ? record.metadataHash : null;

    return Object.freeze({
        recorded: true,
        route,
        status,

        /* THE RECORD, READ OUT. Every value here is the server's own. */
        id: afterId,
        parentId: typeof record.parentId === 'string' && record.parentId ? record.parentId : null,
        metadataHash: afterMeta,
        compoundHash: typeof record.compoundHash === 'string' ? record.compoundHash : null,
        visibility: typeof record.visibility === 'string' ? record.visibility : null,
        isDefault: record.isDefault === true,
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
        title: isObject(record.profile) && typeof record.profile.title === 'string'
            ? record.profile.title : null,

        identity: Object.freeze({
            before: beforeId, after: afterId,
            same: beforeId && afterId ? beforeId === afterId : null,
        }),
        metadata: Object.freeze({
            before: beforeMeta, after: afterMeta,
            same: beforeMeta && afterMeta ? beforeMeta === afterMeta : null,
        }),

        /* UNKNOWABLE FROM THIS RESPONSE. A 201 is answered whether the record was stored
         * or was already there — see the header. */
        stored: null,

        /* R8. `outcome` is whatever the SERVER said; today nothing says anything. */
        outcome: served ?? null,
        outcomeSource: served ? OUTCOME_SOURCE.SERVER : OUTCOME_SOURCE.ABSENT,
    });
}

export function saveFailureFrom(failure, { route = null, refusal = null } = {}) {
    return Object.freeze({
        recorded: false,
        route,
        status: failure && Number.isFinite(failure.status) ? failure.status : null,
        refusal: refusal ?? null,
        error: refusal ? null : (failure ?? null),
        outcome: null,
        outcomeSource: OUTCOME_SOURCE.ABSENT,
    });
}

/** What the person did. Two affordances, two gestures. */
export const COMMIT_GESTURE = Object.freeze({
    /** The band's commit control — "Save (N)" / "Close". */
    SAVE: 'save',
    /** The header's rename affordance confirmed a new name. */
    RENAME: 'rename',
});

/** The store methods a plan can name. The spelling is the store's own. */
export const SAVE_OPERATION = Object.freeze({
    NEW_VERSION: 'saveAsNewVersion',
    METADATA: 'saveMetadata',
    IN_PLACE: 'saveInPlace',
});

export function commitPlan({
    gesture, dirty = false, tell = CHANGE_TELL.COMPARED, seated = true,
} = {}) {
    const plan = (operation, close, reason) => Object.freeze({ operation, close, reason });

    if (gesture === COMMIT_GESTURE.RENAME) {
        if (!seated) return plan(null, false, 'nothing is open to rename');
        return plan(SAVE_OPERATION.IN_PLACE, false, 'a rename is a label edit on the open record');
    }

    if (gesture !== COMMIT_GESTURE.SAVE) return plan(null, false, `no plan for gesture '${gesture}'`);
    if (!seated) return plan(null, true, 'nothing is open, so the band can only close');
    if (!dirty) {
        if (tell === CHANGE_TELL.CANNOT_TELL) {
            return plan(SAVE_OPERATION.NEW_VERSION, true,
                'the dirty state could not be told, and an unknown must not close silently '
                + 'over a draft (DQ-629 keeps the previous version, so the spare write is cheap)');
        }
        return plan(null, true, 'nothing is unsaved, so Close closes');
    }

    return plan(SAVE_OPERATION.NEW_VERSION, true, 'a content save keeps the old version (DQ-629), and closes');
}
