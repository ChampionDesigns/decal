/**
 * Translation as a reactive value each component reads (D2).
 *
 * The old skin translated by walking the document — `document.querySelectorAll(
 * '[data-i18n-key]')` then overwriting `textContent` (slate app/src/modules/i18n.js:81-94).
 * A querySelectorAll cannot cross a shadow boundary, so in a tree of shadow-DOM
 * components that mechanism does not work at all. This is its replacement: one
 * module-level store that components SUBSCRIBE to. The ES module registry is
 * per-document, so every component — however deeply nested in shadow roots —
 * imports the same instance, and a language change re-renders each subscriber
 * through its own template. Nothing reaches into anyone else's DOM.
 *
 *   import { I18nController } from 'src/lib/i18n.js';
 *   class UiButton extends LitElement {
 *     #i18n = new I18nController(this);
 *     render() { return html`<button>${this.#i18n.t('Save')}</button>`; }
 *   }
 *
 * Carried from the old module (SCOPE Part 6, `i18n.js` row — keep ≈60 lines):
 * the case-insensitive key index, key-as-fallback, and the saved → browser-prefix →
 * English precedence. Dropped: the CSV parser (a build step now — scripts/build-i18n.js)
 * and the ≈100-line text-shrinking engine that appended a measuring span to
 * document.body at import time.
 *
 * No DOM and no network at import time: this module is testable under node:test,
 * and every I/O default is resolved at call time or injected.
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

/**
 * Lit ReactiveController: subscribes while the host is connected and requests an
 * update on every language change. Duck-typed against Lit's controller interface,
 * so this module never imports Lit and stays node-testable.
 */
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

/**
 * Resolve the language, load it, publish it. `saved` is injected (the storage
 * router owns persistence, not this module) and so is the language list, which
 * comes from the manifest of generated files — v1 ships English only (D2).
 */
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
