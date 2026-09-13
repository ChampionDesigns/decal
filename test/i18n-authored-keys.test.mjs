/**
 * The AUTHORED table's own rules, and one string that was missing from it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readTable } from '../scripts/build-i18n.js';
import { Translations } from '../src/lib/i18n.js';

const { entries } = readTable();
const keys = new Set(entries.map((entry) => entry.key));

const REFUSALS = Object.freeze([
    {
        key: 'A profile needs a name.',
        where: 'editor-screen.js #onRenameConfirm — Save pressed on an empty or '
            + 'whitespace-only title; the dialog stays open and renders this at the field '
            + '(authored under the display decision)',
    },
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

const RETIRED = Object.freeze([
    { key: 'Clear button', replacedBy: 'Clear this favourite', why: 'audit F-027 — it named the widget, not the outcome' },
    { key: 'Browse Profiles', replacedBy: 'Choose for this slot', why: 'audit F-025 — same fault, the empty-slot half' },
    { key: 'Which plot', replacedBy: null, why: 'audit F-036 — both selects were removed for good; the two-card layout made the chooser redundant' },
    { key: 'DYE2', replacedBy: 'Beans', why: 'audit F-028 — named for what the press does, not for who wrote the plugin' },
    { key: 'A · Reference shot', replacedBy: null, why: 'the eyebrow above the A picker was removed for good; the circled A beside the control already says which shot it chooses' },
    { key: 'B · Comparison shot', replacedBy: null, why: 'the same eyebrow on the B picker, removed with it' },
    { key: 'Touch the chart to compare A and B at one instant.', replacedBy: null, why: 'the paired A/B readout it invited was removed from the key, so the prompt pointed at nothing' },
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
    const identifiers = entries
        .map((entry) => entry.key)
        .filter((key) => /^[a-z]+([._][a-z]+)+$/.test(key));
    assert.deepEqual(identifiers, [], `keys that read as identifiers: ${identifiers.join(', ')}`);

    const blank = entries.map((entry) => entry.key).filter((key) => key.trim() === '');
    assert.deepEqual(blank, [], 'an empty key is not a string anyone can translate');
});

test('every authored key survives the runtime store with its own text', () => {
    const store = new Translations();
    for (const entry of entries) {
        if (entry.key.includes('{')) continue;  // placeholders are i18n.test.js's subject
        assert.equal(store.t(entry.key), entry.key, `${entry.key} did not survive t()`);
    }
});
