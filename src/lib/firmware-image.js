/**
 * firmware-image.js — WHICH MACHINE AN IMAGE IS FOR, AND WHICH MACHINE THIS IS.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS — BEN, 27 AUGUST 2026
 * ===========================================================================
 *
 * "Just note the DE1 FW is different to Bengle and we will need to sort that out to
 * ensure we dont try and flash a DE1 FW onto Bengle or the other way around."
 *
 * He said that while ruling that ReaPrime's own firmware updater — not Slate's fetch to
 * api.github.com, and not Streamline's — is the model to follow. It is, and following it
 * properly is what produced this file: reading ReaPrime at the pin showed that ONE of its
 * two install paths carries the guard he is asking for and the OTHER carries nothing at
 * all, and the skin was using the unguarded one.
 *
 * ===========================================================================
 * THE TWO PATHS, READ AT THE PIN (2b047d02, `firmware_handler.dart`)
 * ===========================================================================
 *
 * MANAGED — `POST /api/v1/machine/firmware/apply {artifactId, force?}`. This one is
 * guarded, thoroughly, server-side, and the guard is Ben's exact concern:
 *
 *   - `_applyManaged` loads the artifact, runs `FirmwareValidator.validate` over the
 *     bytes (SHA-256, byte length, and a full header parse including the board marker),
 *     then calls `evaluateEligibility`, whose model test is one line:
 *     `artifact.supportedModels.contains(connectedModel)`.
 *   - A model that is not in the artifact's set answers 422 `model_incompatible`, AND
 *     `force: true` CANNOT override it: `modelInvalid` is checked before the force
 *     branch and short-circuits it (`firmware_handler.dart:189-206`).
 *   - Upstream pins this with a test whose fixture is literally Ben's scenario —
 *     `force cannot bypass bundled firmware model compatibility` builds a machine with
 *     `model: 'Bengle'`, applies artifact `de1-1352` with `force: true`, and asserts 422,
 *     `model_incompatible`, and `updateCalls == 0`
 *     (`test/webserver/firmware_handler_test.dart:184`).
 *
 * RAW — `POST /api/v1/machine/firmware`, a body of `application/octet-stream`. This one
 * is guarded by NOTHING. `_uploadRaw` (`firmware_handler.dart:107-121`) reads the body,
 * refuses it if it is EMPTY, resolves the machine, and hands the bytes straight to
 * `_streamFirmwareUpload`, which erases and writes. `FirmwareValidator` is never
 * constructed on this path — grep the whole tree and `validate` has exactly two callers,
 * `_applyManaged` and `BundledFirmwareCatalog.verifyAllArtifacts` (a startup self-check
 * over the bundled assets), neither of which is reachable from a raw upload. Upstream's
 * own test says so in its title: `raw upload rejects an empty body and a missing machine`
 * — and its body proves the scope, because a ONE-BYTE image (`_raw(handler, const [1])`)
 * comes back 200 and opens the progress stream
 * (`test/webserver/firmware_handler_test.dart:79-98`).
 *
 * THE SKIN'S FILE PICKER USES THE RAW PATH. It has to — the raw path is what a
 * hand-picked file is for, and the published spec names it "(developer/recovery)"
 * (`assets/api/rest_v1.yml`). So on that path there is no server-side guard to defer to,
 * and this module is the only thing between a stray tap and an erased machine.
 *
 * ===========================================================================
 * SO WHAT ACTUALLY IDENTIFIES AN IMAGE — AND IT IS ONE HEX DIGIT
 * ===========================================================================
 *
 * Both firmwares carry the SAME 64-byte header in the same order at the same offsets,
 * little-endian throughout, and the second word is the target board:
 *
 *      offset 0   U32 CheckSum
 *      offset 4   U32 BoardMarker      <-- the discriminator
 *      offset 8   U32 Version
 *      offset 12  U32 ByteCount
 *      offset 16  U32 CPUBytes
 *      offset 20  U32 BLEBytes         (ReaPrime calls this field `unused` and requires
 *                                       it to be ZERO on a DE1 image; on a Bengle image
 *                                       it is the BLE segment size and is never zero)
 *      offset 24  U32 DCSum
 *      offset 28  U8  IV[32]
 *      offset 60  U32 HSum
 *
 *   DE1     0xDE100001   `De1FirmwareHeader.de1BoardMarker`, and `isDe1Board` is an
 *                        exact equality against it
 *                        (`lib/src/services/firmware/de1_firmware_header.dart:5,47`).
 *   Bengle  0xBE100001   `#define BOARD_MARKER 0xBE100001` in the firmware's OWN parser,
 *                        which is the bootloader's authority
 *                        (`BengleMainCPUFirmware/src/Classes/Data/CFirmwareParser.hpp:13`),
 *                        repeated by the producer (`ImageScripts/pythonscripts/
 *                        makeFirmware.py:53`), the checker (`firmware_check.py:23`) and
 *                        `ImageScripts/src/showfwinfo.cpp:13`.
 *
 * D AND B. One nibble. That is the whole distance between the right image and an hour of
 * writing the wrong one, and it is exactly why this belongs in a named module with a test
 * rather than inline in a render method.
 *
 * THE COMPRESSED FLAG IS PART OF THE BENGLE MARKER, NOT A SECOND MARKER. MS24-compressed
 * Bengle images OR `0x000C0000` into BoardMarker ON PURPOSE, so that an OLD pre-MS24
 * bootloader sees a marker it does not recognise and REFUSES the image — staying resident
 * and recoverable — instead of flashing still-compressed bytes as raw firmware and
 * bricking itself. New bootloaders mask the flag off before comparing and normalise it
 * back on install. `makeFirmware.py:102-107` states the reasoning verbatim and
 * `firmware_check.py:170` is the masked comparison. So `0xBE1C0001` is a Bengle image and
 * this module masks the same bit before comparing, for the same reason.
 *
 * A DE1 IMAGE HAS NO SUCH FLAG. ReaPrime compares the marker exactly, so masking on the
 * DE1 side would ACCEPT an image ReaPrime's own validator rejects — the wrong kind of
 * mismatch to introduce. The two comparisons are deliberately different and each matches
 * the authority that owns it.
 *
 * ===========================================================================
 * AND WHAT IDENTIFIES THE MACHINE
 * ===========================================================================
 *
 * `GET /api/v1/machine/firmware` reports `machine.model` — `info.model` off the connected
 * device — and that string is `DecentMachineModel.fromInt(...).name`
 * (`unified_de1.dart:286`). The enum is `DE1Pro | DE1XL | DE1XXL | DE1XXXL | Bengle |
 * Unknown` and the Bengle arm is `isBengleModelValue(model)`, which is `value >= 128`
 * (`de1.models.dart:386,388-411`). Before the info read lands the model is the literal
 * string `"Unknown"` (`unified_de1.dart:144`).
 *
 * THIS MODULE USES THE MODEL STRING WHILE `machine-limits.js` USES THE CAPABILITY SET,
 * AND THAT DIVERGENCE IS DELIBERATE — do not "fix" them into agreement.
 * `machineClassFromServedSet` in `adapters-r.js` decides the STEAM CEILING, and for that
 * question ReaPrime's served capability list is the direct answer and a model string
 * would be a name-sniff (its own header says "never a model string", and it is right
 * about its own question). For THIS question the model string is not a proxy for the
 * answer — it IS the value ReaPrime's validator compares, character for character, in
 * `artifact.supportedModels.contains(connectedModel)`. Judging a firmware image by
 * anything else would mean the skin applying a different rule from the server it is
 * asking, which is how a UI comes to promise something the machine then refuses.
 *
 * THE VOCABULARY IS SHARED THOUGH. `MACHINE_CLASSES` is imported from `machine-limits.js`
 * rather than re-spelled here: 'bengle' and 'de1' are the skin's two names for this
 * distinction and a second list of them would be exactly the drift B2 forbids. What is
 * NOT shared is how a class is arrived at, because the two questions have two different
 * authorities.
 *
 * ===========================================================================
 * A7 — "I CANNOT TELL" IS AN ANSWER, AND HERE IT IS A REFUSAL
 * ===========================================================================
 *
 * `null` for a class means unread, never "probably fine". The caller must not treat it as
 * a match, and `checkFirmwareImage` does not: an unidentifiable image is refused and a
 * machine that has not said what it is is refused too.
 *
 * REFUSING ON AN UNKNOWN MACHINE IS ReaPrime'S OWN RULE, NOT THIS FILE BEING TIMID.
 * `machine_model_unknown` sits in the same `modelInvalid` set as `model_incompatible`, so
 * on the managed path even `force: true` will not flash an artifact to a machine whose
 * model did not read (`firmware_handler.dart:189-194`). Mirroring that exactly is the
 * point: the raw path gets the rule the managed path already has.
 *
 * Pure: no DOM, no fetch, no storage. It reads a byte array and two strings and returns a
 * verdict; the leaf decides what a verdict looks like on screen.
 */

import { MACHINE_CLASSES } from './machine-limits.js';

/** The 64-byte header both firmwares carry, and where the board word sits inside it. */
export const FIRMWARE_HEADER_BYTES = 64;
const BOARD_MARKER_OFFSET = 4;

/**
 * THE TWO BOARD MARKERS, DECLARED ONCE.
 *
 * There is no second copy of either number anywhere in `src/`, and
 * `test/firmware-image.test.mjs` scans for one — same rule as the limits table (B2), for
 * the same reason: a bound (or here, an identity) that is written twice is a bound that
 * will one day disagree with itself, and this is the one in the skin whose disagreement
 * costs a machine rather than a wrong tick mark.
 */
export const BOARD_MARKERS = Object.freeze({
    de1: 0xDE100001,
    bengle: 0xBE100001,
});

/**
 * The bit MS24-compressed BENGLE images OR into their marker so a pre-MS24 bootloader
 * refuses them rather than bricking on them. Masked off before the Bengle comparison and
 * NOT before the DE1 one — see the header.
 */
export const BENGLE_COMPRESSED_MARKER_FLAG = 0x000C0000;

/**
 * The four model strings ReaPrime's bundled manifest will accept as DE1.
 *
 * NOT INVENTED HERE. `FirmwareManifest._validate` hard-codes this exact set and throws a
 * FormatException on anything outside it (`firmware_manifest.dart:41`), which is also why
 * a Bengle artifact cannot be bundled — see `catalogCarriesNothingFor` below.
 */
export const DE1_MODELS = Object.freeze(['DE1Pro', 'DE1XL', 'DE1XXL', 'DE1XXXL']);

/**
 * WHAT TO CALL EACH CLASS IN A SENTENCE.
 *
 * IT LIVES HERE BECAUSE THE CLASS DOES. 'de1' and 'bengle' are internal tokens and neither
 * is a thing to show a person, so something has to map them to prose — and the settings
 * leaf is explicitly the wrong place for it. `test/settings-bespoke.test.mjs`'s A3 guard
 * refuses ANY machine-class literal in that file, on the grounds that "the class values
 * themselves belong in the registry and the nav, never here", and it is right: a leaf that
 * spells a class name is one edit away from a leaf that BRANCHES on one. The guard caught
 * this table on its first draft, in the leaf, which is the guard working.
 *
 * SO ALL CLASS KNOWLEDGE IS IN ONE MODULE — the markers, the model names, the vocabulary
 * tie to `MACHINE_CLASSES`, and now the prose. The leaf reads a name and never a class.
 *
 * THESE ARE i18n KEYS, NOT FINISHED TEXT. The caller passes them through `t()`, the same
 * as every other string it draws; this module stays DOM-free and language-free.
 */
export const MACHINE_CLASS_NAMES = Object.freeze({ de1: 'DE1', bengle: 'Bengle' });

/** ReaPrime's own two spellings of "the model did not read". Both mean unknown. */
const UNKNOWN_MODELS = Object.freeze(['', 'Unknown']);

/** Why an image was refused. One code per thing the person has to do differently. */
export const IMAGE_VERDICT = Object.freeze({
    OK: 'ok',
    /** Shorter than a header, so there is nothing to read. */
    TOO_SHORT: 'too-short',
    /** Longer than any firmware either machine takes. */
    TOO_LARGE: 'too-large',
    /** A header was read and its board word is neither machine's. */
    UNRECOGNISED: 'unrecognised',
    /** The image is for the other machine. The one this module exists for. */
    WRONG_MACHINE: 'wrong-machine',
    /** The machine has not said what it is, so nothing can be matched against it. */
    MACHINE_UNKNOWN: 'machine-unknown',
});

/**
 * WHAT A FIRMWARE IMAGE PLAUSIBLY WEIGHS — a sanity bound, and now only that.
 *
 * IT USED TO BE THE WHOLE CHECK, together with a `.bin` extension test, and both halves
 * were wrong in a way worth recording. The size test could not tell a DE1 image from a
 * Bengle one (they overlap: DE1 1352 is 463,872 B and a Bengle MainCPU image is around
 * 360-460 KB), and the EXTENSION test actively refused correct images — the DE1 firmware
 * Decent actually ships is `de1plus/fw/bootfwupdate.dat`, named in ReaPrime's own manifest
 * provenance string for both bundled artifacts. So a person handed the genuine article
 * would have been told it "does not look like a firmware image".
 *
 * The marker is the identity test now. These two numbers only stop a file that could not
 * be an image of either kind from being parsed as one, and the upper bound is generous on
 * purpose: the Bengle bootloader's own field wall is 960 KiB
 * (`firmware_check.py` MAX_IMAGE_SIZE), so 32 MB refuses nothing real.
 */
export const FIRMWARE_MIN_BYTES = FIRMWARE_HEADER_BYTES;
export const FIRMWARE_MAX_BYTES = 32 * 1024 * 1024;

/**
 * The board word out of an image's header, or null when there is no header to read.
 *
 * @param {Uint8Array|ArrayBuffer|null|undefined} bytes
 * @returns {number|null} the raw U32, flag bit included — classification is a separate step
 */
export function readBoardMarker(bytes) {
    const image = bytes instanceof Uint8Array
        ? bytes
        : (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null);
    if (image === null || image.byteLength < FIRMWARE_HEADER_BYTES) return null;
    /* LITTLE-ENDIAN, WHICH IS BOTH PRODUCERS' CHOICE and not a guess: ReaPrime reads it
     * with `view.getUint32(4, Endian.little)` and the Bengle tooling unpacks the first
     * seven words with the struct format "<7I". A big-endian read of 0xBE100001 is
     * 0x010010BE, which matches nothing, so getting this wrong would refuse every image
     * rather than accept a wrong one — but it would refuse them with the wrong sentence.
     *
     * `>>> 0` because a marker with the top bit set (both of them do — 0xDE and 0xBE are
     * each above 0x7F) comes out of a bitwise OR as a NEGATIVE 32-bit int in JS, and
     * -561184767 !== 3725590529 would fail every comparison silently. */
    const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
    return view.getUint32(BOARD_MARKER_OFFSET, true) >>> 0;
}

/**
 * Which machine an IMAGE is for, from its board word alone.
 *
 * @param {Uint8Array|ArrayBuffer|null|undefined} bytes
 * @returns {'bengle'|'de1'|null} null = no header, or a board word that is neither
 */
export function imageMachineClass(bytes) {
    const marker = readBoardMarker(bytes);
    if (marker === null) return null;
    /* THE DE1 COMPARISON IS EXACT AND THE BENGLE ONE IS MASKED. Not an inconsistency —
     * each matches the bootloader that owns it. See the module header. */
    if (marker === BOARD_MARKERS.de1) return 'de1';
    if (((marker & ~BENGLE_COMPRESSED_MARKER_FLAG) >>> 0) === BOARD_MARKERS.bengle) return 'bengle';
    return null;
}

/**
 * Which machine THIS is, from the model string the firmware catalog reports.
 *
 * @param {string|null|undefined} model  `catalog.machine.model`, verbatim
 * @returns {'bengle'|'de1'|null} null = not connected, or the model did not read
 */
export function machineClassFromModel(model) {
    if (typeof model !== 'string') return null;
    const name = model.trim();
    if (UNKNOWN_MODELS.includes(name)) return null;
    if (name === 'Bengle') return 'bengle';
    if (DE1_MODELS.includes(name)) return 'de1';
    /* A MODEL NOBODY HAS SEEN IS UNKNOWN, NOT "PROBABLY A DE1". `fromInt` maps every
     * unrecognised value below 128 to the literal `Unknown` already, so reaching this line
     * means ReaPrime learned a name this skin has not — a new machine, or a rename. A7:
     * the honest answer is that this build cannot tell, and the caller refuses. */
    return null;
}

/**
 * Is a hand-picked image safe to offer to this machine?
 *
 * ONE FUNCTION FOR THE WHOLE DECISION, so the leaf has no room to get the order wrong.
 * The order matters: an unreadable file is a different sentence from a DE1 image on a
 * Bengle, and a machine that has not answered is a third.
 *
 * @param {Uint8Array|ArrayBuffer|null|undefined} bytes  the picked file, or its head
 * @param {string|null|undefined} model  `catalog.machine.model`, verbatim
 * @param {number|null} [byteLength]  the file's FULL length when `bytes` is only its head
 * @returns {{ok: boolean, verdict: string, imageClass: ('bengle'|'de1'|null), machineClass: ('bengle'|'de1'|null)}}
 */
export function checkFirmwareImage(bytes, model, byteLength = null) {
    const image = bytes instanceof Uint8Array
        ? bytes
        : (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null);
    const size = Number.isFinite(byteLength) && byteLength !== null
        ? Number(byteLength)
        : (image === null ? 0 : image.byteLength);
    const machineClass = machineClassFromModel(model);

    if (image === null || size < FIRMWARE_MIN_BYTES) {
        return { ok: false, verdict: IMAGE_VERDICT.TOO_SHORT, imageClass: null, machineClass };
    }
    if (size > FIRMWARE_MAX_BYTES) {
        return { ok: false, verdict: IMAGE_VERDICT.TOO_LARGE, imageClass: null, machineClass };
    }

    const imageClass = imageMachineClass(image);
    if (imageClass === null) {
        return { ok: false, verdict: IMAGE_VERDICT.UNRECOGNISED, imageClass: null, machineClass };
    }
    /* THE IMAGE IS READ BEFORE THE MACHINE IS JUDGED, on purpose. "That is not a firmware
     * image" is true whether or not the machine has answered, and it is the more useful
     * of the two sentences, so a person who picked a photograph is told that rather than
     * being told to wait for a machine that would have refused it anyway. */
    if (machineClass === null) {
        return { ok: false, verdict: IMAGE_VERDICT.MACHINE_UNKNOWN, imageClass, machineClass: null };
    }
    if (imageClass !== machineClass) {
        return { ok: false, verdict: IMAGE_VERDICT.WRONG_MACHINE, imageClass, machineClass };
    }
    return { ok: true, verdict: IMAGE_VERDICT.OK, imageClass, machineClass };
}

/**
 * Does the served catalog carry NOTHING this machine could ever run?
 *
 * ===========================================================================
 * WHY THIS QUESTION HAD TO BE ASKED, AND WHY IT IS NOT THE SAME AS `updateAvailable`
 * ===========================================================================
 *
 * `updateAvailable === false` was being drawn as "This machine is on the newest image it
 * carries". On a DE1 that is true. On a BENGLE it is a fiction, and the fiction is
 * structural rather than accidental:
 *
 *   - `FirmwareManifest._validate` refuses to load a manifest containing any artifact
 *     whose `machineFamily` is not the literal 'de1', whose `imageFormat` is not 'de1',
 *     whose `supportedModels` is not a subset of the four DE1 names, or whose
 *     `expectedHeaderBoardMarker` is not 0xDE100001 (`firmware_manifest.dart:41-71`).
 *   - So the bundled catalog CANNOT contain a Bengle image. Not "does not today" —
 *     cannot, without an upstream change to that validator.
 *   - Which means on a Bengle every artifact evaluates `model_incompatible`, nothing is
 *     recommended, no eligibility is `unknown`, and `updateAvailable` computes FALSE
 *     (`firmware_handler.dart:78-80`).
 *
 * A person reading "on the newest image it carries" concludes their machine is current.
 * What is actually true is that this app ships no firmware for their machine at all. Same
 * boolean, opposite meanings, and the difference is legible in data the page already
 * holds — which makes drawing the wrong one a promise the code does not keep.
 *
 * IT ANSWERS `null` RATHER THAN GUESSING (A7). `supportedModels` is in the served
 * contract (`FirmwareCatalogEntry`, `assets/api/rest_v1.yml`) and in `artifact.toJson()`,
 * so a real ReaPrime always sends it. But a catalog whose artifacts do not carry it, or
 * a machine whose class did not read, gives this function no grounds — and a sentence
 * asserted without grounds is the thing this fork removes. Null means "say what the
 * server said"; the leaf holds that branch.
 *
 * @param {object|null|undefined} catalog  the served catalog, verbatim
 * @returns {boolean|null} true = nothing here applies to this machine, ever; null = cannot tell
 */
export function catalogCarriesNothingFor(catalog) {
    const model = catalog?.machine?.model ?? null;
    if (machineClassFromModel(model) === null) return null;
    const artifacts = Array.isArray(catalog?.artifacts) ? catalog.artifacts : [];
    if (artifacts.length === 0) return null;
    const declaring = artifacts.filter((a) => Array.isArray(a?.supportedModels));
    /* EVERY artifact must declare, not merely one: a catalog where half the entries carry
     * `supportedModels` and half do not cannot rule out that an undeclared one applies. */
    if (declaring.length !== artifacts.length) return null;
    return !declaring.some((a) => a.supportedModels.includes(model));
}

/* A COMPILE-TIME-ISH TIE BETWEEN THE TWO LISTS. `BOARD_MARKERS` and `MACHINE_CLASSES` have
 * to name the same two classes, and the failure if they drift is a class this module can
 * report and the limits table cannot price — so it is checked here, once, at import, in
 * the file that would be wrong. */
for (const machineClass of MACHINE_CLASSES) {
    if (!Object.hasOwn(BOARD_MARKERS, machineClass)) {
        throw new Error(`firmware-image: no board marker declared for machine class "${machineClass}"`);
    }
}
