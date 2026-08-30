
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LANGUAGE,
  I18nController,
  Translations,
  initI18n,
  interpolate,
  loadLanguage,
  pickLanguage,
  t,
  translations,
} from '../src/lib/i18n.js';

/** Minimal stand-in for a LitElement host: records controllers and update requests. */
function fakeHost() {
  const host = {
    controllers: [],
    updates: 0,
    addController(controller) { this.controllers.push(controller); },
    requestUpdate() { this.updates += 1; },
  };
  return host;
}

const okResponse = (payload) => ({ ok: true, status: 200, json: async () => payload });

test('an empty store falls back to the key, which is the English text', () => {
  const store = new Translations();
  assert.equal(store.t('Save'), 'Save');
  assert.equal(store.language, DEFAULT_LANGUAGE);
});

test('a translated key returns the translation', () => {
  const store = new Translations();
  store.set('de', { Save: 'Speichern' });
  assert.equal(store.t('Save'), 'Speichern');
  assert.equal(store.language, 'de');
});

test('an untranslated key still renders English, not a blank or an identifier', () => {
  const store = new Translations();
  store.set('de', { Save: 'Speichern' });
  assert.equal(store.t('Steam'), 'Steam');
});

test('lookup tolerates casing drift between the call site and the table', () => {
  const store = new Translations();
  store.set('de', { 'Force On': 'Immer an' });
  assert.equal(store.t('force on'), 'Immer an');
  assert.equal(store.t('FORCE ON'), 'Immer an');
});

test('for the source language a case-drifted hit returns the CALLER\'s casing', () => {
  const store = new Translations();
  store.set('en', { OFF: 'OFF' });
  assert.equal(store.t('Off'), 'Off');
  assert.equal(store.t('off'), 'off');
  assert.equal(store.t('OFF'), 'OFF');
});

test('an empty translation is treated as absent', () => {
  const store = new Translations();
  store.set('de', { Save: '' });
  assert.equal(store.t('Save'), 'Save');
});

test('placeholders are filled by the store, not concatenated at the call site', () => {
  const store = new Translations();
  store.set('en', { 'Step {n} of {total}': 'Step {n} of {total}' });
  assert.equal(store.t('Step {n} of {total}', { n: 2, total: 5 }), 'Step 2 of 5');
  store.set('de', { 'Step {n} of {total}': 'Schritt {n} von {total}' });
  assert.equal(store.t('Step {n} of {total}', { n: 2, total: 5 }), 'Schritt 2 von 5');
});

test('an unfilled placeholder stays visible instead of blanking the string', () => {
  assert.equal(interpolate('Apply {value}', {}), 'Apply {value}');
  assert.equal(interpolate('Apply {value}', { other: 1 }), 'Apply {value}');
  assert.equal(interpolate('Apply {value}'), 'Apply {value}');
});

test('subscribers are notified on every language change and can unsubscribe', () => {
  const store = new Translations();
  const seen = [];
  const stop = store.subscribe((s) => seen.push(s.language));
  store.set('de', {});
  store.set('fr', {});
  stop();
  store.set('en', {});
  assert.deepEqual(seen, ['de', 'fr']);
});

test('every subscriber sees the change — the shadow-boundary property', () => {
  const store = new Translations();
  const a = fakeHost();
  const b = fakeHost();
  const ca = new I18nController(a, store);
  const cb = new I18nController(b, store);
  ca.hostConnected();
  cb.hostConnected();
  store.set('de', { Save: 'Speichern' });
  assert.equal(a.updates, 1);
  assert.equal(b.updates, 1);
  assert.equal(ca.t('Save'), 'Speichern');
  assert.equal(cb.t('Save'), 'Speichern');
});

test('the controller registers itself with its host and requests updates', () => {
  const store = new Translations();
  const host = fakeHost();
  const controller = new I18nController(host, store);
  assert.equal(host.controllers.length, 1);
  assert.equal(host.controllers[0], controller);
  assert.equal(host.updates, 0, 'construction alone must not request an update');
  controller.hostConnected();
  store.set('de', { Save: 'Speichern' });
  assert.equal(host.updates, 1);
});

test('a disconnected controller stops updating, and reconnects cleanly', () => {
  const store = new Translations();
  const host = fakeHost();
  const controller = new I18nController(host, store);
  controller.hostConnected();
  controller.hostDisconnected();
  store.set('de', {});
  assert.equal(host.updates, 0);
  controller.hostConnected();
  controller.hostConnected(); // idempotent: never two subscriptions for one host
  store.set('fr', {});
  assert.equal(host.updates, 1);
});

test('the controller exposes the current language', () => {
  const store = new Translations();
  const controller = new I18nController(fakeHost(), store);
  store.set('de', {});
  assert.equal(controller.language, 'de');
});

test('language precedence: saved, then browser prefix, then English', () => {
  assert.equal(pickLanguage('de', 'fr-FR', ['en', 'de', 'fr']), 'de');
  assert.equal(pickLanguage(null, 'de-CH', ['en', 'de']), 'de');
  assert.equal(pickLanguage(null, 'de', ['en', 'de']), 'de');
  assert.equal(pickLanguage('xx', 'yy-ZZ', ['en', 'de']), 'en', 'unavailable choices are ignored');
  assert.equal(pickLanguage(null, undefined, ['en']), 'en');
  assert.equal(pickLanguage(null, 'en-GB', ['en']), 'en');
});

test('loadLanguage reads the generated envelope', async () => {
  const calls = [];
  const strings = await loadLanguage('de', {
    fetch: async (url) => { calls.push(url); return okResponse({ language: 'de', strings: { Save: 'Speichern' } }); },
  });
  assert.deepEqual(calls, ['i18n/de.json']);
  assert.deepEqual(strings, { Save: 'Speichern' });
});

test('loadLanguage rejects a non-200', async () => {
  await assert.rejects(
    () => loadLanguage('de', { fetch: async () => ({ ok: false, status: 404 }) }),
    /HTTP 404/);
});

test('initI18n picks, loads and publishes', async () => {
  const store = new Translations();
  const language = await initI18n({
    saved: 'de',
    browserLanguage: 'fr-FR',
    available: ['en', 'de'],
    target: store,
    fetch: async () => okResponse({ strings: { Save: 'Speichern' } }),
  });
  assert.equal(language, 'de');
  assert.equal(store.language, 'de');
  assert.equal(store.t('Save'), 'Speichern');
});

test('an unreachable language file degrades to English keys, not to a blank UI', async () => {
  const store = new Translations();
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const language = await initI18n({
      saved: 'de',
      available: ['en', 'de'],
      target: store,
      fetch: async () => { throw new Error('offline'); },
    });
    assert.equal(language, 'de');
    assert.equal(store.t('Save'), 'Save');
  } finally {
    console.warn = realWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /falling back to keys/);
});

test('the shipped singleton is usable through the module-level t()', () => {
  translations.set('en', { Save: 'Save' });
  assert.equal(t('Save'), 'Save');
  assert.equal(t('Nothing in the table'), 'Nothing in the table');
});
