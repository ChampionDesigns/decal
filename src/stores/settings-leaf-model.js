/**
 * What a leaf pane needs in order to paint one leaf, and the only place the registry, the routing table, the limits table and the capability array are joined.
 */

import { createStore } from './store.js';
import { defaultFor, hasDefault, machineFallbackFor } from '../lib/settings-defaults.js';
import {
    SOURCE,
    ARCHETYPE,
    RESTORE,
    rowsForLeaf,
    noteForLeaf,
    pendingForLeaf,
    leafReadsMachineDoc,
} from '../lib/settings-leaves.js';
import { hasLimit, step as stepLimit, clamp, padBand } from '../lib/machine-limits.js';
import { rowShownOn } from '../lib/settings-nav.js';
import {
    TEMP_UNIT, TEMP_UNIT_KEY, DEFAULT_TEMP_UNIT, normaliseUnit, unitSymbol,
    toDisplayTemp, fromDisplayTemp, displayRange, displayRangeHint, decimalsForStep,
} from '../lib/temperature.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

const PANEL_SETTINGS = Object.freeze({
    wakeLock: Object.freeze({
        /** What ReaPrime says THIS CLIENT asked for. `undefined` = no frame yet. */
        read: (panel) => panel.wakeLockOverride?.(),
        /** Take the override, or release it. Answers the `{ok, reason}` shape. */
        write: (panel, value) => panel.setWakeLock?.(value === true),
    }),
    brightness: Object.freeze({
        /** What the display frame reports. `undefined` = no frame yet, so the store answers. */
        read: (panel) => panel.brightnessServed?.(),
        /** Command the panel. Answers the `{ok, reason}` shape, so a refusal is reportable. */
        write: (panel, value) => panel.setBrightness?.(Number(value)),
    }),
});

/** Exported for the suite, which checks it names the same set the registry does. */
export const PANEL_SETTING_NAMES = Object.freeze(Object.keys(PANEL_SETTINGS));

/** What went wrong with a machine write. Reportable — the screen shows it, never a shrug. */
export const COMMIT_REFUSAL = Object.freeze({
    NO_MACHINE_PORT: 'noMachinePort',
    WRITE_FAILED: 'writeFailed',
    MEMORY_NOT_SAVED: 'memoryNotSaved',
});

export function createSettingsLeafModel({
    settings, machine = null, limits = null, machineClass = null, panel = null,
    logger = NOOP_LOGGER,
} = {}) {
    /* THE TABLE, RESOLVED AT EVERY USE. A plain object is still accepted and still
     * behaves as it did — it is simply a table that never changes. */
    const limitsNow = typeof limits === 'function' ? limits : () => limits;
    /* AND THE CLASS THE SAME WAY, for the same asynchronous reason — see the parameter. */
    const machineClassNow = typeof machineClass === 'function' ? machineClass : () => machineClass;
    if (!settings || typeof settings.value !== 'function' || typeof settings.set !== 'function') {
        throw new Error('createSettingsLeafModel: the settings store must be injected (src/stores/settings-store.js)');
    }
    const log = logger.scope ? logger.scope('settings-leaf') : logger;

    const machineValues = new Map();
    const staged = new Map();

    const stagedMemory = new Map();

    const FORGET = null;
    const beacon = createStore({ version: 0, changeCount: 0, machineLoaded: false }, {
        label: 'settings-leaf', logger: log, freeze: false,
    });

    let machineLoaded = false;

    /** The machine read in flight, so concurrent page opens share one. */
    let inFlightMachineRead = null;

    const bump = () => beacon.set({
        version: beacon.get().version + 1,
        changeCount: staged.size,
        machineLoaded,
    });

    /** The display unit right now: the stored preference, else Celsius. */
    function tempUnitNow() {
        return normaliseUnit(settings.value(TEMP_UNIT_KEY)) ?? DEFAULT_TEMP_UNIT;
    }

    function isTemperatureRow(row) {
        const limits = limitsNow();
        if (row.limit && limits && hasLimit(limits, row.limit)) return limits[row.limit].unit === '°C';
        return row.unit === '°C';
    }

    const tempFormatters = new Map();
    function tempFormatter(decimals) {
        if (!tempFormatters.has(decimals)) {
            tempFormatters.set(decimals, (value) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return String(value);
                return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
            });
        }
        return tempFormatters.get(decimals);
    }

    /** The unit to CONVERT INTO for this row, or null when nothing should move. */
    function displayUnitFor(row) {
        if (!isTemperatureRow(row)) return null;
        const unit = tempUnitNow();
        return unit === TEMP_UNIT.FAHRENHEIT ? unit : null;
    }

    /** The hint beside a label. A STRING the screen composed — #29 owns no range table. */
    function hintFor(row, variant = null) {
        const limits = limitsNow();
        if (!row.limit || !limits || !hasLimit(limits, row.limit)) return '';
        return displayRangeHint(limits[row.limit], displayUnitFor(row), variant?.unit
            ? { unit: variant.unit, zeroMeans: variant.zeroMeans }
            : undefined);
    }

    /** min / max / step / unit for a stepper. Absent limit -> unbounded, and it says so. */
    function boundsFor(row) {
        const limits = limitsNow();
        if (row.limit && limits && hasLimit(limits, row.limit)) {
            const range = limits[row.limit];
            const display = displayUnitFor(row);
            if (display) {
                const shown = displayRange(range, display);
                const inC = (value) => fromDisplayTemp(Number(value), display);
                const out = (celsius) => toDisplayTemp(celsius, display);
                return Object.freeze({
                    min: shown.min,
                    max: shown.max,
                    step: shown.step,
                    unit: shown.unit,
                    bounded: true,
                    floor: shown.floor,
                    decimals: shown.decimals,
                    format: tempFormatter(shown.decimals),
                    next: (value, direction) => out(stepLimit(limits, row.limit, inC(value), direction)),
                    clamp: (value) => out(clamp(limits, row.limit, inC(value))),
                });
            }
            return Object.freeze({
                min: range.min,
                max: range.max,
                step: range.step,
                unit: range.unit ?? '',
                bounded: true,
                /** The hole, where the row has one — the keypad's, not the stepper's. See
                 *  the converted branch above for why it is carried. */
                floor: range.floor,
                decimals: decimalsForStep(range.step),
                /** Only a converted temperature needs one; the rest print their own step. */
                format: null,
                next: (value, direction) => stepLimit(limits, row.limit, value, direction),
                clamp: (value) => clamp(limits, row.limit, value),
            });
        }
        const display = displayUnitFor(row);
        return Object.freeze({
            min: null,
            max: null,
            step: null,
            unit: display ? unitSymbol(display) : (row.unit ?? ''),
            bounded: false,
            /** No band, no step, no precision to state. Null, never a number picked here. */
            decimals: null,
            next: null,
            clamp: null,
            format: null,
        });
    }

    function atRowPrecision(row, value) {
        const limits = limitsNow();
        if (!row.limit || !limits || !hasLimit(limits, row.limit)) return value;
        const n = Number(value);
        if (!Number.isFinite(n)) return value;
        const rounded = Number(n.toFixed(decimalsForStep(limits[row.limit].step)));
        return Object.is(rounded, n) ? value : rounded;
    }

    /** True when this row's number is the user's own staged intent rather than a read. */
    function isStagedEdit(row) {
        return row.source === SOURCE.MACHINE && !row.derivedFrom && staged.has(row.field);
    }

    function valueFor(row) {
        const raw = heldValueFor(row);
        const held = (displayUnitFor(row) || isStagedEdit(row)) ? raw : atRowPrecision(row, raw);
        if (row.fieldValues) return itemValueOf(row, held);
        const display = displayUnitFor(row);
        if (display && Number.isFinite(Number(held))) return toDisplayTemp(Number(held), display);
        return held;
    }

    /** The item value a held machine value names, or undefined when the machine is silent. */
    function itemValueOf(row, held) {
        if (held === undefined || held === null) return undefined;
        for (const [item, machineValue] of Object.entries(row.fieldValues)) {
            if (machineValue === held) return item;
        }
        return undefined;
    }

    /** The value as the machine holds it, in the machine's own unit. */
    function heldValueFor(row) {
        if (row.source === SOURCE.MACHINE) {
            /* A BANK THAT IS A VIEW OVER SEVERAL FIELDS ANSWERS FROM ALL OF THEM. See
             * `derivedValueFor` — the row names no single `field`, so there is nothing for
             * the three lines below to look up. */
            if (row.derivedFrom) return derivedValueFor(row);
            if (staged.has(row.field)) return staged.get(row.field);
            if (machineValues.has(row.field)) return machineValues.get(row.field);
            return machineFallbackFor(row.field);
        }
        if (row.source === SOURCE.ROUTE) {
            if (row.panel && panel) {
                const served = PANEL_SETTINGS[row.panel]?.read(panel);
                if (served !== undefined) return served;
            }
            return settings.value(row.key);
        }
        return undefined;
    }

    /** One machine field, staged edit first — the lookup `heldValueFor` does, by name. */
    function fieldNow(field) {
        if (staged.has(field)) return staged.get(field);
        if (machineValues.has(field)) return machineValues.get(field);
        return machineFallbackFor(field);
    }

    function restoreValueFor(row, field) {
        const held = Number(fieldNow(field));
        if (Number.isFinite(held) && held > 0) return held;
        const fallback = Number(machineFallbackFor(field));
        if (Number.isFinite(fallback) && fallback > 0) return fallback;
        const floor = Number(bandFloorFor(row, field));
        return Number.isFinite(floor) && floor > 0 ? floor : 0;
    }

    /** The bottom of the band the leaf's own control for `field` offers, or undefined. */
    function bandFloorFor(row, field) {
        const owner = rowsForLeaf(row.leaf).find((other) => other.field === field && other.limit);
        const limits = limitsNow();
        if (!owner || !limits || !hasLimit(limits, owner.limit)) return undefined;
        return limits[owner.limit].min;
    }

    function derivedValueFor(row) {
        let anyKnown = false;
        for (const { field, is } of row.derivedFrom) {
            const value = fieldNow(field);
            if (value === undefined || value === null) continue;
            anyKnown = true;
            if (Number(value) > 0) return is;
        }
        return anyKnown ? row.whenNone : undefined;
    }

    function itemsFor(row) {
        const items = row.items ?? null;
        if (!items) return null;
        if (!items.some((item) => item.capability || item.sensor)) return items;
        return Object.freeze(items.map((item) => {
            if (!item.capability && !item.sensor) return item;
            const gate = item.sensor
                ? settings.gateSensor(item.sensor)
                : settings.gateCapability(item.capability);
            return Object.freeze({ ...item, disabled: gate.surface !== 'shown' });
        }));
    }

    function resolveDisabled(row, items, value) {
        if (!items || row.unavailable === undefined) return value;
        const chosen = items.find((item) => String(item.value) === String(value));
        return chosen && chosen.disabled ? row.unavailable : value;
    }

    function resolvedValueFor(row) {
        return resolveDisabled(row, itemsFor(row), valueFor(row));
    }

    function checkedFor(row) {
        const value = valueFor(row);
        if (row.zeroSwitch) return Number(value) > 0;
        if (value === undefined) return false;
        return row.invert ? !value : Boolean(value);
    }

    /** A positive number, or undefined. Every rung of the ladder below is filtered by it. */
    function positiveNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : undefined;
    }

    function restoreTargetFor(row) {
        if (stagedMemory.has(row.zeroSwitch)) {
            const staged1 = positiveNumber(stagedMemory.get(row.zeroSwitch));
            if (staged1 !== undefined) return staged1;
        }
        const stored = typeof settings.storedValue === 'function'
            ? positiveNumber(settings.storedValue(row.zeroSwitch))
            : undefined;
        if (stored !== undefined) return stored;

        if (row.heldField) {
            const held = positiveNumber(fieldNow(row.heldField));
            if (held !== undefined) return held;
        }

        const decided = positiveNumber(settings.value(row.zeroSwitch));
        if (decided !== undefined) return decided;

        return machineFallbackFor(row.field);
    }

    function masterFor(row) {
        if (!row.enabledBy) return null;
        const first = gatesOf(row)[0];
        return first ? gateMasterFor(row, first) : null;
    }

    function gatesOf(row) {
        if (!row.enabledBy) return [];
        return Array.isArray(row.enabledBy) ? row.enabledBy : [row.enabledBy];
    }

    /** The row one gate names, or null. Gates name ROW IDS — see `masterFor`. */
    function gateMasterFor(row, gate) {
        const id = typeof gate === 'string' ? gate : gate.row;
        return rowsForLeaf(row.leaf).find((other) => other.id === id) ?? null;
    }

    function pendingFor(row) {
        if (row.source === SOURCE.MACHINE) {
            /* A DERIVED ROW READS SEVERAL FIELDS OF THE ONE DOCUMENT, so the document's own
             * state is the answer for it too. */
            return !machineLoaded;
        }
        if (row.source === SOURCE.ROUTE) {
            if (row.panel && panel && PANEL_SETTINGS[row.panel]?.read(panel) !== undefined) {
                return false;
            }
            return typeof settings.isLoaded === 'function' ? !settings.isLoaded(row.key) : false;
        }
        return false;
    }

    function inertFor(row) {
        if (row.supportedBy && fieldNow(row.supportedBy) === false) return true;
        const gates = gatesOf(row);
        if (gates.length === 0) return false;
        return gates.some((gate) => gateSaysInert(row, gate));
    }

    function notesFor(row) {
        const notes = (row.items ?? []).map((item) => item.note).filter(Boolean);
        if (row.unsupportedNote && row.supportedBy && fieldNow(row.supportedBy) === false) {
            notes.push(row.unsupportedNote);
        }
        if (row.emptyNote && row.archetype === ARCHETYPE.BANK && !inertFor(row)) {
            const value = resolvedValueFor(row);
            const items = itemsFor(row) ?? [];
            const matched = value !== undefined && value !== null
                && items.some((item) => String(item.value) === String(value));
            if (!matched) notes.push(row.emptyNote);
        }
        return Object.freeze(notes);
    }

    /** One gate's verdict. THREE SPELLINGS, and each one is a question a page had to ask. */
    function gateSaysInert(row, gate) {
        const master = gateMasterFor(row, gate);
        if (master === null) return false;
        if (typeof gate === 'object' && Object.hasOwn(gate, 'value')) {
            return resolvedValueFor(master) !== gate.value;
        }
        if (typeof gate === 'object' && Object.hasOwn(gate, 'not')) {
            return resolvedValueFor(master) === gate.not;
        }
        return !checkedFor(master);
    }

    function captionFor(row) {
        if (!row.captions) return row.caption ?? '';
        /* THE SENTENCE FOLLOWS WHAT IS SHOWN, not what is held: a bank whose selection has
         * fallen back off a disabled option must not keep describing the option it fell
         * off. */
        const value = resolvedValueFor(row);
        const found = value === undefined || value === null ? undefined : row.captions[value];
        return found ?? row.caption ?? '';
    }

    function variantFor(row) {
        if (!row.variesWith || !row.variants) return null;
        const value = typeof row.variesWith === 'object'
            ? valueOfRow(row, row.variesWith.row)
            : settings.value(row.variesWith);
        return (value !== undefined && value !== null && row.variants[value]) || null;
    }

    /** The joined value of another row on the same leaf, or undefined. */
    function valueOfRow(row, id) {
        const other = rowsForLeaf(row.leaf).find((candidate) => candidate.id === id);
        return other ? resolvedValueFor(other) : undefined;
    }

    function readingFor(row) {
        if (row.readingField) {
            const value = machineValues.has(row.readingField)
                ? machineValues.get(row.readingField)
                : undefined;
            return value === undefined || value === null ? '' : value;
        }
        if (row.archetype !== ARCHETYPE.READING) return undefined;
        const value = valueFor(row);
        if (value === undefined || value === null || value === '') return '';
        if (typeof value === 'object') return Object.keys(value).length;
        return value;
    }

    function rowsHere(leafId) {
        const machineClassHere = machineClassNow();
        return rowsForLeaf(leafId).filter((row) => rowShownOn(row, machineClassHere));
    }

    function viewFor(row) {
        const gate = row.capability
            ? settings.gateCapability(row.capability)
            : (row.source === SOURCE.ROUTE
                ? settings.gate(row.key)
                : { surface: 'shown', capability: null, verdict: null });
        const variant = variantFor(row);
        const bounds = boundsFor(row);
        const items = itemsFor(row);
        return Object.freeze({
            row,
            id: row.id,
            archetype: row.archetype,
            heading: variant?.heading ?? row.heading,
            caption: captionFor(row),
            hint: hintFor(row, variant),
            bounds: variant?.unit
                ? Object.freeze({ ...bounds, unit: variant.unit })
                : bounds,
            padBounds: padBand(variant?.unit
                ? Object.freeze({ ...bounds, unit: variant.unit })
                : bounds),
            value: resolvedValueFor(row),
            reading: readingFor(row),
            checked: checkedFor(row),
            items,
            /** Drawn, but disabled and dashed: its master switch is off. */
            inert: inertFor(row),
            pending: pendingFor(row),
            /** The sentences printed under the row — option notes, and any firmware caveat. */
            notes: notesFor(row),
            /** The live machine channel this row shows beside its value, or null. */
            live: row.live ?? null,
            staged: row.source === SOURCE.MACHINE && staged.has(row.field),
            surface: row.supportedBy && fieldNow(row.supportedBy) === false ? 'hidden' : gate.surface,
            capability: gate.capability,
            verdict: gate.verdict,
        });
    }

    return {
        /** Fires on every staged change, every write and every load. One subscription. */
        subscribe: (listener) => beacon.subscribe(listener),

        /** The number, and nothing else crosses that boundary. */
        get changeCount() { return staged.size; },
        get hasPendingWrites() { return staged.size > 0 || stagedMemory.size > 0; },

        /** True once the machine document has been read (or has failed to read). */
        get machineLoaded() { return machineLoaded; },

        machineValue(field) {
            if (staged.has(field)) return staged.get(field);
            return machineValues.has(field) ? machineValues.get(field) : undefined;
        },

        get pendingPatch() { return Object.freeze(Object.fromEntries(staged)); },

        rows(leafId) {
            return rowsHere(leafId).map(viewFor).filter((view) => view.surface === 'shown');
        },

        allRows(leafId) {
            return rowsHere(leafId).map(viewFor);
        },

        navSummary(leafId) {
            const row = rowsHere(leafId).find((candidate) => candidate.navSummary === true);
            if (!row) return null;
            const view = viewFor(row);
            if (view.surface !== 'shown' || view.inert) return null;
            const value = view.value;
            if (value === undefined || value === null || value === '') return null;
            if (view.archetype === ARCHETYPE.BANK) {
                const item = (view.items ?? []).find((candidate) => String(candidate.value) === String(value));
                return item ? item.label : null;
            }
            if (view.archetype === ARCHETYPE.STEPPER) {
                if (!Number.isFinite(Number(value))) return null;
                const shown = view.bounds?.format ? view.bounds.format(value) : String(value);
                const unit = view.bounds?.unit ?? '';
                return unit ? `${shown} ${unit}` : String(shown);
            }
            return null;
        },

        /** The one-sentence note for a leaf whose emptiness is a decision. */
        note: (leafId) => noteForLeaf(leafId),

        pending: (leafId) => pendingForLeaf(leafId),

        async load(leafId) {
            const rows = rowsHere(leafId);
            const keys = [...new Set(rows.filter((r) => r.source === SOURCE.ROUTE).map((r) => r.key))];
            const memoryKeys = [...new Set(rows.filter((r) => r.zeroSwitch).map((r) => r.zeroSwitch))];
            for (const key of memoryKeys) if (!keys.includes(key)) keys.push(key);
            const needsMachine = rows.some((r) => r.source === SOURCE.MACHINE)
                || leafReadsMachineDoc(leafId);
            await Promise.all(keys.map((key) => settings.load(key)));
            if (needsMachine) await this.loadMachine();
            bump();
        },

        /** The machine's settings document, once. Absent port or a failed read = absent. */
        async loadMachine() {
            if (inFlightMachineRead) return inFlightMachineRead;
            if (!machine || typeof machine.read !== 'function') {
                /* NO PORT IS AN ANSWER — the machine is not reachable, which is a state and
                 * not a wait. The rows read absent, exactly as they always have. */
                machineLoaded = true;
                bump();
                return null;
            }
            inFlightMachineRead = (async () => {
                let data = null;
                try {
                    data = await machine.read();
                } catch (error) {
                    log.error('the machine settings read threw', error);
                    data = null;
                }
                machineValues.clear();
                if (data && typeof data === 'object') {
                    for (const [field, value] of Object.entries(data)) machineValues.set(field, value);
                }
                /* ANSWERED — including a read that FAILED. A machine that refused is a
                 * machine that has spoken, and the rows then draw the absence dash rather
                 * than waiting for ever. */
                machineLoaded = true;
                bump();
                return data;
            })();
            try {
                return await inFlightMachineRead;
            } finally {
                inFlightMachineRead = null;
            }
        },

        /** Take machine values off a live feed. Returns how many actually moved. */
        observeMachine(fields) {
            if (!fields || typeof fields !== 'object') return 0;
            let moved = 0;
            for (const [field, value] of Object.entries(fields)) {
                if (value === undefined) continue;
                if (machineValues.has(field) && Object.is(machineValues.get(field), value)) continue;
                machineValues.set(field, value);
                moved += 1;
            }
            if (moved > 0) bump();
            return moved;
        },

        async set(row, value) {
            if (row.zeroSwitch) {
                const on = Boolean(value);
                if (!on) {
                    const current = Number(heldValueFor(row));
                    if (Number.isFinite(current) && current > 0) {
                        stagedMemory.set(row.zeroSwitch, current);
                    }
                    return this.set({ ...row, zeroSwitch: null }, 0);
                }
                const restore = restoreTargetFor(row);
                if (restore === undefined) {
                    return Object.freeze({ ok: false, staged: false, key: row.field, reason: 'no value to restore' });
                }
                stagedMemory.delete(row.zeroSwitch);
                return this.set({ ...row, zeroSwitch: null }, restore);
            }
            const chosenItem = (itemsFor(row) ?? []).find(
                (item) => String(item.value) === String(value));
            if (chosenItem && chosenItem.disabled) {
                return Object.freeze({
                    ok: false, staged: false, key: row.field ?? row.key ?? null, reason: 'capability',
                });
            }
            if (!rowShownOn(row, machineClassNow())) {
                return Object.freeze({
                    ok: false, staged: false, key: row.field ?? row.key ?? null, reason: 'machine',
                });
            }
            if (row.stages) {
                const plan = row.stages[value];
                if (!plan) {
                    return Object.freeze({ ok: false, staged: false, key: null, reason: 'not an option' });
                }
                for (const [field, wanted] of Object.entries(plan)) {
                    staged.set(field, wanted === RESTORE ? restoreValueFor(row, field) : wanted);
                }
                bump();
                return Object.freeze({ ok: true, staged: true, key: Object.keys(plan)[0] });
            }
            /* THE SAME MAP `valueFor` READ ON THE WAY OUT, read on the way in. A bank cell
             * announces a DOM string; the machine holds a boolean. */
            if (row.fieldValues) {
                if (!Object.hasOwn(row.fieldValues, value)) {
                    return Object.freeze({ ok: false, staged: false, key: row.field, reason: 'not an option' });
                }
                staged.set(row.field, row.fieldValues[value]);
                bump();
                return Object.freeze({ ok: true, staged: true, key: row.field });
            }
            const display = displayUnitFor(row);
            if (display && Number.isFinite(Number(value))) {
                value = fromDisplayTemp(Number(value), display);
            }
            if (row.source === SOURCE.MACHINE) {
                if (row.capability
                    && settings.gateCapability(row.capability).surface !== 'shown') {
                    return Object.freeze({
                        ok: false, staged: false, key: row.field, reason: 'capability',
                    });
                }
                staged.set(row.field, value);
                bump();
                return Object.freeze({ ok: true, staged: true, key: row.field });
            }
            if (row.source === SOURCE.ROUTE) {
                const stored = row.invert ? !value : value;
                const result = await settings.set(row.key, stored);
                let panelReason = null;
                if (row.panel && PANEL_SETTINGS[row.panel]) {
                    const sent = panel
                        ? PANEL_SETTINGS[row.panel].write(panel, stored)
                        : { ok: false, reason: 'the display feed is not attached' };
                    if (sent && sent.ok === false) panelReason = sent.reason ?? 'refused';
                }
                bump();
                return Object.freeze({
                    ok: result.ok && panelReason === null,
                    staged: false,
                    key: row.key,
                    reason: panelReason ?? result.reason ?? null,
                });
            }
            return Object.freeze({ ok: false, staged: false, key: null, reason: 'not a stored row' });
        },

        async commit() {
            if (staged.size === 0 && stagedMemory.size === 0) {
                return Object.freeze({ ok: true, wrote: 0, reason: null, detail: null });
            }
            if (staged.size > 0 && (!machine || typeof machine.write !== 'function')) {
                log.error('refusing to commit: there is no machine settings port');
                return Object.freeze({ ok: false, wrote: 0, reason: COMMIT_REFUSAL.NO_MACHINE_PORT, detail: null });
            }
            const patch = Object.fromEntries(staged);
            const count = staged.size;
            let ok = true;
            if (staged.size > 0) {
                try {
                    ok = await machine.write(patch);
                } catch (error) {
                    log.error('the machine settings write threw', error);
                    ok = false;
                }
            }
            if (!ok) {
                bump();
                return Object.freeze({ ok: false, wrote: 0, reason: COMMIT_REFUSAL.WRITE_FAILED, detail: null });
            }
            let memoryReason = null;
            for (const [key, remembered] of [...stagedMemory]) {
                let result = null;
                try {
                    result = remembered === FORGET
                        ? await settings.remove(key)
                        : await settings.set(key, remembered);
                } catch (error) {
                    log.error('the remembered value write threw', error);
                    result = { ok: false, reason: 'threw' };
                }
                if (result && result.ok === false) {
                    memoryReason = result.reason ?? 'refused';
                } else {
                    stagedMemory.delete(key);
                }
            }
            staged.clear();
            await this.loadMachine();
            if (memoryReason === null) {
                return Object.freeze({ ok: true, wrote: count, reason: null, detail: null });
            }
            return Object.freeze({
                ok: false,
                wrote: count,
                reason: COMMIT_REFUSAL.MEMORY_NOT_SAVED,
                detail: memoryReason,
            });
        },

        restorableRows(leafId) {
            const seen = new Set();
            return this.rows(leafId).filter((view) => {
                const row = view.row;
                if (row.source === SOURCE.MACHINE) {
                    if (seen.has(row.field)) return false;
                    if (machineFallbackFor(row.field) === undefined) return false;
                    seen.add(row.field);
                    return true;
                }
                if (row.source === SOURCE.ROUTE) return hasDefault(row.key);
                return false;
            });
        },

        async restoreDefaults(leafId) {
            const rows = this.restorableRows(leafId);
            let moved = 0;
            for (const view of rows) {
                const row = view.row;
                const value = row.source === SOURCE.MACHINE
                    ? machineFallbackFor(row.field)
                    : defaultFor(row.key);
                if (value === undefined) continue;
                const result = await this.set({ ...row, zeroSwitch: null }, value);
                if (result.ok) moved += 1;
            }
            for (const view of this.rows(leafId)) {
                const key = view.row.zeroSwitch;
                if (!key || stagedMemory.has(key)) continue;
                if (typeof settings.storedValue !== 'function') continue;
                if (settings.storedValue(key) === undefined) continue;
                stagedMemory.set(key, FORGET);
                bump();
            }
            return Object.freeze({ ok: true, moved, of: rows.length });
        },

        discard() {
            if (staged.size === 0 && stagedMemory.size === 0) return 0;
            const count = staged.size;
            staged.clear();
            stagedMemory.clear();
            bump();
            return count;
        },

        /** Teardown — the beacon only. Neither injected store is this model's to destroy. */
        destroy() {
            staged.clear();
            stagedMemory.clear();
            machineValues.clear();
            beacon.destroy();
        },
    };
}

export function machinePortFor(client) {
    if (!client || typeof client.readSettings !== 'function') return null;
    return Object.freeze({
        async read() {
            const result = await client.readSettings();
            return result && result.ok ? result.data : null;
        },
        async write(patch) {
            const result = await client.writeSettings(patch);
            return Boolean(result && result.ok);
        },
    });
}

export function advancedPortFor(client) {
    if (!client || typeof client.readAdvancedSettings !== 'function') return null;
    return Object.freeze({
        async read() {
            const result = await client.readAdvancedSettings();
            return result && result.ok ? result.data : null;
        },
        async write(patch) {
            const result = await client.writeAdvancedSettings(patch);
            return Boolean(result && result.ok);
        },
    });
}

export { ARCHETYPE, SOURCE };
