/**
 * The profile library: the folders, the list, and the one draft a screen may be editing.
 */

import { buildPath, callRoute, routeById } from '../data/rea-routes.js';
import {
    profileRecordIdOf, profileTitleOf, profileMetadataOf,
    profileCreateBody, profileUpdateBody, readProfileFile, workflowApplyBody,
} from '../data/rea-profile.js';
import { r1LoadedProfileId, R1_SOURCE } from '../data/adapters-r.js';
import {
    readProfileListing,
    restorableProfiles,
    autoPopulateFavourites,
    healFavouriteAssignments,
    loadFavouriteAssignments,
    saveFavouriteAssignments,
    loadLoadedProfileId,
    saveLoadedProfileId,
    rememberedRecord,
    shouldAutoPopulate,
    shortProfileTitle,
    FAVOURITE_SLOT_COUNT,
} from '../lib/profile-rules.js';
import { supersededIds } from '../lib/profile-lineage.js';
import { createStore } from './store.js';
import { ARM_STATUS } from './profile-arm-store.js';

export const D6_PURGE_IS_LANDED = Object.freeze({
    half: 'purge deleted profiles',
    landed: '25 August 2026',
    why: 'Behind a confirm that says plainly it cannot be undone.',
    routeId: 'deleteProfilesByIdPurge',
});

/** Where the listing got to. */
export const LIBRARY_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
});

/** Where a restore-to-factory got to. */
export const RESTORE_STATUS = Object.freeze({
    IDLE: 'idle',
    RESTORING: 'restoring',
    RESTORED: 'restored',
    FAILED: 'failed',
});

/** Where a versions read got to. `NONE` is a lineage of ONE — the profile, and no siblings. */
export const ADD_STATUS = Object.freeze({
    IDLE: 'idle',
    ADDING: 'adding',
    ADDED: 'added',
    REFUSED: 'refused',
    FAILED: 'failed',
});

/** The two plugins the add paths reach, by ReaPrime's own ids. */
export const VISUALIZER_PLUGIN = 'visualizer.reaplugin';

export const GENERATOR_PLUGIN = 'decent-profile.reaplugin';

export const VERSIONS_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    NONE: 'none',
    FAILED: 'failed',
});

/** What `setFavourite` did. */
export const ASSIGN_RESULT = Object.freeze({
    ASSIGNED: 'assigned',
    REFUSED_DUPLICATE: 'refused-duplicate',
    REFUSED_SLOT: 'refused-slot',
    FAILED: 'failed',
});

/** What `hide` or `purge` did. */
export const MANAGE_RESULT = Object.freeze({
    DONE: 'done',
    NO_RECORD: 'no-record',
    FAILED: 'failed',
});

const NOOP_LOGGER = Object.freeze({
    debug() {}, info() {}, warn() {}, error() {}, scope() { return NOOP_LOGGER; },
});

const scoped = (logger) => (logger && logger.scope ? logger.scope('profiles') : (logger || NOOP_LOGGER));

const EMPTY_LOADED = Object.freeze({
    id: null,
    title: null,
    known: false,
    /** True while the id came from R1's TITLE MATCH. The screen marks the row off this. */
    provisional: false,
    /** `R1_SOURCE` — 'workflow-id' once R1 lands, 'title-match' until then, else null. */
    source: null,
    /** The R layer's own flag, true on every adapter answer. Not the marking. */
    layerProvisional: false,
    /** The recipe the machine is running, as served. */
    profile: null,
    /** Whether the id is the machine's own answer rather than a guess. */
    confirmed: false,
    basis: null,
    reason: null,
    candidates: null,
});

const EMPTY_STATE = Object.freeze({
    status: LIBRARY_STATUS.IDLE,
    /** Every record the server served, unfiltered — `restorableProfiles` needs the hidden. */
    records: Object.freeze([]),
    /** Rule 1's answer: what a listing may show. */
    listable: Object.freeze([]),
    /** The records the library is hiding — what the Hidden toggle shows. */
    hidden: Object.freeze([]),
    /** Hidden AND isDefault: the restore offer list. */
    restorable: Object.freeze([]),
    /** The row the user is looking at. */
    selectedId: null,
    /** R1's answer, whole. See the header. */
    loaded: EMPTY_LOADED,
    /** `{0..4: id|null}` plus whether a person has ever chosen (rule 5). */
    favourites: Object.freeze({ assignments: Object.freeze({}), seeded: false }),
    /** The arm-time refusal, as `profileRefusal` reads it. */
    refusal: null,
    /** A non-400 arm fault. Never a refusal. */
    armError: null,
    armingId: null,
    restore: Object.freeze({ status: RESTORE_STATUS.IDLE, filename: null, error: null }),
    versions: Object.freeze({ status: VERSIONS_STATUS.IDLE, id: null, records: Object.freeze([]) }),
    /** The last add attempt — a file, a share code, or nothing yet. */
    add: Object.freeze({ status: ADD_STATUS.IDLE, reason: null, error: null }),
    /** How the listing has been read. `conditional` counts the 304s the transport served. */
    reads: Object.freeze({ listing: 0, conditional: 0, failed: 0 }),
    /** The transport failure behind `status: failed`, verbatim. */
    error: null,
});

export function matchProfiles(records, query) {
    const wanted = String(query ?? '').trim().toLowerCase();
    if (wanted === '') return [...records];
    return records.filter((record) => {
        const title = (profileTitleOf(record) || '').toLowerCase();
        if (title.includes(wanted)) return true;
        const author = record && record.profile && typeof record.profile.author === 'string'
            ? record.profile.author.toLowerCase() : '';
        return author.includes(wanted);
    });
}

/** The bundle filename a restore reads, or null if this record was not bundled. */
export function restoreFilenameOf(record) {
    const metadata = profileMetadataOf(record);
    const filename = metadata && typeof metadata.filename === 'string' ? metadata.filename : '';
    return filename === '' ? null : filename;
}

function listableLoadedId(listable, loaded) {
    const id = loaded?.id ?? null;
    if (!id) return null;
    return listable.some((record) => record?.id === id) ? id : null;
}

const isBody = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function sameBody(a, b) {
    if (Object.is(a, b)) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => sameBody(item, b[i]));
    }
    if (!isBody(a) || !isBody(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && sameBody(a[key], b[key]));
}

function activeRecipeOf(report) {
    const profile = isBody(report) && isBody(report.profile) ? report.profile : null;
    return profile ? structuredClone(profile) : null;
}

function holdsActiveRecipe(record, active) {
    if (!active || !isBody(record)) return false;
    if (sameBody(active, record.profile ?? null)) return true;
    const armed = workflowApplyBody(record);
    return Boolean(armed) && sameBody(active, armed.profile);
}

function recordWithId(records, id) {
    if (!Array.isArray(records) || !id) return null;
    return records.find((record) => isBody(record) && record.id === id) ?? null;
}

export const LOADED_UNRESOLVED = Object.freeze({
    CONTENT_MISMATCH: 'contentMismatch',
});

export const LOADED_SOURCE = Object.freeze({
    /** `report.profile.id` — R1 has landed and the machine names the record itself. */
    WORKFLOW_ID: R1_SOURCE.WORKFLOW_ID,
    /** Matched by title against the listing. Right whenever the title is unique. */
    TITLE_MATCH: R1_SOURCE.TITLE_MATCH,
    /** The id this skin armed, still carrying the title the machine is running. */
    REMEMBERED: 'remembered',
});

export function createProfileLibraryStore({
    transport, storage, arm, workflow = null, logger = null, now = () => Date.now(),
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createProfileLibraryStore: a transport must be injected (see createReaTransport)');
    }
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('createProfileLibraryStore: a storage router must be injected (see createStorageRouter)');
    }
    if (!arm || typeof arm.arm !== 'function') {
        throw new Error('createProfileLibraryStore: a profile arm store must be injected');
    }
    const log = scoped(logger);
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileLibrary', logger: log });
    let armedId = null;
    const patch = (fields) => store.set({ ...store.get(), ...fields });

    const unwatchArm = arm.subscribe((armState) => {
        patch({ refusal: armState.refusal ?? null, armError: armState.error ?? null });
    });

    /** The listing, partitioned, with R1's answer over it. One read of each route. */
    async function readListing() {
        const listing = await readProfileListing(transport, { logger });
        const reads = store.get().reads;
        if (!listing.ok) {
            log.warn(`profile listing unusable: ${listing.reason}`);
            patch({
                status: LIBRARY_STATUS.FAILED,
                error: listing.failure,
                reads: { ...reads, listing: reads.listing + 1, failed: reads.failed + 1 },
            });
            return store.get();
        }
        return {
            listing,
            reads: {
                listing: reads.listing + 1,
                conditional: reads.conditional + (listing.notModified ? 1 : 0),
                failed: reads.failed,
            },
        };
    }

    async function readLoaded(records) {
        const result = await callRoute(transport, 'getWorkflow');
        const report = result.ok ? result.data : null;
        if (!result.ok) log.debug(`workflow read failed (${result.message}) — no loaded-profile highlight`);
        const answer = r1LoadedProfileId(report, records);
        const value = answer.value || {};
        const active = activeRecipeOf(report);

        if (!value.id) {
            const remembered = rememberedRecord(
                records, armedId ?? await loadLoadedProfileId(storage), value.title ?? title(report));
            if (remembered && holdsActiveRecipe(remembered, active)) {
                return Object.freeze({
                    id: remembered.id,
                    title: remembered.profile.title,
                    known: true,
                    provisional: true,
                    source: LOADED_SOURCE.REMEMBERED,
                    layerProvisional: answer.provisional === true,
                    profile: active,
                    confirmed: true,
                    basis: 'the id this skin armed, and the record still carries the recipe the machine is running',
                    reason: null,
                    candidates: Array.isArray(value.candidates)
                        ? Object.freeze([...value.candidates]) : null,
                });
            }
            if (remembered) {
                log.info(`the remembered profile ${remembered.id} no longer carries the recipe the `
                    + 'machine is running — something else has loaded one since');
            }
        }

        if (value.id && value.source === R1_SOURCE.TITLE_MATCH
            && !holdsActiveRecipe(recordWithId(records, value.id), active)) {
            log.info(`'${value.title}' matches ${value.id} by title, and that record carries a `
                + 'different recipe — the loaded profile is UNRESOLVED');
            return Object.freeze({
                id: null,
                title: value.title ?? null,
                known: false,
                provisional: false,
                source: null,
                layerProvisional: answer.provisional === true,
                profile: active,
                confirmed: false,
                basis: 'a record carries this title and does NOT carry this recipe — a title is not an identity',
                reason: LOADED_UNRESOLVED.CONTENT_MISMATCH,
                candidates: Object.freeze([value.id]),
            });
        }

        return Object.freeze({
            id: value.id ?? null,
            title: value.title ?? null,
            known: answer.known === true,
            provisional: value.source === R1_SOURCE.TITLE_MATCH,
            source: value.source ?? null,
            /** The adapter's own flag for the whole R layer, kept so nothing is lost. */
            layerProvisional: answer.provisional === true,
            profile: active,
            confirmed: Boolean(value.id),
            basis: answer.basis ?? null,
            reason: value.reason ?? null,
            candidates: Array.isArray(value.candidates) ? Object.freeze([...value.candidates]) : null,
        });
    }

    /** The workflow report's own profile title, or null. R1 reads the same field. */
    function title(report) {
        const profile = report && typeof report === 'object' && report.profile
            && typeof report.profile === 'object' ? report.profile : null;
        return profile && typeof profile.title === 'string' && profile.title !== ''
            ? profile.title : null;
    }

    async function readFavourites(listable, all) {
        const held = await loadFavouriteAssignments(storage, { count: FAVOURITE_SLOT_COUNT });
        if (!shouldAutoPopulate(held)) {
            const heal = healFavouriteAssignments(held.assignments, all, { count: FAVOURITE_SLOT_COUNT });
            if (heal.healed) {
                for (const change of heal.changes) {
                    log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                        + `healed to ${change.to} (${change.basis})`);
                }
                const save = await saveFavouriteAssignments(storage, heal.assignments, {
                    markUserInitialized: false, logger,
                });
                if (!save.saved) {
                    log.warn('the healed favourite rail did not persist — it is correct in '
                        + 'this session and the next launch will heal it again');
                }
            }
            return Object.freeze({
                assignments: Object.freeze({ ...heal.assignments }),
                seeded: held.seeded,
            });
        }
        const populated = await autoPopulateFavourites({ storage, records: listable, logger });
        return Object.freeze({
            assignments: Object.freeze({ ...populated.assignments }),
            seeded: false,
        });
    }

    async function armRecord(record, recordId) {
        const armed = await arm.arm(record.profile, { profileId: recordId });
        if (!armed || armed.status === ARM_STATUS.REFUSED) return armed;

        armedId = recordId;
        await saveLoadedProfileId(storage, armedId);

        if (!workflow) return armed;
        const body = workflowApplyBody(record);
        if (body) await workflow.apply(body, { label: `profile '${profileTitleOf(record)}'` });
        await api.load();
        return armed;
    }

    const api = {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** The record behind an id, or null. The screen never indexes the array itself. */
        recordFor(id) {
            if (!id) return null;
            return store.get().records.find((record) => profileRecordIdOf(record) === id) || null;
        },

        /** The selected record, or null. */
        selected() { return api.recordFor(store.get().selectedId); },

        /** The recipe the machine is running, shaped as an editor draft, or null. */
        activeDraft() {
            const profile = store.get().loaded?.profile ?? null;
            if (!profile) return null;
            return Object.freeze({
                id: null, profile: structuredClone(profile), parentId: null, metadata: null,
            });
        },

        /** Rule 2's short label for a record — the five fixed-width favourite slots. */
        shortTitle(record) { return shortProfileTitle(profileTitleOf(record) || ''); },

        async load() {
            patch({ status: LIBRARY_STATUS.LOADING, error: null });
            const first = await readListing();
            if (!first.listing) return first;
            const { listing, reads } = first;

            const [loaded, favourites] = await Promise.all([
                readLoaded(listing.all),
                readFavourites(listing.listable, listing.all),
            ]);

            const restorable = restorableProfiles(listing.all).filter((r) => restoreFilenameOf(r) !== null);
            const superseded = supersededIds(listing.all);
            log.info(`profile library: ${listing.listable.length} listable, ${restorable.length} restorable, `
                + `${superseded.size} superseded, `
                + `loaded ${loaded.id ?? `unresolved (${loaded.reason})`}`);

            return patch({
                status: LIBRARY_STATUS.READY,
                records: Object.freeze([...listing.all]),
                listable: Object.freeze([...listing.listable]),
                hidden: Object.freeze(
                    [...listing.hidden, ...listing.deleted]
                        .filter((record) => !superseded.has(profileRecordIdOf(record)))),
                restorable: Object.freeze(restorable),
                loaded,
                selectedId: store.get().selectedId ?? listableLoadedId(listing.listable, loaded) ?? null,
                favourites,
                reads: Object.freeze(reads),
                error: null,
            });
        },

        /** Re-read the listing only. The rail and the highlight are re-derived off it. */
        async refresh() { return api.load(); },

        /** Pick a row. Clears nothing else — a refusal survives until it is acknowledged. */
        select(id) {
            if (store.get().selectedId === id) return store.get();
            return patch({ selectedId: id ?? null });
        },

        async purge(id = store.get().selectedId) {
            const ended = (outcome, error = null) => Object.freeze({
                result: outcome, id: id ?? null, error, state: store.get(),
            });
            const record = api.recordFor(id);
            if (!record) {
                log.warn('purge: no record for that id');
                return ended(MANAGE_RESULT.NO_RECORD);
            }
            const result = await callRoute(transport, 'deleteProfilesByIdPurge', { params: { id } });
            if (!result.ok && result.status !== 404) {
                log.warn(`purge ${id} failed: ${result.message}`);
                return ended(MANAGE_RESULT.FAILED, result);
            }
            log.info(`purge ${id}: removed`);
            patch({ selectedId: null });
            await api.load();
            return ended(MANAGE_RESULT.DONE);
        },

        async arm(id = store.get().selectedId) {
            const record = api.recordFor(id);
            if (!record) {
                log.warn('arm: no record for the selected id');
                return null;
            }
            const recordId = profileRecordIdOf(record);
            /* THE HIGHLIGHT MOVES HERE, BEFORE THE FIRST REQUEST, and it is the store's
             * own fact rather than a screen's guess. See `armingId` on EMPTY_STATE. */
            patch({ armingId: recordId });
            try {
                return await armRecord(record, recordId);
            } finally {
                patch({ armingId: null });
            }
        },

        async rememberContext(fields) {
            if (!fields || typeof fields !== 'object') return store.get();
            const id = store.get().loaded ? store.get().loaded.id : null;
            const record = id ? api.recordFor(id) : null;
            if (!record) return store.get();
            const metadata = { ...(profileMetadataOf(record) ?? {}), ...fields };
            const result = await callRoute(transport, 'putProfilesById', {
                params: { id: profileRecordIdOf(record) },
                body: profileUpdateBody({ metadata }),
            });
            if (!result.ok) {
                log.warn(`remembering the profile's numbers failed: ${result.message}`);
                return store.get();
            }
            const recordId = profileRecordIdOf(record);
            const patched = Object.freeze({ ...record, metadata: Object.freeze(metadata) });
            const swap = (list) => Object.freeze(
                list.map((r) => (profileRecordIdOf(r) === recordId ? patched : r)));
            const held = store.get();
            return patch({
                records: swap(held.records),
                listable: swap(held.listable),
                restorable: swap(held.restorable),
            });
        },

        /** The user acknowledged the refusal, or picked something else. */
        clearRefusal() { arm.clear(); return store.get(); },

        async restoreToFactory(id) {
            const record = api.recordFor(id);
            const filename = restoreFilenameOf(record);
            if (!filename) {
                log.warn('restore: this record carries no bundle filename — not a bundled profile');
                return patch({
                    restore: { status: RESTORE_STATUS.FAILED, filename: null, error: null },
                });
            }
            patch({ restore: { status: RESTORE_STATUS.RESTORING, filename, error: null } });
            const result = await callRoute(transport, 'postProfilesRestoreByFilename', {
                params: { filename },
            });
            if (!result.ok) {
                log.warn(`restore ${filename} failed: ${result.message}`);
                return patch({ restore: { status: RESTORE_STATUS.FAILED, filename, error: result } });
            }
            patch({ restore: { status: RESTORE_STATUS.RESTORED, filename, error: null } });
            await api.load();
            return store.get();
        },

        async hide(id = store.get().selectedId) {
            const ended = (outcome, error = null) => Object.freeze({
                result: outcome, id: id ?? null, error, state: store.get(),
            });
            const record = api.recordFor(id);
            if (!record) {
                log.warn('hide: no record for that id');
                return ended(MANAGE_RESULT.NO_RECORD);
            }
            const result = await callRoute(transport, 'deleteProfilesById', { params: { id } });
            if (!result.ok && result.status !== 404) {
                log.warn(`hide ${id} failed: ${result.message}`);
                return ended(MANAGE_RESULT.FAILED, result);
            }
            patch({ selectedId: null });
            await api.load();
            return ended(MANAGE_RESULT.DONE);
        },

        async createFromFile(text) {
            let parsed;
            try {
                parsed = JSON.parse(String(text));
            } catch {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: 'not-json', error: null } });
                return store.get();
            }
            const read = readProfileFile(parsed);
            if (!read.ok) {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: read.reason, missing: read.missing, error: null } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDING, reason: null, error: null } });
            const result = await callRoute(transport, 'postProfiles', {
                body: profileCreateBody(read.profile),
            });
            if (!result.ok) {
                log.warn(`profile upload failed: ${result.message}`);
                patch({ add: { status: ADD_STATUS.FAILED, reason: null, error: result } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDED, reason: null, error: null } });
            await api.load();
            return store.get();
        },

        async importShareCode(code) {
            const shareCode = String(code ?? '').trim();
            if (!shareCode) {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: 'no-code', error: null } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDING, reason: null, error: null } });
            const result = await callRoute(transport, 'postPluginsByIdByEndpoint', {
                params: { id: VISUALIZER_PLUGIN, endpoint: 'import' },
                body: { shareCode },
            });
            if (!result.ok) {
                const reason = result.status === 401 ? 'not-signed-in'
                    : (result.status === 400 ? 'bad-code' : null);
                log.info(`share code not imported (${result.status}): ${result.message}`);
                patch({
                    add: {
                        status: reason ? ADD_STATUS.REFUSED : ADD_STATUS.FAILED,
                        reason,
                        error: result,
                    },
                });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDED, reason: null, error: null } });
            await api.load();
            return store.get();
        },

        /** Forget the last add — what a dialog's close asks for. */
        clearAdd() {
            if (store.get().add.status === ADD_STATUS.IDLE) return store.get();
            return patch({ add: { status: ADD_STATUS.IDLE, reason: null, error: null } });
        },

        async generatorUrl() {
            const result = await callRoute(transport, 'getPlugins', {});
            if (!result.ok || !Array.isArray(result.data)) return null;
            const plugin = result.data.find((entry) => entry && entry.id === GENERATOR_PLUGIN);
            if (!plugin || plugin.loaded !== true) return null;
            const path = buildPath(routeById('getPluginsByIdByEndpoint'),
                { id: GENERATOR_PLUGIN, endpoint: 'ui' });
            const base = String(transport.baseUrl ?? '').replace(/\/+$/, '');
            return `${base}${path}?layout=baseline`;
        },

        async versionsOf(id) {
            const wanted = id ?? store.get().selectedId;
            if (!wanted) return store.get();
            patch({ versions: { status: VERSIONS_STATUS.LOADING, id: wanted, records: Object.freeze([]) } });
            const result = await callRoute(transport, 'getProfilesByIdLineage', { params: { id: wanted } });
            if (result.ok && Array.isArray(result.data)) {
                return patch({
                    versions: {
                        status: result.data.length > 1 ? VERSIONS_STATUS.READY : VERSIONS_STATUS.NONE,
                        id: wanted,
                        records: Object.freeze([...result.data]),
                    },
                });
            }
            log.warn(`lineage for ${wanted} failed: ${result.message}`);
            return patch({
                versions: { status: VERSIONS_STATUS.FAILED, id: wanted, records: Object.freeze([]) },
            });
        },

        clearVersions() {
            return patch({ versions: { status: VERSIONS_STATUS.IDLE, id: null, records: Object.freeze([]) } });
        },

        async setFavourite(slot, id) {
            const ended = (result, extra = {}) => Object.freeze({
                result, slot, id: id ?? null, held: null, state: store.get(), ...extra,
            });
            const index = Number(slot);
            if (!Number.isInteger(index) || index < 0 || index >= FAVOURITE_SLOT_COUNT) {
                log.warn(`setFavourite: slot ${slot} is outside 0..${FAVOURITE_SLOT_COUNT - 1}`);
                return ended(ASSIGN_RESULT.REFUSED_SLOT);
            }
            const held = api.favouriteSlotHolding(id);
            if (held !== null) {
                log.info(`setFavourite: refused — ${id} is already on slot ${held}`);
                return ended(ASSIGN_RESULT.REFUSED_DUPLICATE, { held });
            }
            const current = store.get().favourites;
            const heal = healFavouriteAssignments(
                current.assignments, store.get().records, { count: FAVOURITE_SLOT_COUNT },
            );
            const { assignments } = heal;
            for (const change of heal.changes) {
                if (change.slot === index) continue;
                log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                    + `healed to ${change.to} (${change.basis}) while writing slot ${index}`);
            }
            assignments[index] = id ?? null;
            const save = await saveFavouriteAssignments(storage, assignments, { logger });
            if (!save.saved) {
                log.warn('favourite not persisted — the rail is left as it was');
                return ended(ASSIGN_RESULT.FAILED);
            }
            const state = patch({
                favourites: Object.freeze({ assignments: Object.freeze(assignments), seeded: save.marked }),
            });
            return Object.freeze({
                result: ASSIGN_RESULT.ASSIGNED, slot, id: id ?? null, held: null, state,
            });
        },

        async healFavourites() {
            const current = store.get().favourites;
            const heal = healFavouriteAssignments(
                current.assignments, store.get().records, { count: FAVOURITE_SLOT_COUNT },
            );
            if (!heal.healed) return heal.changes;
            for (const change of heal.changes) {
                log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                    + `healed to ${change.to} (${change.basis})`);
            }
            /* RULE 5 AGAIN: a repair is not a choice, so it never marks the rail
             * user-initialised. See `readFavourites` for the full argument. */
            const save = await saveFavouriteAssignments(storage, heal.assignments, {
                markUserInitialized: false, logger,
            });
            if (!save.saved) {
                log.warn('the healed favourite rail did not persist — it is correct in this '
                    + 'session and the next launch will heal it again');
            }
            patch({
                favourites: Object.freeze({
                    assignments: Object.freeze({ ...heal.assignments }),
                    seeded: current.seeded,
                }),
            });
            return heal.changes;
        },

        favouriteSlotHolding(id) {
            if (!id) return null;
            const { assignments } = store.get().favourites;
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                if (assignments[slot] === id) return slot;
            }
            return null;
        },

        /** The first empty slot, or null when the rail is full. */
        firstEmptySlot() {
            const { assignments } = store.get().favourites;
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                if (!assignments[slot]) return slot;
            }
            return null;
        },

        favouriteEntries() {
            const { assignments } = store.get().favourites;
            const out = [];
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                const id = assignments[slot] || null;
                const record = id ? api.recordFor(id) : null;
                out.push(record
                    ? { value: id, name: api.shortTitle(record) }
                    : null);
            }
            return out;
        },

        /** The last time anything was published, for a caller that wants to age the view. */
        at() { return now(); },

        stop() {
            unwatchArm();
            store.destroy();
        },
    };

    return api;
}
