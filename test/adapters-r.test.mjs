// The R-tagged adapter module: the tags are greppable, every adapter names its missing
// field, and nothing in it reads a machine name.
//
// The greppability test greps THIS MODULE'S OWN SOURCE, on purpose. The swap discipline is
// only worth anything if `grep -n 'R3' src/data/adapters-r.js` finds every occupant, and a
// test that asserted over the exported objects alone would still pass if the tags lived
// nowhere in the text.
//
// FIXTURES ARE CONTRACT-CHECKED (Gate B rule 4) against ReaPrime at
// 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3: the capability body is
// `{capabilities: [...]}` from `de1handler.dart`; the machine-info body is
// `MachineInfo.toJson` — `{version, model, serialNumber, GHC, extra}` with the GHC key in
// capitals; `extra.profileModeCaps` is `unified_de1.dart`'s fail-closed word; the workflow
// body is `Workflow.toJson` (top-level `id` = the WORKFLOW uuid, `profile` = a bare
// `Profile.toJson` with no id); the profile listing is `ProfileRecord.toJson` rows.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    R_ADAPTERS,
    R_TAGS,
    R_ADAPTER_OUTPUTS,
    rAdapter,
    r1LoadedProfileId,
    R1_SOURCE,
    r2MachineLimits,
    machineClassFromServedSet,
    r3GroupHeadControllerCapability,
    r3PuckEstimatorCapability,
    r3MilkProbeCapability,
    r3ProfileModeCapabilities,
    R3_SENSOR_CAPABILITY,
    R1_UNRESOLVED,
    PROFILE_MODE_BIT,
    PROFILE_MODE_MASK,
} from '../src/data/adapters-r.js';
import * as adapters from '../src/data/adapters-r.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const MODULE_PATH = fileURLToPath(new URL('../src/data/adapters-r.js', import.meta.url));
const SOURCE = readFileSync(MODULE_PATH, 'utf8');

/** Code with comments removed — routes and tags live in strings, so strings stay. */
const CODE = stripComments(SOURCE);

/**
 * Identifiers only: comments AND string bodies dropped. The register rows describe the
 * upstream gap in words, and "the handler emits the seven iff the device is a
 * BengleInterface" is a RECORD, not a sniff — the same distinction `rea-excluded.test.mjs`
 * draws. What must not exist is a machine name being READ.
 */
const IDENTIFIERS = stripComments(SOURCE, { dropStrings: true });

const SEVEN = ['cupWarmer', 'integratedScale', 'stopAtWeight', 'ledStrip', 'scaleCalibration', 'preheat', 'wakeSchedule'];

const machineInfo = (over = {}) => ({
    version: '1293',
    model: 'decentDe1',
    serialNumber: '12345',
    GHC: false,
    extra: { refillKit: true, voltage: 230, profileModeCaps: 0 },
    ...over,
});

describe('the tags are greppable, in the text', () => {
    test('every R-number in the register appears in the module source', () => {
        assert.deepEqual(R_TAGS, ['R1', 'R2', 'R3']);
        for (const tag of R_TAGS) {
            const hits = [...SOURCE.matchAll(new RegExp(`\\b${tag}\\b`, 'g'))].length;
            assert.ok(hits >= 2, `${tag} appears ${hits} time(s) in adapters-r.js — a tag must be findable by grep`);
            assert.ok(new RegExp(`['"]${tag}['"]`).test(CODE), `${tag} appears only in prose — the register must carry it as code`);
        }
    });

    test('every exported adapter function is named for its R-number', () => {
        const exported = Object.entries(adapters)
            .filter(([name, value]) => typeof value === 'function' && /^r\d/.test(name))
            .map(([name]) => name);
        assert.ok(exported.length >= 6, `expected the wave's adapters, found ${exported.length}`);
        for (const name of exported) {
            const tag = name.match(/^r(\d+)/)[1];
            const row = rAdapter(name);
            assert.equal(row.tag, `R${tag}`, `${name} is registered under ${row.tag}`);
        }
    });

    test('every register row has an exported adapter of that name — no orphan rows', () => {
        for (const row of R_ADAPTERS) {
            assert.equal(typeof adapters[row.adapter], 'function', `${row.adapter} is registered but not exported`);
        }
    });

    test('an adapter with no R-number is impossible: answers carry the tag', () => {
        const answer = r3GroupHeadControllerCapability(machineInfo({ GHC: true }));
        assert.equal(answer.tag, 'R3');
        assert.equal(answer.adapter, 'r3GroupHeadControllerCapability');
        assert.equal(answer.provisional, true);
        assert.match(answer.swapWhen, /capability/i);
    });

    test('rAdapter refuses a name it does not carry rather than inventing a row', () => {
        assert.throws(() => rAdapter('r9Nothing'), /no register row/);
    });

    test('every row names its missing field and its swap', () => {
        for (const row of R_ADAPTERS) {
            assert.ok(row.missingField && row.missingField.length > 10, `${row.adapter}: missingField`);
            assert.ok(row.swapWhen && row.swapWhen.length > 10, `${row.adapter}: swapWhen`);
            assert.ok(Array.isArray(row.outputs) && row.outputs.length >= 1, `${row.adapter}: outputs`);
        }
        // The lane-3 audit greps these across the tree for a second hand-written copy.
        assert.equal(new Set(R_ADAPTER_OUTPUTS).size, R_ADAPTER_OUTPUTS.length, 'output names collide');
    });
});

describe('A3 — no machine-name sniff anywhere in the module', () => {
    test('no machine name is READ — the word survives only as a record', () => {
        assert.ok(!/bengle/i.test(IDENTIFIERS), 'adapters-r.js names the machine model in code — A3 forbids the sniff');
        assert.ok(/BengleInterface/.test(SOURCE), 'the register should still EXPLAIN the predicate it stands in for');
    });

    test('the code reads no `model` field', () => {
        assert.ok(!/\.model\b/.test(IDENTIFIERS), 'adapters-r.js reads a model field');
        assert.ok(!/\[\s*['"]model['"]\s*\]/.test(CODE), 'adapters-r.js addresses a model key');
    });

    test('the module performs no request', () => {
        for (const forbidden of ['fetch', 'transport', 'routes.', 'callRoute']) {
            assert.ok(!IDENTIFIERS.includes(forbidden), `adapters-r.js reaches for ${forbidden} — adapters are pure`);
        }
    });
});

describe('R3 — the sensor capability gate', () => {
    test('no answer held is UNKNOWN, never a no', () => {
        for (const held of [null, undefined]) {
            const answer = r3PuckEstimatorCapability(held);
            assert.equal(answer.known, false);
            assert.equal(answer.value, null);
        }
    });

    test('an empty served set is a REAL answer: this machine cannot carry the estimator', () => {
        const answer = r3PuckEstimatorCapability([]);
        assert.equal(answer.known, true);
        assert.equal(answer.value, false);
    });

    test('a non-empty served set means it can — the same predicate the route gate uses', () => {
        const answer = r3PuckEstimatorCapability(SEVEN);
        assert.equal(answer.known, true);
        assert.equal(answer.value, true);
        assert.match(answer.basis, /non-empty/);
        assert.match(answer.note, /can-have, not has/);
    });

    test('the milk probe answers on the same predicate and is its own named adapter', () => {
        assert.equal(r3MilkProbeCapability(SEVEN).value, true);
        assert.equal(r3MilkProbeCapability([]).value, false);
        assert.equal(r3MilkProbeCapability(SEVEN).adapter, 'r3MilkProbeCapability');
        assert.notEqual(R3_SENSOR_CAPABILITY.puckEstimator, R3_SENSOR_CAPABILITY.milkProbe);
    });

    test('an unreadable answer is unknown, not false', () => {
        const answer = r3PuckEstimatorCapability('seven');
        assert.equal(answer.known, false);
        assert.equal(answer.value, null);
    });
});

describe('R3 — group-head controller, the named example', () => {
    test('reads the served GHC key, in capitals as MachineInfo.toJson writes it', () => {
        assert.equal(r3GroupHeadControllerCapability(machineInfo({ GHC: true })).value, true);
        assert.equal(r3GroupHeadControllerCapability(machineInfo({ GHC: false })).value, false);
    });

    test('an absent key is UNKNOWN — an older server, not a machine without the hardware', () => {
        const noKey = machineInfo();
        delete noKey.GHC;
        const answer = r3GroupHeadControllerCapability(noKey);
        assert.equal(answer.known, false);
        assert.equal(answer.value, null);
    });

    test('the lower-case spelling is not read — the key is GHC', () => {
        const wrong = machineInfo();
        delete wrong.GHC;
        wrong.ghc = true;
        assert.equal(r3GroupHeadControllerCapability(wrong).known, false);
    });

    test('a non-boolean is unknown rather than coerced', () => {
        assert.equal(r3GroupHeadControllerCapability(machineInfo({ GHC: 1 })).known, false);
    });
});

describe('R3 — profile modes are a UI-offer HINT, and fail closed', () => {
    test('the mask covers the highest defined bit', () => {
        assert.equal(PROFILE_MODE_MASK, 0xF);
        assert.deepEqual(PROFILE_MODE_BIT, { power: 0x1, lever: 0x2, hold: 0x4, powerExit: 0x8 });
    });

    test('each bit maps to its mode', () => {
        const answer = r3ProfileModeCapabilities(machineInfo({ extra: { profileModeCaps: 0x5 } }));
        assert.equal(answer.known, true);
        assert.deepEqual(answer.value.offers, { power: true, lever: false, hold: true, powerExit: false });
    });

    test('a power-exit machine (0xF) is NOT treated as garbage', () => {
        const answer = r3ProfileModeCapabilities(machineInfo({ extra: { profileModeCaps: 0xF } }));
        assert.equal(answer.value.mask, 0xF);
        assert.equal(answer.value.offers.powerExit, true);
    });

    test('bits outside the mask fail closed to no modes, as unified_de1.dart does', () => {
        const answer = r3ProfileModeCapabilities(machineInfo({ extra: { profileModeCaps: 0x1F } }));
        assert.equal(answer.known, true);
        assert.equal(answer.value.mask, 0);
        assert.deepEqual(Object.values(answer.value.offers), [false, false, false, false]);
        assert.match(answer.basis, /fail-closed/);
    });

    test('an absent register is UNKNOWN, not zero modes', () => {
        const answer = r3ProfileModeCapabilities(machineInfo({ extra: { voltage: 230 } }));
        assert.equal(answer.known, false);
        assert.equal(answer.value, null);
    });

    test('the legacy second spelling is NOT read (A7 — a fallback key is a fallback path)', () => {
        assert.ok(!/novelControlCaps/.test(IDENTIFIERS), 'the legacy caps key is read in the adapter module');
        assert.ok(/novelControlCaps/.test(SOURCE), 'the reason it is NOT read should stay written down');
        const legacyOnly = machineInfo({ extra: { novelControlCaps: 0x7 } });
        assert.equal(r3ProfileModeCapabilities(legacyOnly).known, false);
    });

    test('the answer says it is a hint, so a caller cannot mistake it for authority', () => {
        const answer = r3ProfileModeCapabilities(machineInfo({ extra: { profileModeCaps: 0x1 } }));
        assert.match(answer.note, /hint only/);
        assert.match(answer.note, /B9/);
    });
});

describe('R1 — the loaded profile id, provisional by title match', () => {
    const workflow = (title) => ({
        id: 'workflow-uuid-0000',            // the WORKFLOW's uuid. Never the profile's.
        name: 'Espresso',
        description: '',
        profile: { version: '2', title, notes: '', author: 'Decent', beverage_type: 'espresso', steps: [] },
        steamSettings: {},
        hotWaterData: {},
        rinseData: {},
    });
    const listing = (...titles) => titles.map((title, index) => ({
        id: `profile-${index}`,
        profile: { title },
        metadataHash: 'h', compoundHash: 'h', parentId: null,
        visibility: 'visible', isDefault: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        metadata: {},
    }));

    test('a unique title resolves, and the answer is marked PROVISIONAL', () => {
        const answer = r1LoadedProfileId(workflow('Best Blooming'), listing('Other', 'Best Blooming'));
        assert.equal(answer.known, true);
        assert.equal(answer.value.id, 'profile-1');
        assert.equal(answer.provisional, true);
        assert.match(answer.basis, /PROVISIONAL/);
        assert.equal(answer.tag, 'R1');
    });

    test('DUPLICATE TITLES report ambiguity — never the first match', () => {
        const answer = r1LoadedProfileId(workflow('Blooming'), listing('Blooming', 'Blooming'));
        assert.equal(answer.known, false);
        assert.equal(answer.value.id, null);
        assert.equal(answer.value.reason, R1_UNRESOLVED.AMBIGUOUS);
        assert.deepEqual(answer.value.candidates, ['profile-0', 'profile-1']);
    });

    /* ─────────────────────────────────────────────────────────────────────────
     * THE BODY BREAKS A TITLE TIE, and this is a real machine's case rather than a
     * constructed one. Ben, 25 August 2026: "I just pulled a shot, but if I click
     * edit profile the page is blank". His loaded profile had been edited, and
     * saving an edit KEEPS the old record — so two records carried one title, R1
     * answered `ambiguous`, and the shell seated nothing.
     *
     * WHY MATCHING THE BODY IS NOT PICKING ONE: the store is content-addressed
     * (`ProfileController.create` computes the id from the profile and returns the
     * existing record when the content is already stored), so two records cannot
     * hold the same body. A body that equals exactly one candidate identifies it.
     * ──────────────────────────────────────────────────────────────────────── */
    const bodied = (title, ...bodies) => bodies.map((profile, index) => ({
        id: `profile-${index}`,
        profile: { version: '2', title, notes: '', author: 'Decent', beverage_type: 'espresso', ...profile },
        metadataHash: 'h', compoundHash: `h${index}`, parentId: null,
        visibility: 'visible', isDefault: false,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        metadata: {},
    }));

    test('two records, one title: the SERVED BODY settles it', () => {
        /* The workflow body carries `steps: []`. Candidate 1 matches it; candidate 0
         * is the other version of the same profile and differs by a step. */
        const answer = r1LoadedProfileId(
            workflow('Blooming'),
            bodied('Blooming', { steps: [{ pump: 'flow' }] }, { steps: [] }),
        );
        assert.equal(answer.known, true);
        assert.equal(answer.value.id, 'profile-1');
        assert.equal(answer.value.reason, null);
        assert.equal(answer.value.source, R1_SOURCE.BODY_MATCH);
        assert.deepEqual(answer.value.candidates, ['profile-0', 'profile-1'],
            'both candidates are still reported — the answer says which, not that there was one');
        assert.match(answer.basis, /matches exactly one/);
    });

    test('a body that matches NONE of the candidates stays ambiguous', () => {
        const answer = r1LoadedProfileId(
            workflow('Blooming'),
            bodied('Blooming', { steps: [{ pump: 'flow' }] }, { steps: [{ pump: 'pressure' }] }),
        );
        assert.equal(answer.known, false);
        assert.equal(answer.value.id, null);
        assert.equal(answer.value.reason, R1_UNRESOLVED.AMBIGUOUS);
        assert.match(answer.basis, /matches none of them/);
    });

    test('two bodies alike is still never resolved by picking one', () => {
        const answer = r1LoadedProfileId(
            workflow('Blooming'),
            bodied('Blooming', { steps: [] }, { steps: [] }),
        );
        assert.equal(answer.known, false);
        assert.equal(answer.value.id, null);
        assert.equal(answer.value.reason, R1_UNRESOLVED.AMBIGUOUS);
        assert.match(answer.basis, /2 bodies match/);
    });

    test('key ORDER is not content: the same values in another order still match', () => {
        /* JSON.stringify on both sides would call these two different, and nothing in
         * the transport promises an order. */
        const answer = r1LoadedProfileId(
            workflow('Blooming'),
            [{
                id: 'profile-0',
                profile: { steps: [], beverage_type: 'espresso', author: 'Decent', notes: '', title: 'Blooming', version: '2' },
                metadataHash: 'h', compoundHash: 'h0', parentId: null,
                visibility: 'visible', isDefault: false,
                createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: {},
            }, ...bodied('Blooming', { steps: [{ pump: 'flow' }] })],
        );
        assert.equal(answer.value.id, 'profile-0');
        assert.equal(answer.value.source, R1_SOURCE.BODY_MATCH);
    });

    test('the WORKFLOW uuid is never read as the profile id', () => {
        const answer = r1LoadedProfileId(workflow('Missing'), listing('Other'));
        assert.equal(answer.value.id, null);
        assert.equal(answer.value.reason, R1_UNRESOLVED.NO_MATCH);
    });

    test('no listing, no title and no workflow are each their own reportable reason', () => {
        assert.equal(r1LoadedProfileId(workflow('X'), null).value.reason, R1_UNRESOLVED.NO_LISTING);
        assert.equal(r1LoadedProfileId({ id: 'w', profile: {} }, []).value.reason, R1_UNRESOLVED.NO_TITLE);
        assert.equal(r1LoadedProfileId(null, []).value.reason, R1_UNRESOLVED.NO_WORKFLOW);
    });

    test('when the report starts carrying profile.id, the adapter says R1 HAS LANDED', () => {
        const report = workflow('Best Blooming');
        report.profile.id = 'served-id';
        const answer = r1LoadedProfileId(report, listing('Best Blooming'));
        assert.equal(answer.value.id, 'served-id');
        assert.equal(answer.known, true);
        assert.match(answer.basis, /R1 HAS LANDED/);
    });
});

// CORRECTED WITH THE TABLE (Risk 9). This block used to pin the reserved slot: that it
// threw, and that the register row read `slot-reserved`. The one interim table is now
// built (`src/lib/machine-limits.js`) and reached only through this adapter, so those two
// assertions would defend an unbuilt slot against built code. What DOES survive unchanged
// is the number scan — the numbers live in the table module and nowhere else, and this
// adapter is a door, not a second copy.
describe('R2 — the one interim limits table, and only through this door', () => {
    test('the adapter hands back a table rather than refusing', () => {
        const answer = r2MachineLimits(SEVEN);
        assert.equal(answer.tag, 'R2');
        assert.equal(answer.known, true);
        assert.equal(answer.provisional, true);
        assert.ok(answer.value.hotWaterVolume, 'the machine-independent rows are there');
    });

    /* THE TWO CEILINGS ARE THE SAME NUMBER TODAY, AND THE INPUT STILL MATTERS.
     *
     * This test asserted `bengle.max > de1.max`, which pinned a DIFFERENCE rather than the
     * mechanism. Ben raised both ceilings to 170 on 26 August 2026 after the bench served
     * a Bengle holding exactly 170 — a skin refusing to show the machine's own value is a
     * wrong band, not a safe one — so the difference is gone and the mechanism is not.
     *
     * What the adapter promises is that the class comes from the SERVED SET and never from
     * a model string, and that the table says which class it resolved. That is what is
     * asserted now, and it keeps holding the day the two bands diverge again. */
    test('the machine class comes from the served capability answer, never a model string', () => {
        const bengle = r2MachineLimits(SEVEN).value.steamTemp;
        const de1 = r2MachineLimits([]).value.steamTemp;
        assert.equal(bengle.machineClass, 'bengle', 'a non-empty served set is ReaPrime saying Bengle');
        assert.equal(de1.machineClass, 'de1', 'and an empty one is ReaPrime saying it is not');
        assert.equal(bengle.floor, de1.floor, 'the floor is the same on both');
        assert.equal(machineClassFromServedSet(SEVEN), 'bengle', 'one rule, exported, one implementation');
        assert.equal(machineClassFromServedSet([]), 'de1');
        assert.equal(machineClassFromServedSet(null), null, 'and no answer is neither class');
    });

    test('no capability answer held means NO STEAM ROW, not a stand-in ceiling', () => {
        for (const held of [null, undefined, 'not-an-array']) {
            const answer = r2MachineLimits(held);
            assert.equal(answer.known, false);
            assert.equal(Object.hasOwn(answer.value, 'steamTemp'), false,
                'A7: absence is the answer; a fabricated ceiling is not');
            assert.ok(answer.value.hotWaterVolume, 'the rows that do not depend on it stay');
        }
    });

    test('the module carries no limit numbers at all', () => {
        const numbers = (CODE.match(/\b\d+(\.\d+)?\b/g) || []).filter((n) => !/^0x/.test(n));
        for (const forbidden of ['130', '135', '160', '165', '170', '20']) {
            assert.ok(!numbers.includes(forbidden), `adapters-r.js carries the limit number ${forbidden} — the numbers live in the ONE table`);
        }
    });

    test('the register row is shipping-provisional, and still names the swap', () => {
        const row = rAdapter('r2MachineLimits');
        assert.equal(row.status, 'shipping-provisional');
        assert.match(row.interim, /machine-limits\.js/);
        assert.match(row.swapWhen, /limits endpoint/);
    });
});
