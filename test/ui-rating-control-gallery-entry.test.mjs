/**
 * ui-rating-control-gallery-entry.test.mjs — wave 4 #46's gallery entry, checked
 * against the contract `tools/gallery/entries.js` documents.
 *
 * WHY THE ENTRY IS ITS OWN FILE. `tools/gallery/entries.js` is a single shared array
 * and the run's rule is whole-file writes; N builders appending to it in parallel is
 * N-1 entries lost. Each builder writes `tools/gallery/entries/<tag>.entry.js` and the
 * wave's cross-cutting writer wires them in serially. This file makes that hand-off
 * safe: a malformed entry is a red test here rather than a battery photographing an
 * empty stage.
 *
 * `test/render/ui-rating-control.render.test.mjs` takes the other half — it mounts
 * every state in a real browser at both Gate A geometries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entry } from '../tools/gallery/entries/ui-rating-control.entry.js';

test('the entry has the documented shape', () => {
    assert.equal(entry.id, 'ui-rating-control', 'the entry id is the tag name and the capture prefix');
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.length > 0);
    assert.equal(entry.module, '../../src/components/ui-rating-control.js',
        'module is resolved relative to tools/gallery/, not to entries/');
    assert.ok(Array.isArray(entry.states) && entry.states.length > 0);

    for (const state of entry.states) {
        assert.match(state.id, /^[a-z0-9-]+$/, `state id ${state.id} is a capture filename, not a label`);
        assert.equal(typeof state.title, 'string');
        assert.ok(state.html.includes('<ui-rating-control'), `state ${state.id} mounts no ui-rating-control`);
        if (state.hostStyle !== undefined) assert.equal(typeof state.hostStyle, 'object');
    }
});

test('state ids are unique — they are capture filenames', () => {
    const ids = entry.states.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate capture filename in ${ids.join(', ')}`);
});

/**
 * L4's configuration has to be ON the stage or the battery cannot regress it. The bug
 * is "11px shorter than its own contents WHENEVER THE DYE HANDOFF IS PRESENT"
 * (LAYOUT_SPEC_DRAFT.md §7.2 L4), so a gallery that only ever photographs the
 * three-child column is photographing the case Slate got right.
 */
test('the handoff is on the stage, and so is the case without it', () => {
    const withHandoff = entry.states.filter((s) => /\shandoff[\s>]/.test(s.html));
    const without = entry.states.filter((s) => !/\shandoff[\s>]/.test(s.html));
    assert.ok(withHandoff.length > 0, 'no state shows the DYE handoff — L4 cannot be seen without it');
    assert.ok(without.length > 0, 'no state shows the three-child column Slate derived its 165px for');
});

/**
 * The capture that aims Slate's own frozen number at the component.
 *   CITE live-ready .slate-shot-rate [i=154] height = 165px <- slate-live.css
 *        `#main-page .slate-shot-rate` authored `165px` (FROZEN/hardcoded)
 */
test('one state states Slate\'s 165px with the handoff present', () => {
    const state = entry.states.find((s) => s.id === 'stated-height');
    assert.ok(state, 'the L4 capture state is missing');
    assert.match(state.html, /block-size:\s*165px/, 'the state must state Slate\'s own height');
    assert.match(state.html, /\shandoff[\s>]/, 'the stated height only bites with the fourth child present');
});

/** The container floor is a state, because a frozen 1920 capture cannot show one. */
test('one state sits at Slate\'s own 172px zone width', () => {
    const state = entry.states.find((s) => s.id === 'narrow');
    assert.ok(state, 'the container-floor state is missing');
    assert.equal(state.hostStyle['inline-size'], '172px');
});

/**
 * An unrated shot is an ABSENCE, not a zero (A7; slate-live.css:1533, "an unrated shot
 * must not look like a shot rated zero"). It has to be photographed, or the difference
 * between a dash and a 0 is invisible to the battery.
 */
test('the unrated state carries no score at all', () => {
    const state = entry.states.find((s) => s.id === 'unrated');
    assert.ok(state, 'the unrated state is missing');
    assert.doesNotMatch(state.html, /\sscore=/, 'an unrated state that states a score is not unrated');
});

/** Gate C scans tools/; an inline style here may carry lengths and nothing else. */
test('no inline style in the entry carries a colour or an !important', () => {
    for (const state of entry.states) {
        const styles = [...state.html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
        for (const style of styles) {
            assert.doesNotMatch(style, /#[0-9a-f]{3,8}\b|rgb|hsl|oklch/i, `state ${state.id} inlines a colour`);
            assert.doesNotMatch(style, /!important/, `state ${state.id} inlines an !important`);
        }
    }
});
