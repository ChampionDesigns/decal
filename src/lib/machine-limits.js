/**
 * THE ONE LIMITS TABLE (B2) — the permitted range of every machine value more than
 * one surface edits.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * A settings audit of the old skin found the same field carrying different limits
 * depending on which control you happened to reach it through:
 *
 *   hot water temp     Live rail 0-100 °C   |  Settings 50-95
 *   hot water volume   Live rail 0-255 mL   |  Settings 10-500
 *   steam duration     Live rail 0-unbounded|  Settings 10-120
 *   steam temperature  three ranges, one of them on a SECOND settings page for
 *                      the same field
 *
 * None of that is visible from any one screen. Each limit looks deliberate where
 * it is written; the disagreement exists only between files. So the limits live
 * here, ONCE, and every surface takes them from the R2 adapter. A range can still
 * be wrong, but it can no longer be wrong in one place and right in another.
 *
 * ---------------------------------------------------------------------------
 * B2 / R2 — THIS IS AN INTERIM TABLE
 * ---------------------------------------------------------------------------
 * ReaPrime will own these ranges (upstream item R2, possibly firmware F2
 * underneath). Until that lands there is EXACTLY ONE table in the skin and it is
 * this file, reached through `r2MachineLimits()` in `src/data/adapters-r.js` so
 * there is one greppable place to delete. No component owns a limit; a second
 * hand-written copy anywhere in the tree is the defect this file exists to make
 * impossible, and `test/machine-limits.test.mjs` scans `src/` for one.
 *
 * ---------------------------------------------------------------------------
 * B3 — THE STEAM NUMBERS ARE CORRECTED HERE, NOT CARRIED
 * ---------------------------------------------------------------------------
 * The old table declared the steam working band as starting at the retired floor
 * of one-three-zero and running flat to one-seven-zero on every machine. Both
 * numbers were wrong and the first was actively harmful: ReaPrime enables the
 * steam heater at `targetSteamTemp >= 135` (`de1_controller.dart:427`,
 * `de1_controller.defaults.dart:18`, three sibling sites), so stepping up from
 * off landed on a tile showing a temperature while the machine was written a
 * disabled steam heater. `doc/Skins.md:573` states the envelope verbatim:
 * "135-160 °C for DE1 and 135-165 °C for Bengle". So the floor rises and the
 * ceiling is MACHINE-DEPENDENT. The Bengle's ceiling has since gone back UP to 170,
 * measured on the machine itself (Ben, 26 August 2026); the DE1's has not moved.
 *
 * The machine class is an INPUT, never a guess and never a name-sniff (A3). This
 * module is pure and takes it as an argument; the R2 adapter converts ReaPrime's
 * served capability answer into it. When the class is not known the steam row is
 * simply ABSENT from the table — key presence is the validity signal, the same
 * convention `src/data/reading.js` uses, and A7 forbids inventing a stand-in.
 *
 * Pure: no DOM, no API, no storage, no server read of any kind. Units are the
 * machine's own (°C, mL, s, mL/s), never display units — convert at the edge,
 * clamp here.
 */

/** The two machine classes the steam envelope is decided for (`doc/Skins.md:573`). */
export const MACHINE_CLASSES = Object.freeze(['bengle', 'de1']);

/**
 * The steam working band. `floor` is the bottom of the band, distinct from `min`:
 * zero is a valid value meaning "heater off" and the next valid value is well
 * above it, so the range has a HOLE. Expressing it as a plain min/max would make
 * zero unreachable or make a mid-band number settable; neither is the machine's
 * behaviour.
 */
/**
 * THE STEAM BAND. Ben, 26 August 2026 — point 4: "Default should be 160c ... If its set
 * to 170 then + should be grayed out."
 *
 * 170 AND NOT 165, ON A BENGLE. The band was 135-165 on a Bengle and 135-160 on a DE1,
 * while the machine on Ben's bench reads 170 — a value above Decal's own stated ceiling,
 * which is what the visual audit caught (point 4 of the numbered report). The machine is
 * the truth teller (O2), so the ceiling follows it.
 *
 * AND THE DE1'S CEILING DID NOT MOVE WITH IT. Ben's 170 was READ OFF A BENGLE. Applying it
 * to the other class as well — which is what this map did for one day, 26 August 2026 —
 * offers a DE1 owner ten degrees above `doc/Skins.md:573`'s stated envelope on the
 * strength of a measurement taken on a different machine. There is no DE1 on this bench
 * to correct that document with, so the documented number stands until there is: evidence
 * for one class is not evidence for the other, and a ceiling is a safety envelope.
 *
 * THAT IS ALSO WHY THIS IS A MAP AND NOT A CONSTANT. Two classes with the same number
 * would be a distinction that makes no difference; two classes with two numbers is the
 * whole reason `machineClass` is an argument.
 *
 * THE FLOOR NO LONGER MEANS "OFF". Point 3: "no need to have <130 = off, the new toggle
 * has that now." The steam page gains its own on/off switch, so a temperature below the
 * band is not a way of switching the heater off any more — it is simply out of range, and
 * the stepper stops there.
 */
const STEAM_FLOOR = 135;
const STEAM_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 170, de1: 160 });

/**
 * WHAT REAPRIME WILL ACTUALLY WRITE INTO THE FAN THRESHOLD, WHATEVER IS ASKED FOR.
 *
 * `MMRItem.fanThreshold` declares `max: 50` and `_writeMMRInt` clamps to it silently, for
 * every machine class — the long paragraph below has the two pins. It is a named constant
 * rather than a `50` typed into the DE1 row because TWO separate things read it: the DE1's
 * band, which IS this bound, and `FAN_THRESHOLD_AFTER_RESET` beneath it, which is a
 * different fact about the same clamp. Two copies of a number that must move together is
 * what B2 exists to prevent, one scale smaller.
 *
 * IT IS NOT A LIMIT ROW AND MUST NOT BECOME ONE. A limits row is what this skin OFFERS a
 * person; this is what a layer underneath will silently do to their answer. The day the two
 * agree on every machine, this constant and the sentences around it go away together.
 */
export const REAPRIME_FAN_MMR_CEILING = 50;

/**
 * WHAT THE FAN THRESHOLD IS AFTER "RESTORE DEFAULT SETTINGS" — AND IT IS NOT THE NUMBER
 * REAPRIME ASKS FOR.
 *
 * `De1Controller.applySettingsDefaults` (`lib/src/controllers/de1_controller.defaults.dart:111`)
 * opens with `await device.setFanThreshhold(55)`, and `_setDe1DefaultsFor` (`:8`) does the
 * same on every connect. Fifty-five is ABOVE ReaPrime's own declared ceiling for the field,
 * so the clamp above takes it down to 50 on the way to the wire: ReaPrime disagrees with
 * itself about this number, in two files, and the clamp wins.
 *
 * SO THE HONEST "Default" IS 50, AND 55 IS WHAT A READER WOULD WRITE DOWN BY FOLLOWING THE
 * HANDLER. `src/screens/settings-bespoke-leaf.js`'s `RESET_FIELDS` carries 55 today, which
 * is the request rather than the outcome — so Default Load Settings prints a Default column
 * of 55 beside a Now column that reads 50 the instant the button is pressed, and the page
 * looks like it failed. It is DERIVED here rather than typed as 50, because the derivation
 * is the explanation: it says min(what is asked for, what will be written).
 *
 * @see REAPRIME_FAN_MMR_CEILING
 */
export const REAPRIME_FAN_RESET_REQUEST = 55;
export const FAN_THRESHOLD_AFTER_RESET = Math.min(
    REAPRIME_FAN_RESET_REQUEST, REAPRIME_FAN_MMR_CEILING,
);

/**
 * THE FAN THRESHOLD — the board temperature above which the cooling fan runs — AND IT IS
 * THE SECOND MACHINE-DEPENDENT ROW IN THIS TABLE. Ben, 27 August 2026, verbatim:
 *
 *   "I think I will update the FW in Bengle to 40-60c, 30 is too low and seems pointless
 *    so lets increase it this in the decal for Bengle and do what ever reaprime has
 *    for the DE1."
 *
 * So: BENGLE 40-60, and the DE1 gets ReaPrime's own declared bound rather than a number
 * chosen here. Two classes, two bands, which is the same argument the steam ceiling above
 * makes for being a map instead of a constant.
 *
 * WHAT WENT: 30-70 on both, one row in `BASE_LIMITS` (Ben, 26 August 2026, point 128:
 * "Range: 30-70c with 50c default"). That band's reasoning still holds and is worth
 * keeping — the table used to read 0-50 straight off `MMRItem.fanThreshold` while Slate
 * offered 0-100, and neither is a band a person would want to set, since a threshold of 0
 * runs the fan for ever and one of 100 never runs it at all. What was wrong was applying
 * one answer to two machines. Ben has a Bengle on the bench and 30 is below anything he
 * wants; the DE1's number is not his to set, so it is read rather than picked.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE TRUSTING THE BENGLE'S CEILING — THE CLAMP THAT BINDS IS NOT ON THE
 * MACHINE, IT IS ON THE TABLET, AND TODAY IT IS 50 ON EVERY MACHINE
 * ---------------------------------------------------------------------------
 *
 * Ben is changing the BENGLE'S FIRMWARE to accept 40-60. That is a change to one end of a
 * chain with three links, and the middle link has not moved. Read at the pin, ReaPrime:
 *
 *   `MMRItem.fanThreshold` (`lib/src/models/device/impl/de1/de1.models.dart:237-244`)
 *       fanThreshold(0x00803808, 4, MmrValueKind.int32, "Fan threshold temp",
 *                    min: 0, max: 50)
 *
 *   `_writeMMRInt` (`lib/src/models/device/impl/de1/unified_de1/unified_de1.mmr.dart:136-141`)
 *       final clampedValue = (item.min != null && item.max != null)
 *           ? value.clamp(item.min!, item.max!)
 *           : value;
 *       await _mmrWrite(item, _packMMRInt(clampedValue));
 *
 * No log line, no thrown error, no 400 back to the client — the number is quietly replaced
 * and the write succeeds. And the Bengle does NOT escape it: `class Bengle extends
 * UnifiedDe1` (`lib/src/models/device/impl/bengle/bengle.dart:14-21`) overrides the cup
 * warmer, the LED strip, the scale and the wake schedule, and does NOT override
 * `setFanThreshhold` — which is `UnifiedDe1`'s, at `unified_de1.dart:381-383`, and is one
 * line: `await _writeMMRInt(MMRItem.fanThreshold, temp)`. Checked on 27 August 2026;
 * checked once before, with the same answer.
 *
 * SO 51..60 IS UNREACHABLE ON A BENGLE TODAY. A Bengle owner who dials 60 has 50 written
 * to their machine and reads 50 back a moment later, and the control appears to have
 * refused a value inside its own printed band. That is precisely the "a finished half with
 * no other half" defect this row was flagged for, and shipping the band anyway is Ben's
 * call, made in the sentence quoted above with the firmware change already in hand.
 *
 * WHAT HAS TO CHANGE FOR THE TOP OF THE BENGLE BAND TO BECOME TRUE, in order:
 *
 *   1. Bengle firmware accepts 40-60. Ben's, in flight as of 27 August 2026.
 *   2. ReaPrime's `MMRItem.fanThreshold` stops declaring `max: 50` for a Bengle — either
 *      a per-machine bound, or `Bengle` overriding `setFanThreshhold`. NOT DONE, and
 *      until it is, step 1 buys a Bengle owner nothing at all.
 *   3. `REAPRIME_FAN_MMR_CEILING` above is raised or deleted, and the test that pins the
 *      gap ("the Bengle band's top is above what ReaPrime will write") is rewritten to
 *      whatever is then true.
 *
 * CHECK IT, DO NOT TRUST IT. The two ReaPrime line numbers above are the whole of the
 * evidence and they are cheap to re-read: `grep -n 'fanThreshold' de1.models.dart` and
 * `grep -n '_writeMMRInt' unified_de1.mmr.dart` in `/home/ben/bengle/reaprime`.
 */
const FAN_THRESHOLD_BY_MACHINE_CLASS = Object.freeze({
    /* BEN'S BAND, 27 August 2026, and its top is ten degrees above what the tablet will
     * currently write. See the paragraph above; the gap is deliberate, dated and pinned. */
    bengle: Object.freeze({ min: 40, max: 60, step: 1, unit: '\u00B0C' }),
    /* "DO WHAT EVER REAPRIME HAS FOR THE DE1" — so this row is READ, not chosen, and the
     * ceiling is `REAPRIME_FAN_MMR_CEILING` rather than a second copy of 50. `min: 0` is the
     * same declaration's own floor. A threshold of 0 runs the fan continuously, which is a poor
     * setting and is not this skin's to overrule on a machine it cannot measure: Decal
     * has a DE1 nowhere to check against, and inventing a floor for one would be exactly
     * the "evidence for one class is not evidence for the other" mistake the steam ceiling
     * above records having made once already.
     *
     * `step: 1` IS NOT DECLARED ANYWHERE AND IS NOT A GUESS EITHER: the MMR is
     * `MmrValueKind.int32` and `_packMMRInt` writes a whole number, so a fractional step
     * would offer values the wire cannot carry. */
    de1: Object.freeze({ min: 0, max: REAPRIME_FAN_MMR_CEILING, step: 1, unit: '\u00B0C' }),
});

/** Every row this table can carry, machine-dependent rows included. */
export const LIMIT_KEYS = Object.freeze([
    'hotWaterTemp', 'hotWaterVolume', 'steamDuration', 'steamTemp', 'steamFlow',
    'dose', 'drinkWeight', 'grind', 'milkStopTemp', 'flushDuration', 'flushTemp',
    'flushFlow', 'fanThreshold', 'brewTemp', 'calibrationWeight',
    'heaterPh1Flow', 'heaterPh2Flow', 'heaterIdleTemp', 'heaterPh2Timeout',
    'tankTemp', 'appFlowMultiplier', 'hotWaterFlow', 'cupWarmerTarget',
    'flowCalibration', 'hotWaterDuration', 'waterAlertLevel', 'preWarmLead', 'sleepAfter',
    'screensaverCycle', 'hotWaterLookahead', 'screenBrightness',
]);

/** The machine-independent rows. Identical on every machine class. */
const BASE_LIMITS = Object.freeze({
    /** Hot water target temperature. 0 = off. */
    hotWaterTemp: Object.freeze({ min: 0, max: 99, step: 1, unit: '°C' }),
    /**
     * Hot water stop. 0 = NO CAP, which is a real setting, not "none".
     *
     * 255, and it cannot be 500. The DE1's shot-settings packet carries this in
     * ONE BYTE — ReaPrime packs it with `data[4] = targetHotWaterVolume` into a
     * Uint8List, which TRUNCATES rather than clamps. Measured on the bench: PUT
     * volume 400 to /api/v1/workflow and the machine came back holding 144
     * (400 - 256), which the rail then displayed. A ceiling of 500 here did not
     * give anyone 500 mL; it gave them a number that wrapped without a word.
     *
     * This is also the ceiling in WEIGHT mode. Stopping at weight is real —
     * ReaPrime's HotWaterSequencer arms on this same field and stops against the
     * scale — but the value still goes to the DE1's volume byte on the way past,
     * so the machine's own volume stop fires first at the wrapped number.
     * Lifting this needs ReaPrime to stop pushing the target into that byte; it
     * is not something a skin can do.
     */
    hotWaterVolume: Object.freeze({ min: 0, max: 255, step: 5, unit: 'mL', zeroMeans: 'no volume cap' }),
    /* Steam timed stop. THE ZERO MEANING IS RETIRED (26 Aug 2026): the steam page has a
     * master switch now, and Ben's ruling on the old sub-band rule was "the new toggle
     * does that job". A stop time of zero is a stop time of zero.
     *
     * AND THE BAND IS SLATE'S, 10 TO 120 IN FIVES (`settings.js:3474`, `step="5" min="10"
     * max="120"`) — the only STATED band there is, since no MMR declares one. It was 0-120
     * in ones here, and the floor was the problem: with a Steam stop bank that has an
     * explicit Off option, a duration of zero is a SECOND SPELLING of "no time stop". That
     * is precisely the duplicate meaning Ben stripped out of the flush row ("remove the
     * 0 = no flush") and out of the tank row on the same day, and Off owns zero now.
     *
     * ZERO IS STILL REACHABLE AND STILL DISPLAYS, which is what makes the floor safe: the
     * Off option STAGES a duration of zero directly (`settings-leaves.js` `machine-steam-stop`
     * `stages`), the display path does not clamp, and the Duration row is inert and dashed
     * in that mode anyway. What the floor stops is somebody stepping or typing their way to
     * a zero that means something the control does not say. */
    steamDuration: Object.freeze({ min: 10, max: 120, step: 5, unit: 's' }),
    /** Steam flow. No off value: zero flow is not a state the machine holds. */
    steamFlow: Object.freeze({ min: 0.4, max: 2.5, step: 0.1, unit: 'mL/s' }),
    /**
     * Dose in, and drink weight out. Neither had an entry in the old skin, so
     * three different answers were in the tree: the numpad's hint, the profile
     * editor's, and the rail's + button, which had no ceiling at all and would
     * climb for as long as a finger stayed on it.
     */
    dose: Object.freeze({ min: 1, max: 120, step: 1, unit: 'g' }),
    drinkWeight: Object.freeze({ min: 1, max: 1000, step: 1, unit: 'g' }),
    /**
     * THE GRINDER SETTING, which is a NUMBER ON A DIAL AND NOT A MACHINE READING.
     *
     * It is a user's note about a grinder the DE1 has never heard of, and it is here
     * for one reason: it is the value the rail's first row shows, so the row needs a
     * range or it renders unavailable for ever. This is the only row in the table whose
     * bounds no handler and no MMR declares, and the band is the old app's own — its
     * numpad's hint reads "Input value between 0-9999" (`numpad-modal.js:397`) and its
     * stepper floors at 0 (`ui.js:2262`).
     *
     * TWO STEPS, WHICH IS THE OLD APP'S RULE READ OUT (`ui.js:93,:2152`,
     * `grindStep = Number.isInteger(value) ? 1 : 0.1`): a dial set to 8 steps to 9, a
     * dial set to 8.5 steps to 8.6. One step would break one of the two, and grinders
     * are marked both ways.
     *
     * NO UNIT. A grind number has no dimension; the row shows the bare figure, which is
     * what the oracle shows (#grind-value carries no <small> unit, unlike every other
     * stepper on that rail).
     */
    grind: Object.freeze({ min: 0, max: 9999, step: 0.1, coarseStep: 1, unit: '' }),
    /** Milk-probe auto-stop target. 0 = disarmed, handled by the mode toggle. */
    milkStopTemp: Object.freeze({ min: 30, max: 85, step: 1, unit: '°C' }),
    /**
     * Flush duration. 0 = NO FLUSH — which every label already said and the old
     * declaration did not, so the numpad refused the value its own hint invited
     * and the rail painted NaN when someone typed it.
     */
    /* NO ZERO MEANING SINCE 26 AUGUST 2026. Ben: "remove the 0 = no flush. It's a button
     * the user needs to press, no point turning it off." The BAND still starts at zero,
     * because the machine's own field does; what is gone is the page teaching a second
     * job for the bottom of the band. */
    flushDuration: Object.freeze({ min: 0, max: 60, step: 1, unit: 's' }),
    /**
     * Flush temperature and flush flow, folded in from the settings page that was
     * the only place they were declared. ReaPrime's MMR rows (`flushTemp`
     * 0x00803844, `flushFlowRate` 0x00803840) declare no min/max of their own, so
     * the skin's declared band is the only one there is until R2 serves it.
     */
    flushTemp: Object.freeze({ min: 5, max: 95, step: 1, unit: '°C' }),
    /* 2-8 SINCE 26 August 2026. Ben, point 20: "flush range should be 2 to 8ml/s". The
     * floor was 1; below 2 the flush is too slow to clear the group. */
    flushFlow: Object.freeze({ min: 2, max: 8, step: 0.1, unit: 'mL/s' }),
    /* THE FAN THRESHOLD IS MACHINE-DEPENDENT AND MOVED OUT OF THIS BLOCK ON 27 AUGUST
     * 2026 — see `FAN_THRESHOLD_BY_MACHINE_CLASS` below `limitsFor`. It sat here as one
     * band for both classes (30-70) until Ben split it; the paragraph that argued for the
     * single band went with it rather than being deleted, because the argument was sound
     * and only its scope was wrong. */
    /**
     * Brew (group) target temperature, written into every profile step. The DE1's
     * practical band; it had three different ranges across two screens and no
     * entry at all in the old table, which is that table's founding defect.
     */
    brewTemp: Object.freeze({ min: 70, max: 110, step: 0.5, unit: '°C' }),
    /**
     * The known weight a load-cell calibration is latched against (D9, wave 5.4).
     *
     * THIS ONE IS NOT INFERRED — REAPRIME VALIDATES IT IN THE HANDLER, and this row is
     * that validation read out rather than a range anybody chose:
     *
     *   de1handler.dart:278-286 (PUT /api/v1/machine/scaleCalibration, pin 2b047d02)
     *     if (weight is! num || !weight.isFinite) 400 'weightGrams required for latch'   (:279)
     *     if (weightGrams < 1 || weightGrams > 10000) 400 'weightGrams must be 1..10000 grams'  (:283)
     *
     * THE LINE NUMBERS WERE WRONG AND THE QUOTE WAS RIGHT, which is the dangerous shape
     * (wave 5.4, cross-6). This row cited :290-301 — `withQueuedDe1` / `_bengleFirmwareGate`
     * / `startScaleCalibration`, i.e. the CALL, not the validation. A re-verifier following
     * the citation at the next pin finds a capability gate and no bounds, and concludes the
     * one limits table carries a row nobody sourced. Re-read at the pin before this edit:
     * the whole `if (command == latch)` guard is :276-288, the two `jsonBadRequest` returns
     * are inside it, and both quoted conditions are verbatim.
     *
     * `scale_calibration_capability.dart:4-5` declares the same pair as
     * `_minCalibrationWeightGrams` / `_maxCalibrationWeightGrams` and CLAMPS to it, with
     * `weightGrams ?? 200.0` as the default when a caller sends none.
     *
     * MACHINE-INDEPENDENT ON PURPOSE. The handler applies the same bounds whatever is
     * connected; what varies by machine is whether the FEATURE exists at all, and that is
     * the served `scaleCalibration` capability's answer (A3), never a range's. A row here
     * that appeared only on one class would be a capability gate wearing a limits row.
     *
     * `step: 1` is the resolution the wizard offers, not a firmware quantum: the MMR is
     * written through `writeMmrScaled`, which takes a double.
     */
    calibrationWeight: Object.freeze({ min: 1, max: 10000, step: 1, unit: 'g' }),
    /* -----------------------------------------------------------------------
     * THE HEATER-UP BAND. Four values on `POST /machine/settings/advanced`, and
     * the only four rows in this table whose bounds are SLATE'S rather than a
     * handler's or an MMR's — which is stated here because the difference
     * matters to whoever re-checks them.
     *
     * The MMR declarations carry no min/max at all: `heaterUp1Flow` (0x00803810),
     * `heaterUp2Flow` (0x00803814), `waterHeaterIdleTemp` (0x00803818) and
     * `heaterUp2Timeout` (0x00803838) declare only a scale, and
     * `POST /machine/settings/advanced` parses each with `parseDouble` and writes
     * it through — no clamp, no 400. So the firmware's real envelope is not
     * expressed anywhere a client can read, and an unbounded stepper on a HEATER
     * is the one place "unstated is unbounded" is the wrong answer.
     *
     * These are Slate's own numbers, read out of the input elements it renders
     * (`settings.js` `heaterPh1FlowInput` .. `heaterPh2TimeoutInput`, and the
     * matching entries in its numpad field table). They ship as this skin's
     * declared band exactly as `flushTemp` and `flushFlow` do — the row above
     * says it in the same words — and R2 replaces all six together the day a
     * limits endpoint serves them.
     * -------------------------------------------------------------------- */
    heaterPh1Flow: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'mL/s' }),
    heaterPh2Flow: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'mL/s' }),
    heaterIdleTemp: Object.freeze({ min: 0, max: 95, step: 1, unit: '\u00B0C' }),
    heaterPh2Timeout: Object.freeze({ min: 0, max: 60, step: 1, unit: 's' }),
    /**
     * THE TANK-WATER THRESHOLD, AND THIS ROW REVERSES A DELETION. Read the
     * paragraph below the table before changing it.
     *
     * `tankTemp` is one of the nine keys `GET`/`POST /machine/settings` carries
     * (`de1handler.dart`), so the value has always been readable and writable;
     * what stopped the control was the range. The band is the DE1's practical
     * one and matches the water-temperature rows either side of it.
     */
    /* NO ZERO MEANING SINCE 26 AUGUST 2026, for the same reason the flush row above lost
     * one: the page has a preheat switch now, and a switch is where "off" belongs. Ben:
     * "0-60 is good, remove the 0 = no tank heating." */
    tankTemp: Object.freeze({ min: 0, max: 60, step: 1, unit: '\u00B0C' }),
    /**
     * The APP-side flow multipliers, `weightFlowMultiplier` and
     * `volumeFlowMultiplier` on `POST /api/v1/settings`. ONE ROW FOR TWO FIELDS
     * on purpose: they are the same quantity applied to two channels, they have
     * the same band, and two identical rows would be two places to change it.
     *
     * `settings_handler.dart` validates only `value is num` — there is no server
     * range — and Slate's inputs declare `min: 0` and no maximum at all. The
     * ceiling here is this skin's statement that a lookahead of more than two
     * seconds is a typo rather than a setting.
     *
     * THE UNIT IS SECONDS AND IT USED TO BE THE EMPTY STRING, WHICH WAS WRONG AND
     * WAS THE MOST SERIOUS THING ON THE CALIBRATION PAGE. The paragraph here read
     * "NO UNIT: a ratio has no dimension" — a reasonable inference from the word
     * "multiplier", and refuted by the arithmetic at the pin. `shot_sequencer.dart`
     * computes `projectedWeight = currentWeight + (weightFlow * multiplier)`
     * (:432-433) and `projectedVolume = _accumulatedVolume + (machine.flow *
     * multiplier)` (:460-461). Flow is a per-second RATE in both, so a product that
     * comes out as a mass or a volume makes the multiplier a TIME. ReaPrime names
     * the identical construct `lookaheadSeconds` one file over
     * (`hot_water_stop.dart:112`), and Slate's own inputs carry an 's'
     * (`settings.js:1284-1298`, :4551-4576).
     *
     * So the number a user types is SECONDS OF LOOKAHEAD, and a stepper that
     * printed it bare left them no way to know that from the control.
     *
     * AND THE STEP FOLLOWS THE UNIT. 0.01 s was a hundredth of a second on a band
     * two seconds wide: two hundred presses end to end, on a touch panel, to cross
     * a range whose useful values are 0.3 and 1.0. Slate steps its own by 0.05
     * (`adjustVolumeFlowMultiplier(-0.05)`), which is forty presses and the
     * resolution the quantity actually has.
     */
    appFlowMultiplier: Object.freeze({ min: 0, max: 2, step: 0.05, unit: 's' }),

    /* HOT WATER FLOW. Ben, point 16: "Range should be 2 to 8ml/s". It had NO range at all
     * — B2's "unstated is unbounded" — so its stepper printed no hint and its ends never
     * greyed, which is what O8 is about. Same band as the flush, and for the same reason:
     * the pump is the same pump. */
    hotWaterFlow: Object.freeze({ min: 2, max: 8, step: 0.1, unit: 'mL/s' }),

    /* THE HOT-WATER STOP LOOKAHEAD — how far AHEAD of the target weight the pour is cut,
     * to allow for the water still in flight between the outlet and the cup.
     *
     * IT IS A LEAD TIME AND SLATE CALLS IT A MULTIPLIER, which is why the row that carries
     * it is headed "Stop lookahead" rather than Slate's "Flow multiplier": the value is in
     * SECONDS (`hot_water_sequencer.dart:117-118` reads it as `lookaheadSeconds`), and a
     * multiplier measured in seconds is a mislabel a reader has to un-learn. Slate's own
     * sub-label already says the true thing — "Lookahead for stop-at-weight".
     *
     * THE STEP IS SLATE'S (0.05, `settings.js:4551-4578`) AND THE BAND IS THIS SKIN'S. The
     * handler validates only `is num`, so there is no served range at all; 0 to 2 seconds is
     * the useful envelope — zero cuts at the target with no lead, and two seconds of water
     * in flight is more than this machine can put in a cup at any flow it offers. Written
     * here rather than at the row, exactly as the two sibling multipliers beside it. */
    hotWaterLookahead: Object.freeze({ min: 0, max: 2, step: 0.05, unit: 's' }),

    /* HOT WATER DURATION — the time cap on a pour, and SLATE'S OWN BAND rather than this
     * skin's: `settings.js:4487-4488` declares min 5, max 120, step 5 on the input and
     * `hotWaterDurationInput` repeats the same three numbers in the numpad table. No
     * handler and no MMR states a range, so the old app's is the only one there is.
     *
     * THE FLOOR IS 5, NOT 0, AND THAT IS THE POINT OF THE ROW. This is a limiter: it
     * stops the pour whatever the volume or the scale says. A zero here would be a pour
     * that ends before it starts, which is not a setting anybody wants and is why Slate
     * never offered it. */
    hotWaterDuration: Object.freeze({ min: 5, max: 120, step: 5, unit: 's' }),

    /* THE LOW-WATER ALERT HEIGHT, in millimetres above the bottom of the tank. Slate's
     * band, read off its own stepper (`settings.js:4661-4663`, min 0 max 30 step 5) and
     * off the caption beside it, which enumerates the same six values. Zero is a real
     * setting — no alert — and the caption says so rather than the range hint, because
     * "0 = no alert" beside a height reads as a height. */
    waterAlertLevel: Object.freeze({ min: 0, max: 30, step: 5, unit: 'mm' }),

    /* HOW LONG BEFORE A WAKE SCHEDULE THE CUP MAT STARTS. Ben's band and Ben's step
     * (26 Aug 2026): "5 minute steps from 5 to 60". The handler states no range —
     * `PUT /machine/cupWarmer/preheat` takes any `leadMinutes` — so this is the skin's
     * statement, and it is a useful one: a lead of nought is a pre-warm that does not,
     * and an hour is longer than any machine needs to warm a cup. */
    preWarmLead: Object.freeze({ min: 5, max: 60, step: 5, unit: 'min' }),

    /* HOW LONG WITHOUT USE BEFORE THE MACHINE SLEEPS. Ben's band and step (26 Aug 2026):
     * "5 minute steps, 5 to 300 minutes". It is the same band `presence-store.js` states
     * for its own writes — that copy is the STORE'S validation of what the handler will
     * take, and this is what the CONTROL offers. They agree because they were changed
     * together, and the store's is the one that refuses. */
    sleepAfter: Object.freeze({ min: 5, max: 300, step: 5, unit: 'min' }),

    /* HOW LONG EACH SCREEN-SAVER IMAGE STAYS UP. Ben's band (26 Aug 2026): "a stepper,
     * 1 to 10 minutes". Slate's own control counts SECONDS (2-600), which answers a
     * different question — two seconds is a slideshow, and this is a screen saver. */
    screensaverCycle: Object.freeze({ min: 1, max: 10, step: 1, unit: 'min' }),

    /* THE PANEL BRIGHTNESS, AND ITS FLOOR IS THE WHOLE POINT OF THE ROW.
     *
     * The Brightness slider ran 0..100 under a caption that read "The lowest setting stays
     * readable, so the screen never goes dark by accident." Dragging it to the left end did
     * exactly what the sentence says cannot happen — and on a kiosk tablet the control you
     * would need to undo it is now invisible, which is the reaprime#519 harm
     * `screensaver-policy.js` already names. A declared behaviour with nothing backing it is
     * this fork's own defect class; the sentence is the correct specification, so the
     * CONTROL is what had to change.
     *
     * TEN IS SLATE'S NUMBER AND SLATE IS EXPLICIT ABOUT IT: `BRIGHTNESS_FLOOR = 10`
     * (`settings.js:466`), the slider's min is that floor (`:2402`), `clampBrightness`
     * enforces it (`:489-491`), and its keypad band reads "10-100" (`:477`).
     *
     * THE FLOOR IS ON THE CONTROL, NOT ON THE COMMAND. `live.setBrightness` still accepts 0
     * and must: the screen saver's own dim sends `SCREENSAVER_BRIGHTNESS`, which is 0 by
     * decision and is what ARMS ReaPrime's restore. A floor pushed down into the sender
     * would break the sleep path to fix the slider. */
    screenBrightness: Object.freeze({ min: 10, max: 100, step: 1, unit: '%' }),

    /* THE MACHINE'S OWN FLOW CALIBRATION. The last stepper in the tree with no range, and
     * O8 says every stepper has one: "All steppers should have a range and when at the max
     * the + or - should be grayed out."
     *
     * 0.5 TO 2, STEP 0.01. A multiplier is a correction on a measurement the machine
     * already makes, so a band either side of 1 is what it can usefully be — below 0.5 or
     * above 2 the machine would be reporting a flow half or twice what it moves, which is
     * a fault to fix rather than a number to dial. Same step as the two app-side
     * multipliers beside it, so the three read as one family.
     *
     * NOT THE SERVER'S BAND, because the server states none: POST /machine/calibration
     * validates only that the value is a number. This is Decal's judgement, and it is
     * written here rather than in the row so the row stays data. */
    flowCalibration: Object.freeze({ min: 0.5, max: 2, step: 0.01, unit: '×' }),

    /* THE CUP-WARMING MAT. Ben, point 55: "Range should be 40-70c". Also unbounded before,
     * for the same declared reason — the handler answers a typed 400 and the refusal was
     * the server's to make. A refusal is not a range: a person setting a mat temperature
     * needs to know 70 is the top before they reach it, not after. */
    cupWarmerTarget: Object.freeze({ min: 40, max: 70, step: 1, unit: '°C' }),
});

/**
 * `tankTemp` WAS DELIBERATELY ABSENT AND IS NOW PRESENT. Ben, 24 August 2026.
 *
 * The deletion's reasoning was right about the machine and wrong about the
 * remedy, so both halves are kept here rather than replaced:
 *
 *   "The DE1's tank-water threshold (MMR 0x0080380C) is not the skin's to own:
 *   `unified_de1.profile.dart` ends every `_sendProfile` with a
 *   `_writeMMRInt(MMRItem.tankTemp, …)`, so every profile load — app start
 *   included — clobbers whatever a settings page set. Giving it a range would
 *   present a control that cannot hold its value."
 *
 * Every word of that is still true at the pin. What does not follow is hiding
 * the control: the machine's behaviour is not made better by the user being
 * unable to see or set the value, and Slate has shipped the same control on the
 * same machine throughout. A row that is overwritten by a profile load is a row
 * whose CAPTION says so — `machine-water-tank-temp` carries that sentence — and
 * the user then knows something the old empty leaf never told them.
 *
 * The upstream fix is unchanged and is still not a range: it is deciding who
 * owns the value. Until then this row is the machine's band and the caption is
 * the machine's behaviour.
 */

/**
 * The table for one machine class.
 *
 * TWO ROWS ARE MACHINE-DEPENDENT AND BOTH ARE ABSENT UNTIL THE CLASS IS KNOWN — the steam
 * ceiling since B3, and the fan threshold since 27 August 2026. Absence is the answer, not
 * a stand-in (A7): a row that appeared with the DE1's 0-50 while the capability read was
 * still in flight would let a Bengle owner's first press land on a band that is not theirs,
 * and one that appeared with the Bengle's 40-60 would do the same to a DE1 owner. The
 * consumers already handle it — `hasLimit` is asked before every use, a row with no limit
 * prints no hint and its stepper is unbounded — so the cost of waiting is a control that
 * has no printed band for one asynchronous read, and it gains one the moment the answer
 * lands (`settings-leaf-model.js` takes the table as a FUNCTION for exactly this reason).
 *
 * @param {'bengle'|'de1'|null} machineClass  the class, or null when it is not known
 * @returns {Readonly<object>} frozen rows; `steamTemp` and `fanThreshold` are PRESENT only
 *   when the class is known, because their bands are machine-dependent and there is no
 *   honest stand-in for either (A7 — never a fallback).
 */
export function limitsFor(machineClass) {
    if (machineClass === null || machineClass === undefined) return BASE_LIMITS;
    if (!MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(`machine-limits: unknown machine class "${machineClass}"`);
    }
    return Object.freeze({
        ...BASE_LIMITS,
        /**
         * The fan threshold, which is Ben's band on a Bengle and ReaPrime's on a DE1.
         *
         * SPREAD FROM THE MAP RATHER THAN REBUILT, unlike the steam row below it, and the
         * difference is that steam has a `floor` and a hole to assemble while this is a
         * plain band with nothing to compose. Read the long paragraph at
         * `FAN_THRESHOLD_BY_MACHINE_CLASS` before changing either number, and in particular
         * before trusting the Bengle's 60: ReaPrime clamps every write of this field to
         * `REAPRIME_FAN_MMR_CEILING` on every machine, so the top of that band does not
         * reach the machine yet.
         */
        fanThreshold: FAN_THRESHOLD_BY_MACHINE_CLASS[machineClass],
        /**
         * Steam temperature: the working band, with a hole at the bottom the switch owns.
         *
         * `min: 0` IS THE MECHANISM AND IT STAYS. The machine's way of saying "no steam" is
         * a target of zero, and `machine-steam-enabled` is a `zeroSwitch` row that writes
         * exactly that; `clamp` reads `floor` and keeps the hole working, so a 60 that
         * reaches it still becomes 0 and a 100 still becomes 135.
         *
         * WHAT THE PAD OFFERS IS NARROWER THAN WHAT THE WIRE ACCEPTS, since 29 August 2026
         * (audit F-021): `numpadRange` hands the pad `[floor, max]`, so a below-floor number
         * can no longer be TYPED into the hole and silently substituted. See `padBand`. The
         * clamp above is unchanged and is now purely a defence rather than a route.
         *
         * `zeroMeans` IS GONE, AND THAT IS THE WHOLE CHANGE (26 Aug 2026). Ben, on the old
         * sub-band rule: "no need to have <130 = off, the new toggle has that now." With it
         * present, `rangeHint` printed "0 or 135-170 °C" — the page teaching a second way to
         * switch the heater off, directly under a switch that does it. The flush and tank
         * rows had their `zeroMeans` deleted the same day for the same reason; this row kept
         * both and so kept the sentence.
         */
        steamTemp: Object.freeze({
            min: 0,
            max: STEAM_CEILING_BY_MACHINE_CLASS[machineClass],
            floor: STEAM_FLOOR,
            step: 1,
            unit: '°C',
            machineClass,
        }),
    });
}

/** True when this table carries a range for `key` — absence is a real answer. */
export function hasLimit(limits, key) {
    return !!limits && Object.hasOwn(limits, key);
}

function rangeOf(limits, key) {
    const range = hasLimit(limits, key) ? limits[key] : undefined;
    if (!range) throw new Error(`no limits declared for "${key}"`);
    return range;
}

/** Clamp to a range, respecting a hole at the bottom if the range has one. */
export function clamp(limits, key, value) {
    const range = rangeOf(limits, key);
    const n = Number(value);
    if (!Number.isFinite(n)) return range.min;
    if (n <= range.min) return range.min;
    if (n >= range.max) return range.max;
    // Inside the hole: snap to whichever end of it the value is nearer, so a
    // typed 60 on steam temp becomes 0 (off) and a typed 100 becomes the band's
    // floor — the coldest steam the machine will actually make. Silently
    // accepting the in-between number would leave the tile showing a
    // temperature the machine is not holding, which is the defect B3 names.
    if (range.floor !== undefined && n < range.floor) {
        return (n - range.min) < (range.floor - n) ? range.min : range.floor;
    }
    return n;
}

/**
 * One step up or down, skipping the hole rather than landing in it.
 *
 * Stepping down from the bottom of the working band goes to the off value, and
 * stepping up from off goes to the bottom of the band — so the whole range is
 * reachable with the same two buttons and nothing lands somewhere invalid.
 */
export function step(limits, key, value, direction) {
    const range = rangeOf(limits, key);
    const current = Number.isFinite(Number(value)) ? Number(value) : range.min;
    /* A COARSE STEP THE VALUE ITSELF SELECTS — see the `grind` row for why. A range
     * without one steps by `step` at every value, which is every other row here. */
    const size = range.coarseStep !== undefined && Number.isInteger(current)
        ? range.coarseStep : range.step;
    const delta = (direction >= 0 ? 1 : -1) * size;

    if (range.floor !== undefined) {
        if (current <= range.min && delta > 0) return range.floor;
        if (current <= range.floor && delta < 0) return range.min;
    }
    // Round to the step's own precision: 2.1 + 0.1 is 2.2000000000000002.
    const decimals = String(size).split('.')[1]?.length ?? 0;
    return clamp(limits, key, Number((current + delta).toFixed(decimals)));
}

/**
 * THE BAND AS A SENTENCE — ONE COMPOSER, over a range OBJECT rather than a table key.
 *
 * WHY IT TAKES AN OBJECT AND NOT `(limits, key)`. Three surfaces print this line and only
 * one of them is holding the table's own row when it does. The settings rows and the Live
 * rail both draw a CONVERTED band — `temperature.js`'s `displayRange` gives the same row
 * its Fahrenheit face — and the hot-water target draws the SAME row under two different
 * words, millilitres under a volume stop and grams under a weight stop. A composer keyed
 * by `(limits, key)` cannot say either of those things, so each caller was assembling the
 * sentence for itself out of `rangeHint`'s pieces: `settings-leaf-model.js` split the
 * Celsius sentence on the middle dot to salvage its tail, and `temperature.js`'s
 * `displayRangeHint` re-spelled the band shape by hand.
 *
 * AND THE HAND-SPELLED COPY HAD ALREADY DRIFTED, which is the whole argument for this
 * function existing. On 26 August 2026 Ben removed `zeroMeans` from the steam row — "no
 * need to have <130 = off, the new toggle has that now" — and `rangeHint` below stopped
 * printing the "0 or …" clause. `displayRangeHint` read `floor` directly instead of
 * asking, so it went on printing it: the SAME band read "135–170 °C" in Celsius and
 * "0 or 275–338 °F" in Fahrenheit, on the same row, the same day. Measured 27 August
 * 2026 on the settings fixture, Machine › Steam. One composer is the only arrangement in
 * which that cannot happen again.
 *
 * THE THREE SPELLINGS, and they are decisions rather than formatting:
 *
 *   a band with a HOLE and no stated meaning for zero   "135–170 °C"
 *   a band with a HOLE and a meaning                    "0 (nothing at all) or 4–10 x"
 *   a band whose ZERO means something                   "0–255 mL · 0 = no volume cap"
 *
 * @param {object|null} range   a range row — the table's own, or its converted face.
 *                              ALREADY IN THE UNIT BEING DRAWN; this function converts
 *                              nothing and knows no unit but the one it is handed.
 * @param {object} [options]
 * @param {function} [options.format]      how a number is printed. Default `String`.
 * @param {string} [options.unit]          the word after the numbers, when the caller
 *                                         restates it (the weight/volume case). Pass `''`
 *                                         to suppress it; omit to use the range's own.
 * @param {string} [options.zeroMeans]     what a zero means, when the caller restates it.
 *                                         Omit to use the range's own.
 */
export function bandHint(range, { format = (n) => String(n), unit, zeroMeans } = {}) {
    /* NO RANGE IS NO SENTENCE, not an empty band. A caller with nothing to describe gets
     * nothing to print, and A7 decides what it draws in that space instead. */
    if (!range) return '';
    // Temperatures print their unit through the units store, which follows the
    // °C/°F setting; appending ours as well would read "0-99 °C °C".
    const word = unit === undefined ? range.unit : unit;
    const suffix = word ? ` ${word}` : '';
    const means = zeroMeans === undefined ? range.zeroMeans : zeroMeans;
    if (range.floor !== undefined) {
        /* A HOLE WITH NO MEANING ATTACHED IS NOT WORTH A SENTENCE. The band still has one —
         * `clamp` and `numpadRange` read `floor` unchanged — but "0 or …" is the hint
         * TEACHING the user that zero is a setting, and on the one row that has a floor the
         * zero is now the master switch's job (Ben, 26 Aug 2026: "no need to have <130 = off,
         * the new toggle has that now"). So the hint describes the working band, and a row
         * that DOES want the zero explained says so with `zeroMeans` as before. */
        if (!means) return `${format(range.floor)}–${format(range.max)}${suffix}`;
        return `0 (${means}) or ${format(range.floor)}–${format(range.max)}${suffix}`;
    }
    if (means) {
        return `${format(range.min)}–${format(range.max)}${suffix} · 0 = ${means}`;
    }
    return `${format(range.min)}–${format(range.max)}${suffix}`;
}

/**
 * The range as a line of prose, for the hint printed beside a control's label.
 *
 * Reads from the same declaration as the clamp, so a label cannot go on claiming
 * the old range after the limit changes — which is exactly what three settings
 * pages were doing: the control accepted the new range while the text beside it
 * still described the old one.
 *
 * IT IS `bandHint` OVER THE TABLE'S OWN ROW and nothing more — the wording is decided
 * once, above, and this is the spelling of it that takes a key. `{ unit: false }` still
 * suppresses the word, which is how a caller that appends its own avoids "0-99 °C °C".
 */
export function rangeHint(limits, key, format = (n) => String(n), { unit: withUnit = true } = {}) {
    return bandHint(rangeOf(limits, key), { format, unit: withUnit ? undefined : '' });
}

/**
 * THE BAND A PAD MAY TYPE INSIDE — the WORKING band, with the hole removed rather than
 * spanned. (Audit F-021, 29 August 2026.)
 *
 * A holed row's `min` is the off value and its `floor` is the bottom of the band the
 * machine will actually hold. Handing the pad `[min, max]` makes every number in the hole
 * TYPEABLE, and `clamp` then substitutes one of the two ends for it — so on `steamTemp` a
 * typed 63 left as `targetTemperature: 0` and switched the steam heater OFF, four times
 * over, with the pad's own hint reading "0 or 135–170" and nothing on the glass saying a
 * substitution had happened (`_audit/FINDINGS.md` F-021; the server accepts and stores the
 * 0, confirmed on the tablet in Wave 4).
 *
 * SO THE HOLE IS NOT THE PAD'S TO OFFER. Zero is the master switch's job — Ben, 26 August
 * 2026: "no need to have <130 = off, the new toggle has that now" — and a pad whose band
 * starts at the floor cannot be typed into the hole at all. `clamp()`'s hole-snap and
 * `step()`'s step-into-off are UNCHANGED: the stepper still walks down through 135 to off
 * where a person can watch it happen, and the clamp is still the wire's last defence.
 *
 * `refuseOutside` IS THE FLAG AND IT IS ONLY EVER SET HERE. A pad clamps by default —
 * type 300 into a 0–255 volume and you get 255, a correction you can see in the result —
 * and that contract is kept everywhere, because narrowing it is a decision about every
 * control in the skin rather than about this one row (recorded for Ben, 29 August 2026).
 * What a HOLED band cannot do is correct: "the nearest legal value" to 63 °C is 0, and 0
 * is not a colder steam temperature, it is a different STATE. So this band, and only this
 * band, says that a number outside it is a refusal rather than a correction.
 *
 * @param {object|null} range  a range row — the table's own, or its converted face
 * @returns {object|null} the same row when it has no hole; otherwise the working band,
 *   with `floor` and `zeroMeans` spent and `refuseOutside` set.
 */
export function padBand(range) {
    if (!range || range.floor === undefined) return range;
    /* `zeroMeans` GOES WITH THE ZERO. A sentence explaining what zero does, printed over a
     * band that no longer accepts zero, is the drift this whole file exists to stop. */
    return {
        ...range,
        min: range.floor,
        floor: undefined,
        zeroMeans: undefined,
        refuseOutside: true,
    };
}

/**
 * The range as a numpad config, so the typed path cannot disagree either.
 *
 * ONE COMPOSER FOR THE LABEL, and it is `bandHint` over the band the pad actually accepts
 * (audit F-047). This function used to spell the sentence for itself — two hand-written
 * branches — which is how the pad came to print "0 or 135–170" beside a row printing
 * "135–170 °C" for the same field. A second author is a second thing to drift.
 */
export function numpadRange(limits, key) {
    const band = padBand(rangeOf(limits, key));
    return Object.freeze({
        min: band.min,
        max: band.max,
        step: band.step,
        label: bandHint(band),
        /* Only ever present on a band `padBand` narrowed — see it for why one row refuses
         * where every other one corrects. */
        ...(band.refuseOutside ? { refuseOutside: true } : null),
    });
}
