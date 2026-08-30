/**
 * gallery.js — mounts one state at a time, and exposes the walk to the capture battery.
 *
 * Scaffolding, not shipping surface: no build step, no framework, no state model.
 * The whole page is "import the entry's module, put its markup in the stage, wait for
 * it to settle".
 *
 * THE MACHINE-FACING HALF is the part that matters tonight. Gate B's capture battery
 * (`review/tools/capture_battery.py`, ported in its own 0a row) drives a browser over
 * CDP and needs to enumerate states and show one deterministically. So:
 *
 *     window.__gallery.ready            // resolves once the first render has settled
 *     window.__gallery.states()         // [{ id, title, entryId, stateId }, …]
 *     await window.__gallery.show(id)   // mounts it and resolves when settled
 *     document.body.dataset.galleryState // the id currently shown
 *     document.body.dataset.gallerySettled // '1' once settled, removed while mounting
 *
 * and `?state=<id>&theme=<light|dark>` selects one on load, so a battery can also
 * simply navigate. Both routes end in the same `show()`.
 *
 * SETTLING is deliberately conservative — await every element's `updateComplete`
 * through the shadow tree, then `document.fonts.ready`, then two frames. A capture
 * taken one frame early is a baseline that is wrong forever, and the first baseline
 * is a human review rather than a diff (Gate B change 3).
 */

import { entries, allStates } from './entries.js';

const stage = document.getElementById('stage');
const stageHost = document.getElementById('stage-host');
const nav = document.getElementById('nav');
const label = document.getElementById('state-label');
const notes = document.getElementById('state-notes');
const readout = document.getElementById('readout');

const states = allStates(entries);
const byId = new Map(states.map((s) => [s.id, s]));
const loaded = new Map();

let current = null;

/* ---------------------------------------------------------------------------
 * Mounting
 * ------------------------------------------------------------------------- */

async function loadModule(entry) {
    if (!loaded.has(entry.id)) {
        loaded.set(entry.id, import(entry.module));
    }
    return loaded.get(entry.id);
}

function deepAll(root = document, acc = []) {
    for (const el of root.querySelectorAll('*')) {
        acc.push(el);
        if (el.shadowRoot) deepAll(el.shadowRoot, acc);
    }
    return acc;
}

async function settle(passes = 4) {
    for (let i = 0; i < passes; i++) {
        const waits = deepAll().filter((el) => el.updateComplete).map((el) => el.updateComplete);
        if (waits.length) await Promise.all(waits);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => requestAnimationFrame(r));
}

async function show(id, { push = true } = {}) {
    const entry = byId.get(id);
    if (!entry) throw new Error(`unknown gallery state: ${id}`);

    delete document.body.dataset.gallerySettled;
    current = id;

    await loadModule(entry.entry);

    stageHost.removeAttribute('style');
    for (const [prop, value] of Object.entries(entry.state.hostStyle ?? {})) {
        stageHost.style.setProperty(prop, value);
    }
    stageHost.innerHTML = entry.state.html;

    const tags = [...new Set(deepAll(stageHost).map((el) => el.tagName.toLowerCase()))]
        .filter((t) => t.includes('-'));
    await Promise.all(tags.map((t) => customElements.whenDefined(t)));
    await settle();

    label.textContent = entry.title;
    notes.textContent = entry.state.notes ?? entry.entry.notes ?? '';
    notes.hidden = !notes.textContent;
    for (const button of nav.querySelectorAll('button[data-state]')) {
        button.setAttribute('aria-current', String(button.dataset.state === id));
    }
    document.body.dataset.galleryState = id;
    document.body.dataset.gallerySettled = '1';

    if (push) {
        const url = new URL(location.href);
        url.searchParams.set('state', id);
        history.replaceState(null, '', url);
    }
    updateReadout();
    return id;
}

/* ---------------------------------------------------------------------------
 * Chrome
 * ------------------------------------------------------------------------- */

function buildNav() {
    for (const entry of entries) {
        const group = document.createElement('section');
        const heading = document.createElement('h2');
        heading.textContent = entry.title;
        group.append(heading);
        for (const state of entry.states) {
            const id = `${entry.id}--${state.id}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.state = id;
            button.textContent = state.title;
            button.addEventListener('click', () => show(id));
            group.append(button);
        }
        nav.append(group);
    }
}

function updateReadout() {
    readout.textContent =
        `${innerWidth}×${innerHeight} @ dpr ${devicePixelRatio} · `
        + `${document.documentElement.dataset.theme} · `
        + `stage ${Math.round(stageHost.getBoundingClientRect().width)}px`;
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    for (const button of document.querySelectorAll('button[data-theme]')) {
        button.setAttribute('aria-current', String(button.dataset.theme === theme));
    }
    updateReadout();
}

/* ---------------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------------- */

const params = new URLSearchParams(location.search);

buildNav();
for (const button of document.querySelectorAll('button[data-theme]')) {
    button.addEventListener('click', () => setTheme(button.dataset.theme));
}
setTheme(params.get('theme') ?? document.documentElement.dataset.theme ?? 'dark');
addEventListener('resize', updateReadout);

const first = params.get('state') && byId.has(params.get('state'))
    ? params.get('state')
    : states[0]?.id;

const ready = first ? show(first, { push: false }) : Promise.resolve(null);

window.__gallery = {
    ready,
    entries,
    states: () => states.map(({ id, title, entryId, stateId }) => ({ id, title, entryId, stateId })),
    show,
    settle,
    current: () => current,
};

// Every state has a distinct id or the battery would overwrite its own captures.
const ids = states.map((s) => s.id);
if (new Set(ids).size !== ids.length) {
    throw new Error(`duplicate gallery state ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
}
