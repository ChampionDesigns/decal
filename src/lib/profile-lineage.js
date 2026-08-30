/**
 * B11.
 */

import { changeGroupsOf } from './editor-commit.js';

export function supersededIds(records) {
    const ids = new Set();
    if (!Array.isArray(records)) return ids;
    for (const record of records) {
        if (!isObject(record)) continue;
        const parentId = str(record.parentId);
        if (parentId && parentId !== str(record.id)) ids.add(parentId);
    }
    return ids;
}

export function versionChangeFacts(record, parent) {
    const groups = changeGroupsOf(
        isObject(record) ? record.profile ?? null : null,
        isObject(parent) ? parent.profile ?? null : null,
    );
    return groups;
}

export function parentRecordOf(record, records) {
    const parentId = isObject(record) ? str(record.parentId) : null;
    if (!parentId || !Array.isArray(records)) return null;
    return records.find((candidate) => isObject(candidate) && str(candidate.id) === parentId) ?? null;
}

/** The three save shapes, named so a call site cannot mean one and send another. */
export const SAVE_INTENT = Object.freeze({
    /** POST /profiles with parentId. Keeps the previous record. B11's path. */
    NEW_VERSION: 'new-version',
    /** PUT /profiles/{id} carrying `profile`. Replaces; a hash change DELETES the old. */
    IN_PLACE: 'in-place',
    /** PUT /profiles/{id} with metadata only. Id-stable, no second record. */
    METADATA_ONLY: 'metadata-only',
});

/** What became of the previous version. Every value is evidenced; none is inferred. */
export const VERSION_KEPT = Object.freeze({
    /** The saved record's `parentId` IS the id the editor loaded from. The server linked them. */
    LINKED: 'linked',
    /** The saved id equals the previous id — one record, updated in place. */
    SAME_RECORD: 'same-record',
    RESTORED: 'restored',
    /** The id moved and no parent link came back. On the PUT path the old record was deleted. */
    NOT_LINKED: 'not-linked',
    /** Nothing to compare against, or nothing came back. The editor says it does not know. */
    UNKNOWN: 'unknown',
});

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);

export function lineageFactsOf(record) {
    if (!isObject(record)) {
        return Object.freeze({
            known: false, id: null, parentId: null, hasParent: false,
            metadataHash: null, compoundHash: null, createdAt: null, updatedAt: null,
        });
    }
    const parentId = str(record.parentId);
    return Object.freeze({
        known: true,
        id: str(record.id),
        parentId,
        hasParent: parentId !== null,
        metadataHash: str(record.metadataHash),
        compoundHash: str(record.compoundHash),
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
    });
}

export function versionKeptBy(saved, { previous = null, intent = null, requestedParentId = null } = {}) {
    const savedId = isObject(saved) ? str(saved.id) : null;
    const parentId = isObject(saved) ? str(saved.parentId) : null;
    const previousId = typeof previous === 'string'
        ? (previous || null)
        : (isObject(previous) ? str(previous.id) : null);

    const answer = (kept, basis) => Object.freeze({
        kept, previousId, savedId, parentId, intent: intent ?? null, basis,
    });

    if (!savedId || !previousId) {
        return answer(VERSION_KEPT.UNKNOWN,
            'no pair of server-issued ids to compare — the editor says it does not know '
            + 'rather than claiming either way');
    }
    if (parentId && parentId === previousId) {
        return answer(VERSION_KEPT.LINKED,
            'the saved record carries parentId = the id the editor loaded from, so ReaPrime '
            + 'stored the link itself; the previous record is untouched and reachable through '
            + 'GET /profiles/{id}/lineage');
    }
    if (savedId === previousId) {
        return answer(VERSION_KEPT.SAME_RECORD,
            'the id came back unchanged — one record, updated in place. There is no second '
            + 'version to keep, and no lineage entry is created');
    }
    if (intent === SAVE_INTENT.NEW_VERSION
        && requestedParentId && requestedParentId === previousId) {
        return answer(VERSION_KEPT.RESTORED,
            'a parentId was sent and the saved record does not carry it, so ReaPrime '
            + 'returned a record it already held rather than storing a new one — the '
            + 'content was already in the history. Nothing was lost: the version the editor '
            + 'was on is still in the lineage, and this older one is now the visible row');
    }
    if (intent === SAVE_INTENT.IN_PLACE) {
        return answer(VERSION_KEPT.NOT_LINKED,
            'the id moved on a PUT carrying `profile`: ProfileController.update deletes the '
            + 'previous record and stores the new one, and logs "Consider using parentId for '
            + 'versioning". The old version is NOT kept on this path');
    }
    return answer(VERSION_KEPT.NOT_LINKED,
        'the id moved and no parentId came back, so nothing links the two records');
}

export function versionNoteFacts(saved, opts = {}) {
    const kept = versionKeptBy(saved, opts);
    return Object.freeze({
        ...kept,
        saysOldVersionKept: kept.kept === VERSION_KEPT.LINKED || kept.kept === VERSION_KEPT.RESTORED,
        /** Where the other versions are found. The SELECTOR owns the entry point (Q7). */
        entryPoint: Object.freeze({
            owner: 'selector detail-pane overflow menu (Q7, wave 5.3)',
            route: 'getProfilesByIdLineage',
            store: 'src/stores/profile-library-store.js versionsOf()',
            note: 'the editor states the fact; it does not open a second versions surface',
        }),
    });
}
