import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    DE1_EMULATION_BLOCK, DE1_EMULATION_KEY, DE1_EMULATION_PREFIX, de1EmulationBlockOf,
    de1EmulationName, de1EmulationOf, de1EmulationSupported, profileRunsAsDe1, shotRanAsDe1,
    withDe1Emulation,
} from '../src/lib/de1-emulation.js';
import { markedFavourites, shownProfileName } from '../src/lib/profile-name.js';
import { shotName, shotOptionLabel, shotRow } from '../src/lib/shot-summary.js';
import { changeCountOf } from '../src/lib/editor-commit.js';
import { createCapabilitiesStore } from '../src/stores/capabilities-store.js';

const step = (over = {}) => ({ name: 'Pour', pump: 'pressure', transition: 'fast', pressure: 9, ...over });

describe('the DE1 emulation value on a profile', () => {
    test('the key is de1_emulation', () => {
        assert.equal(DE1_EMULATION_KEY, 'de1_emulation');
    });

    test('a profile without the key reads as off', () => {
        assert.equal(de1EmulationOf({ title: 'A', steps: [] }), false);
        assert.equal(de1EmulationOf(null), false);
    });

    test('only a stored true reads as on', () => {
        assert.equal(de1EmulationOf({ de1_emulation: true }), true);
        assert.equal(de1EmulationOf({ de1_emulation: 1 }), false);
        assert.equal(de1EmulationOf({ de1_emulation: 'true' }), false);
    });

    test('on and then off round-trips on the profile object, and keeps every other key', () => {
        const profile = { title: 'A', steps: [step()] };
        const on = withDe1Emulation(profile, true);
        assert.equal(on.de1_emulation, true);
        assert.equal(de1EmulationOf(on), true);
        assert.deepEqual(on.steps, profile.steps);
        assert.equal(on.title, 'A');
        const off = withDe1Emulation(on, false);
        assert.equal(off.de1_emulation, false);
        assert.equal(de1EmulationOf(off), false);
        assert.equal('de1_emulation' in profile, false, 'the input is not changed');
    });
});

describe('the steps that block DE1 emulation', () => {
    test('pressure and flow steps do not block it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ pump: 'flow', flow: 4 })]), DE1_EMULATION_BLOCK.NONE);
        assert.equal(de1EmulationBlockOf([]), DE1_EMULATION_BLOCK.NONE);
        assert.equal(de1EmulationBlockOf(undefined), DE1_EMULATION_BLOCK.NONE);
    });

    test('a power step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ pump: 'power' })]), DE1_EMULATION_BLOCK.POWER);
    });

    test('a lever step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step({ pump: 'lever' })]), DE1_EMULATION_BLOCK.LEVER);
    });

    test('a hold step blocks it', () => {
        assert.equal(de1EmulationBlockOf([step(), step({ transition: 'hold' })]), DE1_EMULATION_BLOCK.HOLD);
    });
});

describe('whether the machine offers DE1 emulation', () => {
    test('no answer is not supported', () => {
        assert.equal(de1EmulationSupported(null), false);
        assert.equal(de1EmulationSupported({ machineLimits: () => null }), false);
    });

    test('only a true answer is supported', () => {
        assert.equal(de1EmulationSupported({ de1Emulation: () => true }), true);
        assert.equal(de1EmulationSupported({ de1Emulation: () => false }), false);
        assert.equal(de1EmulationSupported({ de1Emulation: () => 1 }), false);
    });

    test('the capabilities store answers from the machine class', async () => {
        const storeFor = async (capabilities) => {
            const store = createCapabilitiesStore({
                routes: { capabilities: async () => ({ ok: true, status: 200, data: { capabilities } }) },
            });
            if (capabilities !== null) await store.load();
            return store;
        };
        const on = { title: 'A', steps: [step()], de1_emulation: true };
        const bengle = await storeFor(['cupWarmer']);
        const de1 = await storeFor([]);
        const unknown = await storeFor(null);
        assert.equal(de1EmulationSupported(bengle), true);
        assert.equal(de1EmulationSupported(de1), false);
        assert.equal(de1EmulationSupported(unknown), false);
        assert.equal(profileRunsAsDe1(on, bengle), true);
        assert.equal(profileRunsAsDe1(on, de1), false);
        assert.equal(profileRunsAsDe1(on, unknown), false);
    });
});

describe('the change count sees the DE1 emulation value', () => {
    const baseline = { title: 'A', steps: [step()] };

    test('switching it on is one change', () => {
        const answer = changeCountOf(withDe1Emulation(baseline, true), baseline);
        assert.equal(answer.count, 1);
        assert.deepEqual(answer.fields, ['de1_emulation']);
    });

    test('switching it on and off again is no change, though the key is now stored', () => {
        const draft = withDe1Emulation(withDe1Emulation(baseline, true), false);
        assert.equal(changeCountOf(draft, baseline).count, 0);
    });
});

describe('the shown name of a profile that runs as a DE1', () => {
    const offered = { de1Emulation: () => true };
    const profile = (over = {}) => ({ title: 'Blooming', steps: [step()], de1_emulation: true, ...over });

    test('the prefix is B-DE1, a space, a middle dot and a space', () => {
        assert.equal(DE1_EMULATION_PREFIX, 'B-DE1 \u00b7 ');
    });

    test('switch on, machine support and no blocking step add the prefix', () => {
        assert.equal(profileRunsAsDe1(profile(), offered), true);
        assert.equal(shownProfileName(profile(), offered), 'B-DE1 \u00b7 Blooming');
    });

    test('the switch off gives the plain title', () => {
        assert.equal(shownProfileName(profile({ de1_emulation: false }), offered), 'Blooming');
        const { de1_emulation: _unused, ...withoutKey } = profile();
        assert.equal(shownProfileName(withoutKey, offered), 'Blooming');
    });

    test('no machine support gives the plain title', () => {
        assert.equal(shownProfileName(profile(), null), 'Blooming');
        assert.equal(shownProfileName(profile(), { de1Emulation: () => false }), 'Blooming');
    });

    for (const [kind, over] of [
        ['power', { pump: 'power' }], ['lever', { pump: 'lever' }], ['hold', { transition: 'hold' }],
    ]) {
        test(`a ${kind} step gives the plain title`, () => {
            const blocked = profile({ steps: [step(), step(over)] });
            assert.equal(profileRunsAsDe1(blocked, offered), false);
            assert.equal(shownProfileName(blocked, offered), 'Blooming');
        });
    }

    test('a profile without a title shows the fallback, with the prefix when it runs as a DE1', () => {
        assert.equal(shownProfileName(profile({ title: '' }), offered, 'Untitled'), 'B-DE1 \u00b7 Untitled');
        assert.equal(shownProfileName(null, offered, 'Untitled'), 'Untitled');
    });

    test('the stored title does not change', () => {
        const stored = profile();
        shownProfileName(stored, offered);
        assert.equal(stored.title, 'Blooming');
    });
});

describe('the prefix is never doubled', () => {
    test('a title that already starts with the prefix is shown as it is', () => {
        assert.equal(de1EmulationName('B-DE1 \u00b7 Blooming', true), 'B-DE1 \u00b7 Blooming');
        assert.equal(de1EmulationName(de1EmulationName('Blooming', true), true), 'B-DE1 \u00b7 Blooming');
    });

    test('no title stays no title', () => {
        assert.equal(de1EmulationName(null, true), null);
        assert.equal(de1EmulationName('', true), '');
    });
});

describe('the shown name of a past shot', () => {
    const shot = (over = {}) => ({
        id: 's1', timestamp: '2026-08-13T10:15:57.783', workflow: { profile: { title: 'Blooming' } }, ...over,
    });

    test('a shot with de1Emulation true shows the prefix', () => {
        assert.equal(shotRanAsDe1(shot({ de1Emulation: true })), true);
        assert.equal(shotName(shot({ de1Emulation: true })), 'B-DE1 \u00b7 Blooming');
    });

    test('a shot without the key, or with any value but true, shows the plain title', () => {
        assert.equal(shotName(shot()), 'Blooming');
        assert.equal(shotName(shot({ de1Emulation: false })), 'Blooming');
        assert.equal(shotName(shot({ de1Emulation: 'true' })), 'Blooming');
    });

    test('the profile setting inside the shot does not make a past shot emulated', () => {
        const record = shot({ workflow: { profile: { title: 'Blooming', de1_emulation: true } } });
        assert.equal(shotName(record), 'Blooming');
    });

    test('a shot whose title already carries the prefix is not doubled', () => {
        const record = shot({ de1Emulation: true, workflow: { profile: { title: 'B-DE1 \u00b7 Blooming' } } });
        assert.equal(shotName(record), 'B-DE1 \u00b7 Blooming');
    });

    test('the history row, its label and its profile cell show the prefix; the raw title does not', () => {
        const record = shot({ de1Emulation: true });
        const row = shotRow({ summary: record });
        assert.equal(row.title, 'B-DE1 \u00b7 Blooming');
        assert.equal(row.cells.profile.text, 'B-DE1 \u00b7 Blooming');
        assert.equal(row.cells.profile.value, 'Blooming', 'the cell value stays the raw title for a sort');
        assert.match(row.label, /B-DE1 \u00b7 Blooming/);
        assert.match(shotOptionLabel(record), /B-DE1 \u00b7 Blooming/);
        assert.equal(record.workflow.profile.title, 'Blooming');
        assert.equal(shotRow({ summary: shot() }).cells.profile.text, 'Blooming');
    });
});

describe('the DE1 mark on the favourites bar', () => {
    const offered = { de1Emulation: () => true };
    const body = (over = {}) => ({ title: 'Morning bloom', de1_emulation: true, steps: [step()], ...over });
    const marked = (profile, capabilities = offered) => {
        const records = { 'profile:a': { id: 'profile:a', profile } };
        return markedFavourites([{ value: 'profile:a', name: 'Bloom' }, null],
            (id) => records[id] ?? null, capabilities);
    };

    test('a favourite that runs as a DE1 gets the mark and a spoken name', () => {
        assert.deepEqual(marked(body()), [
            { value: 'profile:a', name: 'Bloom', badge: 'DE1', a11y: 'Bloom, DE1 emulation' },
            null,
        ]);
    });

    test('the shown name stays the short name', () => {
        assert.equal(marked(body())[0].name, 'Bloom');
    });

    test('the switch off gives no mark', () => {
        assert.deepEqual(marked(body({ de1_emulation: false }))[0], { value: 'profile:a', name: 'Bloom' });
        const { de1_emulation: _unused, ...withoutKey } = body();
        assert.deepEqual(marked(withoutKey)[0], { value: 'profile:a', name: 'Bloom' });
    });

    test('no machine support gives no mark', () => {
        assert.deepEqual(marked(body(), null)[0], { value: 'profile:a', name: 'Bloom' });
        assert.deepEqual(marked(body(), { de1Emulation: () => false })[0], { value: 'profile:a', name: 'Bloom' });
    });

    for (const [kind, over] of [
        ['power', { pump: 'power' }], ['lever', { pump: 'lever' }], ['hold', { transition: 'hold' }],
    ]) {
        test(`a ${kind} step gives no mark`, () => {
            assert.deepEqual(marked(body({ steps: [step(), step(over)] }))[0],
                { value: 'profile:a', name: 'Bloom' });
        });
    }

    test('a favourite whose record is gone gives no mark', () => {
        assert.deepEqual(markedFavourites([{ value: 'profile:x', name: 'Gone' }], () => null, offered),
            [{ value: 'profile:x', name: 'Gone' }]);
        assert.deepEqual(markedFavourites([{ value: 'profile:x', name: 'Gone' }], null, offered),
            [{ value: 'profile:x', name: 'Gone' }]);
    });

    test('an absent list is returned as it is', () => {
        assert.equal(markedFavourites(null, () => null, offered), null);
    });
});
