/**
 * A firmware image: its version, its size, and whether the machine will take it.
 */

import { MACHINE_CLASSES } from './machine-limits.js';

/** The 64-byte header both firmwares carry, and where the board word sits inside it. */
export const FIRMWARE_HEADER_BYTES = 64;
const BOARD_MARKER_OFFSET = 4;

export const BOARD_MARKERS = Object.freeze({
    de1: 0xDE100001,
    bengle: 0xBE100001,
});

export const BENGLE_COMPRESSED_MARKER_FLAG = 0x000C0000;

export const DE1_MODELS = Object.freeze(['DE1Pro', 'DE1XL', 'DE1XXL', 'DE1XXXL']);

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

export const FIRMWARE_MIN_BYTES = FIRMWARE_HEADER_BYTES;
export const FIRMWARE_MAX_BYTES = 32 * 1024 * 1024;

export function readBoardMarker(bytes) {
    const image = bytes instanceof Uint8Array
        ? bytes
        : (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null);
    if (image === null || image.byteLength < FIRMWARE_HEADER_BYTES) return null;
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

export function machineClassFromModel(model) {
    if (typeof model !== 'string') return null;
    const name = model.trim();
    if (UNKNOWN_MODELS.includes(name)) return null;
    if (name === 'Bengle') return 'bengle';
    if (DE1_MODELS.includes(name)) return 'de1';
    return null;
}

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
    if (machineClass === null) {
        return { ok: false, verdict: IMAGE_VERDICT.MACHINE_UNKNOWN, imageClass, machineClass: null };
    }
    if (imageClass !== machineClass) {
        return { ok: false, verdict: IMAGE_VERDICT.WRONG_MACHINE, imageClass, machineClass };
    }
    return { ok: true, verdict: IMAGE_VERDICT.OK, imageClass, machineClass };
}

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

for (const machineClass of MACHINE_CLASSES) {
    if (!Object.hasOwn(BOARD_MARKERS, machineClass)) {
        throw new Error(`firmware-image: no board marker declared for machine class "${machineClass}"`);
    }
}
