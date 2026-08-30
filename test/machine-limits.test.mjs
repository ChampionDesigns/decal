// THE ONE LIMITS TABLE, and the two things that make it worth having: it is the only
// copy (B2), and its steam numbers are the corrected ones (B3).
//
// The audit that produced the original module found the same field carrying different
// limits depending on which control you reached it through — hot water temp 0-100 on the
// Live rail and 50-95 in Settings, hot water volume 0-255 against 10-500, steam duration
// 0-unbounded against 10-120, and steam temperature with THREE ranges, one of them on a
// second settings page for the same field. Each looked deliberate where it was written;
// the disagreement existed only between files, which is exactly the kind of thing a test
// can hold still.
//
// CORRECTED, NOT CARRIED (Risk 9). The suite this one descends from asserted the steam
// row was `{min: 0, max: 170, floor: 130}` and pinned `step('steamTemp', 0, +1) === 130`.
// Those assertions DEFENDED THE DEAD BAND: ReaPrime enables the steam heater at
// `targetSteamTemp >= 135` (`de1_controller.dart:427` and three sibling sites), so a tile
// showing the old floor sat above a machine written a disabled heater. `doc/Skins.md:573`
// gives the whole envelope: "135-160 C for DE1 and 135-165 C for Bengle". The floor rises,
// the ceiling comes DOWN, and it is machine-dependent. Every one of those assertions is
// rewritten below, in the same change as the values.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    MACHINE_CLASSES,
    LIMIT_KEYS,
    REAPRIME_FAN_MMR_CEILING,
    REAPRIME_FAN_RESET_REQUEST,
    FAN_THRESHOLD_AFTER_RESET,
    limitsFor,
    hasLimit,
    clamp,
    step,
    rangeHint,
    bandHint,
    numpadRange,
} from '../src/lib/machine-limits.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const MODULE_PATH = fileURLToPath(new URL('../src/lib/machine-limits.js', import.meta.url));
const SOURCE = readFileSync(MODULE_PATH, 'utf8');
const CODE = stripComments(SOURCE);

const BENGLE = limitsFor('bengle');
const DE1 = limitsFor('de1');
const UNKNOWN = limitsFor(null);

describe('the agreed ranges are what is declared', () => {
    test('the machine-independent rows, written out longhand', () => {
        // Longhand on purpose: these are decisions, and a decision that can only be read
        // as a diff is one nobody can check.
        for (const limits of [BENGLE, DE1, UNKNOWN]) {
            assert.deepEqual(
                { min: limits.hotWaterTemp.min, max: limits.hotWaterTemp.max }, { min: 0, max: 99 });
            // 255, not 500, and the reason is on the wire: the DE1's shot-settings packet
            // gives this ONE BYTE and ReaPrime packs it into a Uint8List, which truncates.
            // Measured — a target of 400 came back from the machine as 144. The same
            // ceiling applies when the stop is by WEIGHT, because that target travels
            // through this same field on its way to the machine.
            assert.deepEqual(
                { min: limits.hotWaterVolume.min, max: limits.hotWaterVolume.max }, { min: 0, max: 255 });
            assert.ok(limits.hotWaterVolume.max <= 255,
                'anything above a byte does not clamp on this machine, it wraps');
            // 10 TO 120 IN FIVES SINCE 26 AUGUST 2026, and it is Slate's band
            // (`settings.js:3474`, step="5" min="10" max="120") because no MMR declares
            // one. The floor is the change that matters: with an explicit Off option on
            // the Steam stop bank, a duration of zero was a SECOND spelling of "no time
            // stop" — the same duplicate meaning Ben stripped out of the flush row and out
            // of the tank row on the same day. Off owns zero; the stepper offers durations.
            assert.deepEqual(
                { min: limits.steamDuration.min, max: limits.steamDuration.max }, { min: 10, max: 120 });
            assert.equal(limits.steamDuration.step, 5, "Slate's step, and the only stated one");
            assert.deepEqual(
                { min: limits.steamFlow.min, max: limits.steamFlow.max }, { min: 0.4, max: 2.5 });
            assert.deepEqual(
                { min: limits.brewTemp.min, max: limits.brewTemp.max }, { min: 70, max: 110 });
        }
    });

    test('the two ranges folded in from where they were the only copy', () => {
        // Flush temperature and flush flow were declared on one settings page and nowhere
        // else; ReaPrime's MMR rows for them carry no min/max, so this is the only band
        // there is until R2 serves one.
        assert.deepEqual({ min: BENGLE.flushTemp.min, max: BENGLE.flushTemp.max }, { min: 5, max: 95 });
        // 2, not 1, since 26 August 2026 — Ben: "flush range should be 2 to 8ml/s".
        // Below 2 mL/s the flush is too slow to clear the group.
        assert.deepEqual({ min: BENGLE.flushFlow.min, max: BENGLE.flushFlow.max }, { min: 2, max: 8 });
        // THE FAN THRESHOLD USED TO BE ASSERTED HERE AND IS NOT ANY MORE. It was a
        // machine-INDEPENDENT row when this test was written, which is what made it one of
        // "the three ranges folded in"; on 27 August 2026 it became machine-dependent and
        // moved to `limitsFor`, so its assertions moved to the machine-class block with the
        // steam ceiling's. Two rows are left folded in here, and the name of this test is
        // now one ahead of its contents — see the rename below.
    });

    test('B3 — the steam floor is the enablement threshold, on both machines', () => {
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(DE1.steamTemp.floor, 135);
        assert.notEqual(BENGLE.steamTemp.floor, 130, 'the retired floor is the dead band');
    });

    /* THE BENGLE'S CEILING WENT BACK UP TO 170 (Ben, 26 August 2026). THE DE1'S DID NOT.
     *
     * B3 lowered it to 165/160 from a reading of the machine's band. The bench answered
     * the other way: the live rig serves `steamTargetTemperature` 170 on a Bengle, so a
     * ceiling of 165 was a skin refusing to show a value the machine actually holds — the
     * '+' greyed out at a number ABOVE the one printed beside the label. A range that
     * excludes the machine's own value is not a safety band, it is a wrong band.
     *
     * THAT READING WAS TAKEN ON A BENGLE, AND IT IS EVIDENCE ABOUT A BENGLE. For one day
     * this module carried 170 on both classes and this test asserted that it was "still
     * machine-dependent" while pinning the two to the same number — a sentence that
     * contradicts itself. `doc/Skins.md:573` states 135-160 for a DE1, nothing has been
     * measured against a DE1, and `adapters-r.js:557` returns that class for real users.
     * So the documented envelope stands until a DE1 corrects it: a ceiling is a safety
     * band, and evidence for one machine is not evidence for another.
     *
     * THE FLOOR IS UNCHANGED at 135, and so is the hole below it: the machine has no
     * setting between 0 and 135, and stepping down from 135 lands on 0. */
    test('B3 — the Bengle ceiling is 170, the DE1 is 160, and the class decides', () => {
        assert.equal(BENGLE.steamTemp.max, 170, 'measured on the bench machine');
        assert.equal(DE1.steamTemp.max, 160, 'doc/Skins.md:573, and nothing has re-measured it');
        assert.notEqual(BENGLE.steamTemp.max, DE1.steamTemp.max,
            'two classes with one number would make machineClass a parameter that changes nothing');
        for (const limits of [BENGLE, DE1]) {
            assert.equal(limits.steamTemp.min, 0, 'zero still means the heater is off');
            assert.equal(limits.steamTemp.floor, 135, 'and the hole below the band survives');
        }
    });

    test('the retired floor has no foothold in the module itself', () => {
        // Comments may still explain the old number; no declaration may carry it.
        const numbers = (CODE.match(/\b\d+(\.\d+)?\b/g) || []);
        assert.ok(!numbers.includes('130'),
            'machine-limits.js declares 130 — that is the retired steam floor');
    });

    /* THIS TEST WAS 'tankTemp is gone and does not come back' AND IT IS REVERSED
     * (Ben, 24 August 2026). The reasoning behind the deletion is still true and is
     * still recorded at the row: every profile send clobbers the MMR server-side
     * (`unified_de1.profile.dart` ends each `_sendProfile` with a `_writeMMRInt(
     * MMRItem.tankTemp, …)`), so the value a settings control writes does not survive
     * the next profile load.
     *
     * WHAT DOES NOT FOLLOW IS HIDING THE CONTROL. The machine's behaviour is not made
     * better by the user being unable to see or set the tank threshold, and Slate has
     * shipped the same control on the same machine throughout. The remedy is the row's
     * CAPTION, which says what a profile load does to it — the user then knows
     * something the empty leaf never told them.
     *
     * THE PROFILE EDITOR'S FIELD IS STILL UNRANGED, and that is the half that keeps
     * this from being one register written through two doors: `editor-ranges.js`
     * refuses `tankTemperature` and says why. */
    test('tankTemp is present on every class, and machine-independent', () => {
        for (const limits of [BENGLE, DE1, UNKNOWN]) {
            assert.equal(hasLimit(limits, 'tankTemp'), true);
        }
        assert.ok(LIMIT_KEYS.includes('tankTemp'));
        assert.deepEqual(BENGLE.tankTemp, DE1.tankTemp,
            'a threshold that differed by class would be a capability gate wearing a limits row');
    });

    test('LIMIT_KEYS names every row the table can carry', () => {
        assert.deepEqual([...Object.keys(BENGLE)].sort(), [...LIMIT_KEYS].sort());
    });
});

describe('the machine class is an input, never a guess', () => {
    // THE MACHINE-DEPENDENT ROWS, AND THERE ARE TWO OF THEM SINCE 27 AUGUST 2026. The steam
    // ceiling has been one since B3; the fan threshold joined it on Ben's answer that day.
    // Written out as a list because the assertions below are about the SHAPE of a
    // machine-dependent row — absent until the class is known — and a shape is worth
    // stating once for every row that has it rather than once per row.
    const MACHINE_DEPENDENT = ['steamTemp', 'fanThreshold'];

    test('an unknown class means a machine-dependent row is ABSENT, not defaulted', () => {
        // A7: absence is a first-class answer. Standing a plausible ceiling in for the
        // missing one is the fallback this build does not write.
        //
        // AND IT MATTERS MORE ON THE FAN ROW THAN ON STEAM, which is why the loop was worth
        // generalising rather than copying. The two fan bands OVERLAP but do not nest —
        // Bengle 40-60, DE1 0-50 — so there is no honest stand-in even in principle: a
        // stand-in of either would let one machine's owner reach a number the other's
        // machine is not offered, and their first press would land inside it.
        for (const key of MACHINE_DEPENDENT) {
            assert.equal(hasLimit(UNKNOWN, key), false, `${key} must be absent on an unknown class`);
            assert.throws(() => clamp(UNKNOWN, key, 50), /no limits declared/);
            assert.throws(() => rangeHint(UNKNOWN, key), /no limits declared/);
        }
        assert.equal(limitsFor(undefined), UNKNOWN);
    });

    test('every other row survives an unknown class untouched', () => {
        for (const key of LIMIT_KEYS.filter((k) => !MACHINE_DEPENDENT.includes(k))) {
            assert.deepEqual(UNKNOWN[key], BENGLE[key]);
        }
    });

    /* THE FAN THRESHOLD, WHICH IS NOW TWO BANDS. Ben, 27 August 2026: "I think I will
     * update the FW in Bengle to 40-60c, 30 is too low and seems pointless so lets increase
     * it this in the decal for Bengle and do what ever reaprime has for the DE1."
     *
     * IT WAS 30-70 ON BOTH for one day (26 August, his point 128) and 0-50 on both before
     * that, read straight off `MMRItem.fanThreshold`. The DE1 goes back to that declaration
     * because Ben's answer says to; the Bengle gets his own band. */
    test('the fan threshold is Ben\'s band on a Bengle and ReaPrime\'s on a DE1', () => {
        assert.deepEqual(
            { min: BENGLE.fanThreshold.min, max: BENGLE.fanThreshold.max }, { min: 40, max: 60 });
        assert.deepEqual(
            { min: DE1.fanThreshold.min, max: DE1.fanThreshold.max }, { min: 0, max: 50 });
        // It is a TEMPERATURE on both, not the percentage the old page printed.
        assert.equal(BENGLE.fanThreshold.unit, '\u00B0C');
        assert.equal(DE1.fanThreshold.unit, '\u00B0C');
        // int32 on the wire (`MmrValueKind.int32`, `_packMMRInt`), so a whole-degree step
        // on both — a fractional one would offer values the write cannot carry.
        assert.equal(BENGLE.fanThreshold.step, 1);
        assert.equal(DE1.fanThreshold.step, 1);
        // TWO DIFFERENT BANDS, asserted directly: if a later edit collapses them back to
        // one, the map has stopped earning its existence and this is the line that says so.
        assert.notDeepEqual(BENGLE.fanThreshold, DE1.fanThreshold);
    });

    /* ═══════════════════════════════════════════════════════════════════════════════
     * THE GAP BETWEEN THE BENGLE'S CEILING AND WHAT THE TABLET WILL ACTUALLY WRITE
     * ═══════════════════════════════════════════════════════════════════════════════
     *
     * THIS TEST PINS A KNOWN, DELIBERATE, DATED DEFECT AND IT IS SUPPOSED TO. Ben shipped
     * the Bengle band on the strength of a FIRMWARE change he is making to the machine;
     * the clamp that binds today is neither on the machine nor in this skin, it is in
     * ReaPrime on the tablet, and it has not moved:
     *
     *   MMRItem.fanThreshold  (de1.models.dart:237-244)      min: 0, max: 50
     *   _writeMMRInt          (unified_de1.mmr.dart:136-141) value.clamp(item.min!, item.max!)
     *   class Bengle extends UnifiedDe1 (bengle.dart:14-21)  does NOT override
     *                                                        setFanThreshhold
     *
     * So a Bengle owner who dials 60 has 50 written, silently, and reads 50 back. The
     * assertion is deliberately written the way it is TRUE rather than the way it OUGHT to
     * be, because a test that asserted the ceiling was reachable would be green on a lie.
     *
     * WHEN REAPRIME'S BOUND MOVES, THIS TEST GOES RED, AND THAT IS THE POINT — it is the
     * tripwire that tells whoever bumps `REAPRIME_FAN_MMR_CEILING` that the caveat
     * paragraphs in `machine-limits.js` and `settings-leaves.js` are now stale and need
     * deleting rather than editing.
     */
    test('the Bengle band reaches above what ReaPrime will write, and that is recorded', () => {
        assert.equal(REAPRIME_FAN_MMR_CEILING, 50,
            "ReaPrime's declared MMR ceiling — re-read de1.models.dart before changing this");
        assert.ok(BENGLE.fanThreshold.max > REAPRIME_FAN_MMR_CEILING,
            'the gap is the known defect; if it has closed, delete this test and the caveats');
        // The DE1 row IS that ceiling rather than a second copy of the number.
        assert.equal(DE1.fanThreshold.max, REAPRIME_FAN_MMR_CEILING);
        // And the Bengle's FLOOR is reachable — the gap is at the top only, so a Bengle
        // owner can still set every value from 40 up to the clamp.
        assert.ok(BENGLE.fanThreshold.min < REAPRIME_FAN_MMR_CEILING);
    });

    /* WHAT "RESTORE DEFAULT SETTINGS" ACTUALLY LEAVES ON THE MACHINE, which is not what
     * ReaPrime's own handler asks for. `applySettingsDefaults` opens with
     * `setFanThreshhold(55)` (de1_controller.defaults.dart:111, and :8 on every connect),
     * 55 is above ReaPrime's own ceiling for the field, and the clamp takes it to 50.
     *
     * ReaPrime disagrees with itself here, in two files, and the clamp wins. The Default
     * column on Default Load Settings must print the OUTCOME or it prints 55 beside a Now
     * column reading 50 and the page looks broken. */
    test('a restore leaves 50, not the 55 ReaPrime asks for', () => {
        assert.equal(REAPRIME_FAN_RESET_REQUEST, 55, "the handler's own literal");
        assert.equal(FAN_THRESHOLD_AFTER_RESET, 50);
        assert.equal(FAN_THRESHOLD_AFTER_RESET, REAPRIME_FAN_MMR_CEILING,
            'it is 50 only because the clamp is 50 — derived, never typed');
        // AND IT IS INSIDE BOTH BANDS, so whatever machine is connected, the number a
        // restore leaves is one its own stepper can display and step away from.
        assert.ok(FAN_THRESHOLD_AFTER_RESET >= BENGLE.fanThreshold.min
            && FAN_THRESHOLD_AFTER_RESET <= BENGLE.fanThreshold.max);
        assert.ok(FAN_THRESHOLD_AFTER_RESET >= DE1.fanThreshold.min
            && FAN_THRESHOLD_AFTER_RESET <= DE1.fanThreshold.max);
    });

    test('a class the envelope was not decided for is an error, not a shrug', () => {
        assert.throws(() => limitsFor('decentPro'), /unknown machine class/);
        assert.deepEqual([...MACHINE_CLASSES], ['bengle', 'de1']);
    });

    test('the steam row says which class it was resolved for', () => {
        assert.equal(BENGLE.steamTemp.machineClass, 'bengle');
        assert.equal(DE1.steamTemp.machineClass, 'de1');
    });
});

describe('zero, and the hole above it', () => {
    test('zero survives, because on three of these it is a setting', () => {
        // Hot water volume 0 = no cap; steam duration 0 = heater off; steam temp 0 =
        // heater off. Every one of those was reachable from one surface and impossible to
        // restore from another, because the other clamped it away.
        for (const key of ['hotWaterVolume', 'steamTemp', 'hotWaterTemp']) {
            assert.equal(clamp(BENGLE, key, 0), 0, `${key} must keep zero`);
            assert.equal(clamp(BENGLE, key, -5), 0, `${key} must clamp below zero UP to zero`);
        }
        /* AND `steamDuration` NO LONGER KEEPS ZERO THROUGH THE CLAMP, which is the point of
         * its new floor rather than a loss. Zero is still REACHABLE and still DISPLAYS — the
         * Steam stop bank's Off option stages a duration of zero directly and the display
         * path does not clamp — but it is now the switch's word, not a number somebody can
         * step or type their way into. A clamp that accepted it would let the stepper say
         * "no time stop" in a second voice, under a bank that says it in the first. */
        assert.equal(clamp(BENGLE, 'steamDuration', 0), 10, 'the floor is the working band');
        assert.equal(clamp(BENGLE, 'steamDuration', -5), 10);
        /* TWO ROWS SAY WHAT THEIR ZERO MEANS AND THREE USED TO (26 August 2026).
         *
         * `steamDuration`, `flushDuration` and `tankTemp` each carried a zero meaning
         * that taught the bottom of a range as an off switch. Each of those pages now has
         * an actual switch, or does not need one: Ben on the flush — "it's a button the
         * user needs to press, no point turning it off"; on steam and the tank — a master
         * toggle at the top of the page does that job. A range hint is a range, and a
         * second job hidden in its bottom value is the thing the switches replaced.
         *
         * `steamTemp` LOST ITS ZERO MEANING TOO, and the paragraph above is why it was kept
         * for one more day than the other three. Zero there really is the machine's own way
         * of saying "no steam", and the steam switch really does WRITE it — `min: 0` and
         * `floor` both stay, so the clamp, the step and the numpad all still work the hole.
         * What went is the SENTENCE: with `zeroMeans` present the hint printed "0 or
         * 135-170 °C", which is the page teaching a second way to switch the heater off
         * directly under a switch that does it. Ben, 26 August 2026: "no need to have
         * <130 = off, the new toggle has that now." */
        assert.ok(BENGLE.hotWaterVolume.zeroMeans, 'a volume cap of zero is a real setting nobody else states');
        for (const key of ['steamTemp', 'steamDuration', 'flushDuration', 'tankTemp']) {
            assert.ok(!BENGLE[key].zeroMeans,
                `${key} must not teach its bottom value as an off switch — the page has a switch`);
        }
        assert.equal(BENGLE.steamTemp.min, 0, 'the mechanism stays; only the sentence went');
        assert.equal(BENGLE.steamTemp.floor, 135);
    });

    test('a value inside the steam hole snaps to the nearer END OF THE CORRECTED BAND', () => {
        assert.equal(clamp(BENGLE, 'steamTemp', 0), 0);
        assert.equal(clamp(BENGLE, 'steamTemp', 135), 135);
        assert.equal(clamp(BENGLE, 'steamTemp', 155), 155);
        assert.equal(clamp(BENGLE, 'steamTemp', 170), 170);
        assert.equal(clamp(BENGLE, 'steamTemp', 200), 170, 'and no higher');
        assert.equal(clamp(DE1, 'steamTemp', 200), 160, 'and the DE1 stops at ITS ceiling');
        assert.equal(clamp(BENGLE, 'steamTemp', 60), 0, 'nearer the off value');
        assert.equal(clamp(BENGLE, 'steamTemp', 100), 135, 'nearer the working band');
        // The number the old table accepted and the machine ignored.
        assert.equal(clamp(BENGLE, 'steamTemp', 130), 135, 'the dead band is not settable');
    });

    test('stepping crosses the hole instead of landing in it', () => {
        // Both ends have to be reachable with the same two buttons.
        assert.equal(step(BENGLE, 'steamTemp', 0, +1), 135, 'up from off enters the band at its floor');
        assert.equal(step(BENGLE, 'steamTemp', 135, -1), 0, 'down from the floor goes to off');
        assert.equal(step(BENGLE, 'steamTemp', 135, +1), 136);
        assert.equal(step(BENGLE, 'steamTemp', 170, +1), 170, 'and stops at the top');
        assert.equal(step(DE1, 'steamTemp', 160, +1), 160, 'the DE1 stops at 160');
        assert.equal(step(DE1, 'steamTemp', 165, +1), 160,
            'and a value above its ceiling comes back DOWN to it');
        assert.equal(step(BENGLE, 'steamTemp', 0, -1), 0, 'and at the bottom');
    });

    test('B3 REGRESSION — no path lands a user in the heater-off dead band', () => {
        // The defect in one assertion: the tile shows a temperature, the machine is
        // written a disabled steam heater, and nothing on screen says so. Sweep the whole
        // input space of both surfaces rather than sampling it.
        const dead = (n) => n > 0 && n < 135;
        for (const limits of [BENGLE, DE1]) {
            for (let value = -20; value <= 220; value += 1) {
                assert.ok(!dead(clamp(limits, 'steamTemp', value)),
                    `clamp(${value}) landed in the dead band`);
                for (const direction of [+1, -1]) {
                    assert.ok(!dead(step(limits, 'steamTemp', value, direction)),
                        `step(${value}, ${direction}) landed in the dead band`);
                }
            }
        }
    });
});

describe('the arithmetic and the errors', () => {
    test('stepping a fractional range does not accumulate float noise', () => {
        // 2.1 + 0.1 is 2.2000000000000002, which renders as itself and is written to the
        // machine as itself.
        assert.equal(step(BENGLE, 'steamFlow', 2.1, +1), 2.2);
        assert.equal(step(BENGLE, 'steamFlow', 0.4, -1), 0.4);
        assert.equal(step(BENGLE, 'steamFlow', 2.5, +1), 2.5);
        assert.equal(step(BENGLE, 'flushFlow', 2.1, +1), 2.2);
        assert.equal(step(BENGLE, 'brewTemp', 92, +1), 92.5);
    });

    test('a non-numeric value falls to the bottom rather than to NaN', () => {
        for (const key of Object.keys(BENGLE)) {
            assert.equal(clamp(BENGLE, key, undefined), BENGLE[key].min);
            assert.equal(clamp(BENGLE, key, ''), BENGLE[key].min);
            assert.ok(Number.isFinite(step(BENGLE, key, 'nonsense', +1)));
        }
    });

    test('an undeclared key is an error, not a silent pass-through', () => {
        // Returning the value unchanged would mean a typo in a call site removes that
        // control's limits entirely, which is worse than the bug this fixes.
        assert.throws(() => clamp(BENGLE, 'steamTempreature', 150), /no limits declared/);
        assert.throws(() => step(BENGLE, 'nope', 1, 1), /no limits declared/);
        assert.throws(() => numpadRange(BENGLE, 'nope'), /no limits declared/);
        assert.throws(() => rangeHint(BENGLE, 'nope'), /no limits declared/);
    });

    test('the table is frozen, so no caller can edit a limit in passing', () => {
        assert.ok(Object.isFrozen(BENGLE));
        assert.ok(Object.isFrozen(BENGLE.steamTemp));
    });
});

describe('what the surfaces print', () => {
    /* WHAT THIS TEST USED TO SAY, AND WHY IT DOES NOT SAY IT ANY MORE (audit F-021,
     * 29 August 2026). It was headed "the numpad range says what zero means, where zero
     * means something" and it pinned two things that are now the defect:
     *
     *     assert.deepEqual({ min: steam.min, max: steam.max }, { min: 0, max: 170 });
     *     assert.match(steam.label, /^0 or 135–170$/);
     *
     * A pad band of 0–170 makes every number in the hole TYPEABLE and leaves `clamp` to
     * substitute one of its ends afterwards: a typed 63 became `targetTemperature: 0`,
     * which switches the steam heater OFF. Reproduced four times, and Wave 4 proved the
     * server stores the 0. The pad now offers the WORKING band and refuses the rest, so
     * the label describes what it accepts rather than teaching the hole. */
    test('the numpad range is the band the pad ACCEPTS, hole excluded', () => {
        const steam = numpadRange(BENGLE, 'steamTemp');
        /* THE FLOOR IS THE PAD'S FLOOR. Zero is still the machine's "no steam" and is
         * still what `clamp` snaps to — it is simply not something a person can type into
         * a temperature field any more. Off is the master switch's job (Ben, 26 Aug 2026:
         * "no need to have <130 = off, the new toggle has that now"). */
        assert.deepEqual({ min: steam.min, max: steam.max }, { min: 135, max: 170 });
        /* ONE COMPOSER (audit F-047): the pad's sentence IS `bandHint`'s, so the pad, the
         * row's printed hint and the row's announced hint are one string. */
        assert.equal(steam.label, bandHint({ ...BENGLE.steamTemp, min: 135, floor: undefined }));
        assert.equal(steam.label, '135–170 °C');
        assert.equal(numpadRange(DE1, 'steamTemp').label, '135–160 °C',
            'the DE1 prints ITS ceiling — the class is what the label is for');
        assert.equal(numpadRange(DE1, 'steamTemp').min, 135);
        assert.match(numpadRange(BENGLE, 'hotWaterTemp').label, /0–99/);
        assert.equal(numpadRange(BENGLE, 'brewTemp').step, 0.5, 'the numpad gets the step too');
        /* AND THE TABLE IS UNTOUCHED — the hole is still declared and `clamp` still
         * enforces it. Narrowing the PAD is not narrowing the wire. */
        assert.equal(BENGLE.steamTemp.min, 0);
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(clamp(BENGLE, 'steamTemp', 63), 0);
    });

    test('the printed hint comes from the same declaration as the clamp', () => {
        // Three settings pages went on printing "10 - 120 s", "10 - 500 mL" and "50 - 95 C"
        // beside controls that had already been widened. The control accepted the new
        // range while the text beside it described the old one, which is worse than either
        // being wrong alone.
        // NO ZERO CLAUSE since 26 August 2026: the steam page has a master switch, so the
        // bottom of this range is a duration and nothing else.
        assert.equal(rangeHint(BENGLE, 'steamDuration'), '10–120 s');
        assert.equal(rangeHint(BENGLE, 'hotWaterVolume'), '0–255 mL · 0 = no volume cap');
        /* AND NO "0 or" ON THE STEAM TEMPERATURE EITHER, since 26 August 2026. The BAND is
         * unchanged — `floor` is still 135 and the hole below it still works — but the hint
         * describes the working band rather than teaching the hole as a second off switch,
         * because the page now has a switch. A row that still wants its zero explained says
         * so with `zeroMeans`, and `hotWaterVolume` above is the row that does. */
        assert.equal(rangeHint(BENGLE, 'steamTemp'), '135–170 °C');
        assert.equal(rangeHint(DE1, 'steamTemp'), '135–160 °C');
        // Temperatures print their unit through the units store, so ours is omitted or the
        // hint reads "0-99 C C".
        assert.equal(rangeHint(BENGLE, 'hotWaterTemp', (n) => n, { unit: false }), '0–99');
        assert.equal(rangeHint(BENGLE, 'steamTemp', (n) => n, { unit: false }), '135–170');
        // AND THE HINT IS MACHINE-DEPENDENT ON THIS ROW TOO SINCE 27 AUGUST 2026, which is
        // the whole reason it is worth printing from the table rather than beside the
        // control: the same row, the same composer, two sentences, and neither of them is
        // written down anywhere a person could get wrong.
        assert.equal(rangeHint(BENGLE, 'fanThreshold'), '40–60 °C');
        assert.equal(rangeHint(DE1, 'fanThreshold'), '0–50 °C');
    });

    test('a floor that DOES state a zero meaning still prints it — on the ROW', () => {
        /* THE BRANCH IS NOT DELETED, it is conditional — a future row with a hole whose
         * bottom is a setting in its own right still gets the sentence, and this is what
         * keeps the two spellings honest rather than leaving dead code behind the change. */
        const withMeaning = { hole: { min: 0, max: 10, floor: 4, step: 1, unit: 'x', zeroMeans: 'nothing at all' } };
        assert.equal(rangeHint(withMeaning, 'hole'), '0 (nothing at all) or 4–10 x');
        /* AND THE PAD DOES NOT PRINT IT, since 29 August 2026 (audit F-021). This line
         * read
         *
         *     assert.equal(numpadRange(withMeaning, 'hole').label, '0 (nothing at all) or 4–10');
         *
         * which was the pad advertising a value it now refuses: the pad's band excludes the
         * hole, so a sentence offering the zero would be an invitation the Confirm button
         * declines. The zero is still reachable — by whatever control OWNS the off state,
         * which on the one real row of this shape is the master switch — and `clamp` still
         * knows the hole. What changed is that the pad stopped teaching a route it does not
         * have. */
        const pad = numpadRange(withMeaning, 'hole');
        assert.deepEqual({ min: pad.min, max: pad.max }, { min: 4, max: 10 });
        assert.equal(pad.label, '4–10 x');
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * `bandHint` — THE SENTENCE, OVER A RANGE OBJECT (27 August 2026)
     *
     * Three surfaces print this line and only one of them holds the table's own row when
     * it does: the settings rows and the Live rail draw a CONVERTED band, and the
     * hot-water target draws the same row under two different words. So each was
     * assembling the sentence out of `rangeHint`'s pieces, and the hand-spelled copy in
     * `temperature.js` had already drifted — it went on printing the "0 or …" clause for
     * four weeks after Ben deleted `zeroMeans` from the steam row, so the same band read
     * "135–170 °C" in Celsius and "0 or 275–338 °F" in Fahrenheit.
     * ═══════════════════════════════════════════════════════════════════════ */

    test('bandHint is what rangeHint IS — one composer, two ways of naming the row', () => {
        for (const key of ['steamDuration', 'hotWaterVolume', 'steamTemp', 'hotWaterTemp']) {
            assert.equal(bandHint(BENGLE[key]), rangeHint(BENGLE, key), key);
            assert.equal(bandHint(BENGLE[key], { unit: '' }),
                rangeHint(BENGLE, key, undefined, { unit: false }), `${key}, bare`);
        }
    });

    test('bandHint reads the band it is HANDED, which is how a converted face gets a hint', () => {
        /* The Fahrenheit face of the steam row, spelled the way `displayRange` spells it —
         * bounds rounded to whole display units, `zeroMeans` carried, `floor` converted.
         * The point is that the SHAPE is decided here and only the numbers moved. */
        const shownF = { min: 32, max: 338, floor: 275, step: 1.8, unit: '°F' };
        assert.equal(bandHint(shownF), '275–338 °F');
        assert.equal(bandHint(BENGLE.steamTemp), '135–170 °C');
        const shape = (hint) => hint.replace(/[\d.]+/g, '#').replace(/°[CF]/, '°');
        assert.equal(shape(bandHint(shownF)), shape(bandHint(BENGLE.steamTemp)),
            'one band is one sentence — only the numbers and the symbol move');
    });

    test('a caller may restate the WORD without restating the band', () => {
        /* `hotWaterVolume` is ONE machine field behind two stop modes. The numbers do not
         * move between them — a millilitre of water weighs a gram — so only the word does,
         * and the zero meaning moves with it because the two are one sentence. */
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: 'g', zeroMeans: 'no weight cap' }),
            '0–255 g · 0 = no weight cap');
        /* AN OMITTED OVERRIDE IS NOT AN EMPTY ONE. A row that restates the unit and says
         * nothing about zero keeps the range's own meaning; that is what the settings
         * variant relied on and what a `?? ''` here would have quietly dropped. */
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: 'g' }),
            '0–255 g · 0 = no volume cap');
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: '' }), '0–255 · 0 = no volume cap');
    });

    test('no range is no sentence — an absence is not a band of zeroes', () => {
        assert.equal(bandHint(null), '');
        assert.equal(bandHint(undefined), '');
        assert.equal(bandHint(UNKNOWN.steamTemp), '',
            'the row the unknown class withholds has no hint to print, and A7 draws the rest');
    });

    test('the hint runs every value through the caller format, so °F converts', () => {
        const f = (n) => Math.round(n * 9 / 5 + 32);
        assert.equal(rangeHint(BENGLE, 'steamTemp', f, { unit: false }), '275–338');
    });
});

describe('B2 — exactly one table in the skin', () => {
    // The whole point. A hard-coded limit for one of these fields anywhere but here is the
    // bug coming back: it will look deliberate, and it will only disagree with this table
    // when somebody edits one of them.
    const SRC = fileURLToPath(new URL('../src/', import.meta.url));
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
        entry.isDirectory()
            ? walk(`${dir}${entry.name}/`)
            : (entry.name.endsWith('.js') ? [`${dir}${entry.name}`] : [])
    ));

    /* ONE PATTERN PER ROW, BUILT FROM THE TABLE'S OWN KEY LIST. This guard used to spell
     * three patterns by hand — steamTemp, hotWaterVolume and the steam floor — while its
     * title claimed "one of these fields", which is thirteen of them. The ten it did not
     * name (hotWaterTemp, steamDuration, steamFlow, dose, drinkWeight, milkStopTemp,
     * flushDuration, flushTemp, flushFlow, fanThreshold, brewTemp) could be re-declared
     * anywhere in src/ without a red test, and a second copy of a limit is exactly the
     * defect the audit found: hot water temp 0-100 on one page and 50-95 on another.
     * Deriving the list from LIMIT_KEYS also means a row ADDED to the table is guarded the
     * moment it is added, rather than when someone remembers to extend this array. */
    const rangeDeclaration = (key) => new RegExp(`\\b${key}\\s*:\\s*\\{[^{}]*\\b(?:min|max|floor|step)\\s*:`);
    const splitDeclaration = (key) => new RegExp(`\\b${key}(?:Min|Max|Floor|Ceiling|Range|Limits?)\\s*[:=]`);

    test('no other module in src/ declares a range for one of these fields', () => {
        const offenders = [];
        for (const path of walk(SRC)) {
            if (path === MODULE_PATH) continue;
            const code = stripComments(readFileSync(path, 'utf8'));
            for (const key of LIMIT_KEYS) {
                if (rangeDeclaration(key).test(code)) offenders.push(`${path.slice(SRC.length)}: a ${key} range`);
                if (splitDeclaration(key).test(code)) offenders.push(`${path.slice(SRC.length)}: a ${key} bound`);
            }
            // A steam working band under any name at all. The floor is a three-digit number
            // and nothing else in the skin declares one.
            if (/\bfloor\s*:\s*1\d\d\b/.test(code)) {
                offenders.push(`${path.slice(SRC.length)}: a steam working-band floor`);
            }
        }
        assert.deepEqual(offenders, [], 'these limits must come from machine-limits.js (B2)');
    });

    test('the guard is not vacuous — every key is caught, in both spellings', () => {
        for (const key of LIMIT_KEYS) {
            assert.ok(
                rangeDeclaration(key).test(`const LIMITS = { ${key}: { min: 0, max: 9, step: 1 } };`),
                `a second ${key} range would walk past the guard`,
            );
            assert.ok(
                splitDeclaration(key).test(`const ${key}Max = 9;`),
                `a hand-written ${key} bound would walk past the guard`,
            );
        }
    });

    test('and it does not fire on a VALUE named for a field — only on a range for one', () => {
        // The real uses in the tree today: a reading called `dose`, a preset list called
        // `brewTempPresets`. Naming a field is not declaring its limits, and a guard that
        // could not tell the two apart would earn itself an exemption.
        const innocent = [
            'dose: null,', 'const dose = shotDose(stored);', 'brewTempPresets: {',
            'steamFlowPresets: {', 'hotWaterTempPresets: {', "changes: ['flushTemp', 'flushFlow'],",
        ];
        for (const line of innocent) {
            for (const key of LIMIT_KEYS) {
                assert.ok(!rangeDeclaration(key).test(line), `${key} range false positive on ${line}`);
                assert.ok(!splitDeclaration(key).test(line), `${key} bound false positive on ${line}`);
            }
        }
    });

    test('it is pure — no DOM, no request, no storage', () => {
        for (const forbidden of ['document', 'window', 'fetch(', 'localStorage', 'import ']) {
            assert.ok(!CODE.includes(forbidden), `machine-limits.js reaches for ${forbidden}`);
        }
    });
});
