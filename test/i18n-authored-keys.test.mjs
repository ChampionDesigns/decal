/**
 * i18n-authored-keys.test.mjs — the AUTHORED table's own rules, and one string that was
 * missing from it.
 *
 * WHAT THE OTHER TWO i18n SUITES DO NOT COVER. `i18n-freshness.test.js` asks whether the
 * committed `i18n/en.json` is what the generator produces — a staleness question, and it is
 * green whether the table holds five entries or five hundred. `i18n-generator.test.js`
 * drives the generator over a throwaway tree. `i18n.test.js` is the runtime store. So
 * nothing asked whether the AUTHORED table obeys the rules `i18n/source/README.md` states
 * for it, and nothing asked whether a sentence the product renders is in the table at all.
 *
 * THE SECOND HALF IS WHY THIS FILE EXISTS NOW. Audit F-050's fix made the editor's rename
 * dialog refuse an empty title out loud — "A profile needs a name." — and round 1's report
 * flagged, as MORNING_REPORT §3.3 item 17, that the sentence was not in the catalogue.
 * NOTHING WAS BROKEN BY THAT, which is exactly why it needed a test: for the source
 * language the key IS the text and `t()` falls back to the key, so an unauthored string
 * renders correctly in English and is invisible until somebody adds a second language, at
 * which point it is the one line that stays English with no record of why. Ben's decision
 * D17 (30 Aug 2026) was to author it; this pins that it stays authored.
 *
 * READS THE AUTHORED TABLE, NOT THE SCREENS. The keys below are written out here as
 * literals rather than scraped from `src/`, and that is deliberate twice over: a8 forbids a
 * test reading the source text of anything under `src/screens/`, and a scrape would only
 * prove the table agrees with itself. A literal is a second, independent statement of what
 * the product says — if somebody changes the wording in the screen, this file goes red and
 * a human decides which of the two is right.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readTable } from '../scripts/build-i18n.js';
import { Translations } from '../src/lib/i18n.js';

const { entries } = readTable();
const keys = new Set(entries.map((entry) => entry.key));

/**
 * SENTENCES THE SKIN RENDERS AS A REFUSAL, each with the call site that renders it.
 *
 * A refusal is the class most likely to go unauthored, because it is the string a happy
 * path never reaches: it is written when the fix is written, it renders correctly in
 * English from the fallback, and no screenshot and no ordinary run of the app contains it.
 * `A profile needs a name.` was exactly that for two days.
 */
const REFUSALS = Object.freeze([
    {
        key: 'A profile needs a name.',
        where: 'editor-screen.js #onRenameConfirm — Save pressed on an empty or '
            + 'whitespace-only title; the dialog stays open and renders this at the field '
            + '(audit F-050, authored under Ben\'s D17)',
    },
    /* THE VISIBILITY SWITCH'S FOUR, added by the round-4 sweep (30 Aug 2026). D20 built
     * the switch and its own FIXLOG entry recorded that its sentences were unauthored;
     * every one of them is the class this file exists for — a refusal or an
     * unavailability that a happy path never reaches, correct in English from the
     * fallback, and invisible until somebody adds a second language. */
    {
        key: 'The library could not be changed. Try again.',
        where: 'editor-screen.js #libraryFace — the visibility write FAILED and the '
            + 'server gave no sentence of its own; the switch has already been put back '
            + 'to the confirmed value (audit F-031 / D20)',
    },
    {
        key: 'The library was not changed. {reason}',
        where: 'editor-screen.js #libraryFace — the visibility write was REFUSED and the '
            + 'server did give a sentence; {reason} carries the server\'s own words '
            + 'verbatim (audit F-031 / D20)',
    },
    {
        key: 'This profile is {state}, which this switch cannot change.',
        where: 'editor-screen.js #libraryFace — the record is in a state with no switch '
            + 'position, and {state} is the server\'s own word for it (audit F-031 / D20)',
    },
    {
        key: 'Save this profile first — the library has nothing to hide yet.',
        where: 'editor-screen.js #libraryFace — the switch on an UNSEATED draft: a '
            + 'profile with no record id is not in the library, so there is nothing to '
            + 'hide (audit F-031 / D20)',
    },
]);

/**
 * ROWS THE SWEEP RETIRED, and why a retirement needs a test at all.
 *
 * The generator fails a translation for a key that no longer exists, so a stale row in a
 * LANGUAGE file is caught. It cannot catch a stale row in the SOURCE table: an entry
 * nothing calls `t()` with is simply never looked up, and it sits there forever as a
 * sentence a translator will translate and nobody will ever read. All four below named a
 * control by its old wording, and each was replaced during this campaign — so if one comes
 * back, it is a screen reverting to language Ben has already ruled on, which is worth a red
 * test rather than a silent duplicate pair in the table.
 */
const RETIRED = Object.freeze([
    { key: 'Clear button', replacedBy: 'Clear this favourite', why: 'audit F-027 — it named the widget, not the outcome' },
    { key: 'Browse Profiles', replacedBy: 'Choose for this slot', why: 'audit F-025 — same fault, the empty-slot half' },
    { key: 'Which plot', replacedBy: null, why: 'audit F-036 — both selects were removed for good; the two-card layout made the chooser redundant' },
    { key: 'DYE2', replacedBy: 'Beans', why: 'audit F-028 — named for what the press does, not for who wrote the plugin' },
]);

for (const retired of RETIRED) {
    test(`the catalogue does not carry the retired row: "${retired.key}"`, () => {
        assert.ok(
            !keys.has(retired.key),
            `"${retired.key}" is back in i18n/source/strings.json. ${retired.why}.`
            + (retired.replacedBy ? ` The wording now shipped is "${retired.replacedBy}".` : ''),
        );
        if (retired.replacedBy) {
            assert.ok(
                keys.has(retired.replacedBy),
                `and its replacement "${retired.replacedBy}" is not authored either — the `
                + 'sweep that retired one was supposed to author the other',
            );
        }
    });
}

for (const refusal of REFUSALS) {
    test(`the catalogue authors the refusal: "${refusal.key}"`, () => {
        assert.ok(
            keys.has(refusal.key),
            `${refusal.where}\n  Not in i18n/source/strings.json. Nothing is BROKEN — for the `
            + 'source language the key is the text — but the string is invisible to every '
            + 'translator and to the coverage report.',
        );
    });
}

test('an authored refusal carries a note saying where it is said', () => {
    /* NOT A RULE FOR THE WHOLE TABLE — most entries have no note, many of them
     * single words whose meaning is the word. A refusal is different: it is a full sentence
     * whose tone depends on what refused and why, and a translator who cannot see the
     * dialog it renders into has nothing else to go on. */
    for (const refusal of REFUSALS) {
        const entry = entries.find((row) => row.key === refusal.key);
        assert.ok(entry, refusal.key);
        assert.ok(
            typeof entry.note === 'string' && entry.note.trim().length > 0,
            `"${refusal.key}" is authored with no note; a translator sees a bare sentence`,
        );
    }
});

test('every authored key is ENGLISH TEXT, never an identifier', () => {
    /* `i18n/source/README.md`'s first rule: "A key IS its English text. `t('Save')`, not
     * `t('editor.save')`. An untranslated string therefore renders as English, never as a
     * bare identifier." The generator enforces duplicates and case collisions; it does not
     * enforce this one, because it cannot tell a short English word from a short
     * identifier by shape alone — but a DOTTED or UNDERSCORED lower-case run is the shape
     * the rule names, and nothing in a real sentence looks like one. 768 entries, 0 today.
     *
     * `test/step-matrix-rows.test.mjs` makes this same claim about ITS OWN labels; this is
     * the claim over the table, which is where a stray key would actually land. */
    const identifiers = entries
        .map((entry) => entry.key)
        .filter((key) => /^[a-z]+([._][a-z]+)+$/.test(key));
    assert.deepEqual(identifiers, [], `keys that read as identifiers: ${identifiers.join(', ')}`);

    const blank = entries.map((entry) => entry.key).filter((key) => key.trim() === '');
    assert.deepEqual(blank, [], 'an empty key is not a string anyone can translate');
});

test('every authored key survives the runtime store with its own text', () => {
    /* THE LINK THE PRODUCT DEPENDS ON, asked over the whole table rather than one string:
     * an unloaded store answers the key, and a store loaded with the source language must
     * answer the same thing — that is what makes an unauthored string indistinguishable
     * from an authored one at runtime, and therefore what makes the coverage report the
     * only place the difference shows. */
    const store = new Translations();
    for (const entry of entries) {
        if (entry.key.includes('{')) continue;  // placeholders are i18n.test.js's subject
        assert.equal(store.t(entry.key), entry.key, `${entry.key} did not survive t()`);
    }
});
