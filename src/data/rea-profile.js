

import { newStep } from '../lib/profile-modes.js';

/** `enum Visibility { visible, hidden, deleted }` (`profile_record.dart:6`). */
export const PROFILE_VISIBILITY = Object.freeze({
    VISIBLE: 'visible',
    HIDDEN: 'hidden',
    /** A soft delete. The record is still served by `GET /profiles?includeHidden=true`. */
    DELETED: 'deleted',
});

const isRecord = (value) => Boolean(value) && typeof value === 'object';

/** The record's own id — the profile content hash, `profile:<hex>`. Never the workflow's. */
export function profileRecordIdOf(record) {
    return isRecord(record) && typeof record.id === 'string' && record.id ? record.id : null;
}

/** `record.profile.title`. The Profile carries the title; the record does not. */
export function profileTitleOf(record) {
    if (!isRecord(record) || !isRecord(record.profile)) return null;
    const title = record.profile.title;
    return typeof title === 'string' ? title : null;
}

/** Verbatim. An unrecognised value is returned as-is — see A7 above. */
export function profileVisibilityOf(record) {
    return isRecord(record) && typeof record.visibility === 'string' ? record.visibility : null;
}

/** The metadata map, or `null` when the record carries none. Never `{}` standing in. */
export function profileMetadataOf(record) {
    return isRecord(record) && isRecord(record.metadata) ? record.metadata : null;
}

/** True only for a bundled profile. `isDefault` content cannot be modified by `PUT`. */
export function isDefaultProfile(record) {
    return isRecord(record) && record.isDefault === true;
}

/** The version link ReaPrime already stores (B11's raw material). */
export function profileParentIdOf(record) {
    return isRecord(record) && typeof record.parentId === 'string' && record.parentId
        ? record.parentId
        : null;
}

/** Legacy TCL fields ReaPrime's Profile model has no home for. */
export const LEGACY_PROFILE_KEYS = Object.freeze([
    'type', 'legacy_profile_type', 'lang', 'hidden',
    'reference_file', 'changes_since_last_espresso',
]);

/** `ExitType` at the pinned commit (`profile.dart`). Sent through untouched. */
export const REA_EXIT_TYPES = Object.freeze(['pressure', 'flow', 'power']);

export function sanitizeProfileForRea(profileData) {
    const profile = structuredClone(profileData);

    profile.version = profile.version || '2';
    for (const key of LEGACY_PROFILE_KEYS) delete profile[key];

    if (Array.isArray(profile.steps)) {
        for (const step of profile.steps) {
            const exit = step && step.exit;
            if (!exit || typeof exit !== 'object') continue;
            if (exit.type === 'weight') {
                if (step.weight === undefined || step.weight === null || step.weight === 0) {
                    step.weight = exit.value;
                }
                delete step.exit;
            } else if (exit.type === 'off') {
                step.exit = null;
            }
        }
    }
    return profile;
}

export function readProfileFile(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return Object.freeze({ ok: false, reason: 'not-a-profile', missing: Object.freeze([]) });
    }
    const missing = PROFILE_FILE_KEYS.filter(
        (key) => !Object.prototype.hasOwnProperty.call(parsed, key),
    );
    if (missing.length) {
        return Object.freeze({ ok: false, reason: 'missing-fields', missing: Object.freeze(missing) });
    }
    if (!Array.isArray(parsed.steps)) {
        return Object.freeze({ ok: false, reason: 'steps-not-an-array', missing: Object.freeze([]) });
    }
    return Object.freeze({ ok: true, profile: parsed });
}

export const PROFILE_FILE_KEYS = Object.freeze([
    'title',
    'author',
    'notes',
    'beverage_type',
    'steps',
    'version',
    'target_volume',
    'target_weight',
    'target_volume_count_start',
    'tank_temperature',
]);

export function newProfile({ title = '', stepName = '' } = {}) {
    return {
        title: typeof title === 'string' ? title : '',
        author: '',
        notes: '',
        beverage_type: 'espresso',
        steps: [newStep({ name: stepName })],
        version: '2',
        target_volume: 0,
        target_weight: 0,
        target_volume_count_start: 0,
        tank_temperature: 0,
    };
}

/**
 * Body for `POST /api/v1/profiles` — the profile is WRAPPED.
 * `profile_handler.dart` `_handleCreate` reads `json['profile']`, `json['parentId']`,
 * `json['metadata']`.
 */
export function profileCreateBody(profile, { parentId = null, metadata = null } = {}) {
    const body = { profile: sanitizeProfileForRea(profile) };
    if (parentId) body.parentId = parentId;
    if (metadata) body.metadata = metadata;
    return body;
}

export function profileUpdateBody({ profile = null, metadata = null } = {}) {
    const body = {};
    if (profile) body.profile = sanitizeProfileForRea(profile);
    if (metadata) body.metadata = metadata;
    return body;
}

export function workflowApplyBody(record) {
    const profile = isRecord(record) && isRecord(record.profile) ? record.profile : null;
    if (!profile) return null;
    const meta = profileMetadataOf(record) ?? {};

    const dose = finiteNumber(meta.targetDoseWeight) ?? DEFAULT_DOSE_G;
    const target = finiteNumber(meta.targetYield) ?? finiteNumber(profile.target_weight);
    const yielded = target ?? 0;
    const grinderSetting = meta.grinderSetting === undefined || meta.grinderSetting === null
        ? null : String(meta.grinderSetting);

    const sent = yielded > 0 ? { ...profile, target_weight: yielded } : profile;
    return {
        profile: sanitizeProfileForRea(sent),
        context: { targetDoseWeight: dose, targetYield: yielded, grinderSetting },
    };
}

/** The dose a record that remembers none is loaded with. The old app's own floor. */
export const DEFAULT_DOSE_G = 18;

/** A finite number, or undefined — `target_weight` can arrive as a numeric string. */
function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

export function profileArmBody(profile) {
    return sanitizeProfileForRea(profile);
}

export function profileFailureSentence(failure) {
    if (!failure || failure.ok !== false) return null;
    const problem = failure.problem;
    if (typeof problem === 'string') {
        const text = problem.trim();
        return text === '' ? null : text;
    }
    if (!problem || typeof problem !== 'object') return null;
    const message = typeof problem.message === 'string' ? problem.message.trim() : '';
    if (message !== '') return message;
    const error = typeof problem.error === 'string' ? problem.error.trim() : '';
    return error === '' ? null : error;
}

export function profileRefusal(failure) {
    if (!failure || failure.ok !== false || failure.status !== 400) return null;
    const problem = failure.problem;
    if (!problem || typeof problem !== 'object') return null;
    const error = typeof problem.error === 'string' ? problem.error : '';
    if (!error) return null;
    const kind = error === 'Unsupported profile' ? 'unsupported' : 'invalid';
    return Object.freeze({
        kind,
        error,
        message: typeof problem.message === 'string' ? problem.message : '',
    });
}
