/**
 * The recent values a numeric field offers, kept per input purpose and unit and
 * persisted through the injected storage router. Temperatures are stored in Celsius
 * whichever unit was typed, so the same physical value appears once.
 */
import { celsiusToFahrenheit, fahrenheitToCelsius } from './temperature.js';

const ROUTE = 'numpadRecents';
export const RECENT_VALUES_SHOWN = 4;

function context(field, unit) {
    if (typeof field !== 'string' || !field || field === 'value') return null;
    const temperature = unit === '°C' || unit === '°F';
    const canonicalUnit = temperature ? '°C' : String(unit ?? '');
    return {
        key: `v1:${encodeURIComponent(field)}:${encodeURIComponent(canonicalUnit)}`,
        toStored: unit === '°F' ? fahrenheitToCelsius : value => value,
        toDisplay: unit === '°F' ? celsiusToFahrenheit : value => value,
    };
}

function finite(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(9)) : null;
}

function prepend(values, value) {
    return [value, ...values.filter(previous => previous !== value)].slice(0, RECENT_VALUES_SHOWN);
}

function sanitize(raw) {
    const values = Array.isArray(raw) ? raw : [];
    return [...new Set(values.map(finite).filter(value => value !== null))].slice(0, RECENT_VALUES_SHOWN);
}

export class NumericInputHistory {
    #storage = null;
    #entries = new Map();
    #listeners = new Set();
    #generation = 0;

    get generation() { return this.#generation; }

    attach(storage) {
        const generation = ++this.#generation;
        this.#storage = storage ?? null;
        this.#entries.clear();
        this.#notify();
        return () => {
            if (generation !== this.#generation) return;
            this.#generation++;
            this.#storage = null;
            this.#entries.clear();
            this.#notify();
        };
    }

    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #notify() {
        for (const listener of this.#listeners) listener();
    }

    #entry(key) {
        if (!this.#entries.has(key)) {
            this.#entries.set(key, { values: [], pending: [], loaded: !this.#storage, read: null, write: Promise.resolve(), queued: 0 });
        }
        return this.#entries.get(key);
    }

    values(field, unit = '') {
        const scope = context(field, unit);
        if (!scope) return [];
        return this.#entry(scope.key).values.map(value => finite(scope.toDisplay(value)));
    }

    load(field, unit = '') {
        const scope = context(field, unit);
        if (!scope) return Promise.resolve(false);
        const entry = this.#entry(scope.key);
        if (entry.loaded) return Promise.resolve(true);
        if (entry.read) return entry.read;
        const storage = this.#storage;
        const generation = this.#generation;
        let failed = false;
        const unsubscribe = storage?.onReadFailure?.(event => {
            if (event.key === ROUTE && event.params?.field === scope.key) failed = true;
        });
        entry.read = Promise.resolve().then(() => storage?.get(ROUTE, {
            params: { field: scope.key }, fallback: [],
        })).then(raw => {
            if (failed || generation !== this.#generation) return false;
            const unsaved = entry.pending.length > 0;
            entry.values = entry.pending.reduce(prepend, sanitize(raw));
            entry.pending = [];
            entry.loaded = true;
            if (unsaved && entry.queued === 0) this.#queueWrite(field, unit, entry);
            this.#notify();
            return true;
        }).catch(() => false).finally(() => {
            unsubscribe?.();
            entry.read = null;
        });
        return entry.read;
    }

    remember(field, unit, raw) {
        const scope = context(field, unit);
        const number = finite(raw);
        if (!scope || number === null) return false;
        const value = finite(scope.toStored(number));
        const entry = this.#entry(scope.key);
        entry.values = prepend(entry.values, value);
        if (!entry.loaded) entry.pending = [...entry.pending.filter(previous => previous !== value), value].slice(-RECENT_VALUES_SHOWN);
        this.#notify();
        this.#queueWrite(field, unit, entry);
        return true;
    }

    #queueWrite(field, unit, entry) {
        const scope = context(field, unit);
        const generation = this.#generation;
        const storage = this.#storage;
        entry.queued++;
        entry.write = entry.write.catch(() => false).then(async () => {
            if (!storage || generation !== this.#generation) return false;
            if (!await this.load(field, unit) || generation !== this.#generation) return false;
            return storage.set(ROUTE, [...entry.values], { params: { field: scope.key } });
        }).catch(() => false).finally(() => { entry.queued--; });
    }

    flush() {
        return Promise.all([...this.#entries.values()].map(entry => entry.write));
    }
}

export const numericHistory = new NumericInputHistory();

export class NumericHistoryController {
    #scope = null;
    #unsubscribe = null;

    constructor(host, source = numericHistory) {
        this.host = host;
        this.source = source;
        host.addController(this);
    }

    hostConnected() {
        this.#unsubscribe ??= this.source.subscribe(() => this.host.requestUpdate());
    }

    hostDisconnected() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#scope = null;
    }

    hostUpdate() {
        const host = this.host;
        if (!host.open) { this.#scope = null; return; }
        const field = host.recentKey || host.limitKey;
        const scope = JSON.stringify([this.source.generation, field, host.unit]);
        if (scope === this.#scope) return;
        this.#scope = scope;
        void this.source.load(field, host.unit);
    }

    values() {
        return this.source.values(this.host.recentKey || this.host.limitKey, this.host.unit);
    }

    remember(value) {
        return this.source.remember(this.host.recentKey || this.host.limitKey, this.host.unit, value);
    }
}
