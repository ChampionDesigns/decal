/**
 * Translation as a reactive value each component reads (D2).
 */

export const DEFAULT_LANGUAGE = 'en';

const PLACEHOLDER = /\{(\w+)\}/g;

/** Fill {name} placeholders. Unknown names are left visible rather than blanked. */
export function interpolate(text, params) {
  if (!params) return text;
  return text.replace(PLACEHOLDER, (whole, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole);
}

/** saved → browser language prefix → English. `available` gates both candidates. */
export function pickLanguage(saved, browserLanguage, available = [DEFAULT_LANGUAGE]) {
  if (saved && available.includes(saved)) return saved;
  const prefix = String(browserLanguage ?? '').split('-')[0];
  if (prefix && available.includes(prefix)) return prefix;
  return DEFAULT_LANGUAGE;
}

export class Translations {
  #language = DEFAULT_LANGUAGE;
  #strings = new Map();
  #index = new Map(); // lowercased key -> canonical key, tolerating casing drift
  #listeners = new Set();

  get language() { return this.#language; }

  /** Translate. Bound, so it can be handed to a template or a helper directly. */
  t = (key, params) => {
    const direct = this.#strings.get(key);
    if (direct !== undefined && direct !== '') return interpolate(direct, params);
    const canonical = this.#index.get(String(key).toLowerCase());
    const hit = canonical === undefined ? undefined : this.#strings.get(canonical);
    // A hit that differs only in case is the source language answering itself:
    // return the CALLER's casing ("OFF" stays "OFF"), never the table's.
    if (hit && hit.toLowerCase() !== String(key).toLowerCase()) return interpolate(hit, params);
    // Key-as-fallback. Keys are English text, so an untranslated string renders in
    // English — never blank, never a bare identifier.
    return interpolate(key, params);
  };

  /** Install a language's strings and notify every subscriber. */
  set(language, strings = {}) {
    this.#language = language;
    this.#strings = new Map(Object.entries(strings));
    this.#index = new Map([...this.#strings.keys()].map((key) => [key.toLowerCase(), key]));
    for (const listener of [...this.#listeners]) listener(this);
  }

  /** Subscribe to language changes. Returns the unsubscribe function. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

/** The one instance every component reads. */
export const translations = new Translations();

/** Module-level convenience for non-component code (stores, lib helpers). */
export const t = (key, params) => translations.t(key, params);

export class I18nController {
  constructor(host, source = translations) {
    this.host = host;
    this.source = source;
    this.unsubscribe = null;
    host.addController(this);
  }

  get language() { return this.source.language; }

  t = (key, params) => this.source.t(key, params);

  hostConnected() {
    this.unsubscribe ??= this.source.subscribe(() => this.host.requestUpdate());
  }

  hostDisconnected() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

/** Fetch one generated language file (i18n/<lang>.json). Returns its string map. */
export async function loadLanguage(language, { fetch: fetchImpl, base = 'i18n/' } = {}) {
  const get = fetchImpl ?? globalThis.fetch;
  const response = await get(`${base}${encodeURIComponent(language)}.json`);
  if (!response.ok) throw new Error(`i18n: ${base}${language}.json — HTTP ${response.status}`);
  const payload = await response.json();
  return payload?.strings ?? {};
}

export async function initI18n({
  saved = null,
  browserLanguage = globalThis.navigator?.language,
  available = [DEFAULT_LANGUAGE],
  target = translations,
  ...io
} = {}) {
  const language = pickLanguage(saved, browserLanguage, available);
  let strings = {};
  try {
    strings = await loadLanguage(language, io);
  } catch (error) {
    // A missing or unreachable file degrades to untranslated English (the keys),
    // never to an empty UI — the failure mode the fallback rule exists to prevent.
    strings = {};
    globalThis.console?.warn?.(`i18n: falling back to keys — ${error.message}`);
  }
  target.set(language, strings);
  return language;
}
