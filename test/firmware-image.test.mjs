/**
 * Reading the board marker out of a firmware image.
 *
 * The word sits at a fixed offset in the header and is little-endian. A marker with the
 * top bit set is still a positive board number, and a file too short to hold a header has
 * no marker at all rather than a marker of zero.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REA_ROOT } from '../scripts/lib/rea-source.js';
import { stripComments } from '../scripts/lib/source-scan.js';

import {
    readBoardMarker, imageMachineClass, machineClassFromModel, checkFirmwareImage,
    catalogCarriesNothingFor, IMAGE_VERDICT, BOARD_MARKERS, FIRMWARE_HEADER_BYTES,
    FIRMWARE_MAX_BYTES, MACHINE_CLASS_NAMES, DE1_MODELS,
} from '../src/lib/firmware-image.js';
import { MACHINE_CLASSES } from '../src/lib/machine-limits.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function image(marker, bytes = 200 * 1024) {
    const buffer = new Uint8Array(bytes);
    const view = new DataView(buffer.buffer);
    view.setUint32(4, marker, true);
    return buffer;
}

describe('the board word comes out of the header intact', () => {
    test('it is read little-endian at offset four', () => {
        const buffer = new Uint8Array(FIRMWARE_HEADER_BYTES);
        /* BYTES BY HAND: 0xBE100001 little-endian is 01 00 10 BE. */
        buffer.set([0x01, 0x00, 0x10, 0xBE], 4);
        assert.equal(readBoardMarker(buffer), 0xBE100001);
    });

    test('a marker with the top bit set stays POSITIVE', () => {
        assert.ok(readBoardMarker(image(BOARD_MARKERS.de1)) > 0);
        assert.ok(readBoardMarker(image(BOARD_MARKERS.bengle)) > 0);
        assert.equal(readBoardMarker(image(0xBE1C0001)), 0xBE1C0001);
    });

    test('a file too short to hold a header reads as no marker, never as zero', () => {
        assert.equal(readBoardMarker(new Uint8Array(FIRMWARE_HEADER_BYTES - 1)), null);
        assert.equal(readBoardMarker(null), null);
        assert.equal(readBoardMarker('not bytes'), null);
    });

    test('a byte array with a non-zero offset into its buffer is read from ITS start', () => {
        /* A `File.slice()` result arrives as a view, and a DataView built over the whole
         * underlying buffer would read four bytes from the wrong place. */
        const backing = new Uint8Array(FIRMWARE_HEADER_BYTES + 32);
        const view = backing.subarray(32);
        new DataView(view.buffer, view.byteOffset, view.byteLength).setUint32(4, BOARD_MARKERS.bengle, true);
        assert.equal(readBoardMarker(view), BOARD_MARKERS.bengle);
    });
});

describe('an image says which machine it is for', () => {
    test('the two markers are the two machines', () => {
        assert.equal(imageMachineClass(image(0xDE100001)), 'de1');
        assert.equal(imageMachineClass(image(0xBE100001)), 'bengle');
    });

    test('a COMPRESSED Bengle image is still a Bengle image', () => {
        assert.equal(imageMachineClass(image(0xBE1C0001)), 'bengle');
    });

    test('the DE1 side is NOT masked, because ReaPrime compares it exactly', () => {
        assert.equal(imageMachineClass(image(0xDE1C0001)), null);
    });

    test('anything else is unidentified rather than assumed', () => {
        assert.equal(imageMachineClass(image(0x00000000)), null);
        assert.equal(imageMachineClass(image(0xFFFFFFFF)), null);
        /* A JPEG's first bytes. A file of zeros is the commonest fixture mistake and the
         * commonest real mis-pick is a photograph; neither is firmware. */
        const jpeg = new Uint8Array(200 * 1024);
        jpeg.set([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46], 0);
        assert.equal(imageMachineClass(jpeg), null);
    });

    test('and the REAL bundled DE1 images classify as DE1', (t) => {
        const dir = join(REA_ROOT, 'assets', 'firmware', 'de1');
        if (!existsSync(dir)) {
            t.skip('REA_ROOT names no checkout — the synthetic-image half of the suite still ran');
            return;
        }
        const images = readdirSync(dir).filter((name) => name.endsWith('.bin'));
        assert.ok(images.length > 0, 'ReaPrime bundles firmware; if it stopped, this suite should say so');
        for (const name of images) {
            const bytes = new Uint8Array(readFileSync(join(dir, name)));
            assert.equal(imageMachineClass(bytes), 'de1', `${name} is a DE1 image`);
            assert.equal(checkFirmwareImage(bytes, 'Bengle').verdict, IMAGE_VERDICT.WRONG_MACHINE);
            assert.equal(checkFirmwareImage(bytes, 'DE1Pro').ok, true);
        }
    });
});

describe('the machine says which machine it is', () => {
    test('the five names ReaPrime can report', () => {
        /* `DecentMachineModel` is DE1Pro | DE1XL | DE1XXL | DE1XXXL | Bengle | Unknown,
         * and `machine.model` is `.name` off that enum. */
        assert.equal(machineClassFromModel('Bengle'), 'bengle');
        for (const name of ['DE1Pro', 'DE1XL', 'DE1XXL', 'DE1XXXL']) {
            assert.equal(machineClassFromModel(name), 'de1', name);
        }
    });

    test('ReaPrime’s two spellings of "I do not know" are both unknown', () => {
        /* `unified_de1.dart:144` seeds the info with the literal string "Unknown" before
         * the MMR read lands, and an absent machine gives no model at all. */
        assert.equal(machineClassFromModel('Unknown'), null);
        assert.equal(machineClassFromModel(''), null);
        assert.equal(machineClassFromModel(null), null);
        assert.equal(machineClassFromModel(undefined), null);
    });

    test('a name this build has never seen is unknown, NOT "probably a DE1"', () => {
        /* . A future model, or a rename upstream, must not be silently classed as the
         * machine whose images happen to be the ones ReaPrime bundles. */
        assert.equal(machineClassFromModel('DE2'), null);
        assert.equal(machineClassFromModel('bengle'), null, 'the enum name is capitalised; a case-insensitive match would be a guess');
    });
});

describe('the verdict on a picked file', () => {
    test('the right image for the right machine is the only OK', () => {
        assert.equal(checkFirmwareImage(image(BOARD_MARKERS.bengle), 'Bengle').ok, true);
        assert.equal(checkFirmwareImage(image(BOARD_MARKERS.de1), 'DE1XL').ok, true);
    });

    test('BOTH directions of the sentence are refused', () => {
        const onBengle = checkFirmwareImage(image(BOARD_MARKERS.de1), 'Bengle');
        assert.equal(onBengle.ok, false);
        assert.equal(onBengle.verdict, IMAGE_VERDICT.WRONG_MACHINE);
        assert.equal(onBengle.imageClass, 'de1');
        assert.equal(onBengle.machineClass, 'bengle');

        /* "OR THE OTHER WAY AROUND" — his words, and the case a Bengle-only test would
         * have missed entirely. */
        const onDe1 = checkFirmwareImage(image(BOARD_MARKERS.bengle), 'DE1Pro');
        assert.equal(onDe1.verdict, IMAGE_VERDICT.WRONG_MACHINE);
        assert.equal(onDe1.imageClass, 'bengle');
        assert.equal(onDe1.machineClass, 'de1');
    });

    test('an unidentifiable file is refused even when the machine is known', () => {
        const got = checkFirmwareImage(image(0x12345678), 'Bengle');
        assert.equal(got.verdict, IMAGE_VERDICT.UNRECOGNISED);
        assert.equal(got.imageClass, null);
    });

    test('a machine that has not answered refuses a PERFECTLY GOOD image', () => {
        const got = checkFirmwareImage(image(BOARD_MARKERS.bengle), 'Unknown');
        assert.equal(got.ok, false);
        assert.equal(got.verdict, IMAGE_VERDICT.MACHINE_UNKNOWN);
        assert.equal(got.imageClass, 'bengle', 'it still says what the image was');
    });

    test('the image is judged before the machine, so a photograph gets the useful sentence', () => {
        /* Someone who picked a holiday snap needs to hear "that is not firmware", whether
         * or not the machine happens to have answered yet. */
        assert.equal(checkFirmwareImage(image(0x12345678), null).verdict, IMAGE_VERDICT.UNRECOGNISED);
    });

    test('sizes outside any real image are refused before the header is trusted', () => {
        assert.equal(checkFirmwareImage(new Uint8Array(8), 'Bengle').verdict, IMAGE_VERDICT.TOO_SHORT);
        assert.equal(
            checkFirmwareImage(image(BOARD_MARKERS.bengle), 'Bengle', FIRMWARE_MAX_BYTES + 1).verdict,
            IMAGE_VERDICT.TOO_LARGE);
    });

    test('only the HEAD need be read, and the full length is passed separately', () => {
        /* The leaf slices 64 bytes rather than pulling 400 KB into memory to answer a
         * question four of them decide. The size argument is what keeps the bounds honest
         * when the array is only the head. */
        const head = image(BOARD_MARKERS.bengle, FIRMWARE_HEADER_BYTES);
        assert.equal(checkFirmwareImage(head, 'Bengle', 400 * 1024).ok, true);
        assert.equal(checkFirmwareImage(head, 'Bengle', 8).verdict, IMAGE_VERDICT.TOO_SHORT);
    });

    test('the extension is not consulted at all, and that is the fix', () => {
        assert.equal(checkFirmwareImage(image(BOARD_MARKERS.de1), 'DE1Pro').ok, true);
    });
});

describe('whether the catalog carries anything for this machine at all', () => {
    const de1Artifact = (id, build) => ({
        id, build, versionLabel: String(build),
        supportedModels: ['DE1Pro', 'DE1XL', 'DE1XXL', 'DE1XXXL'],
    });

    test('a Bengle with a DE1-only catalog is carrying NOTHING, not "up to date"', () => {
        assert.equal(catalogCarriesNothingFor({
            machine: { model: 'Bengle', build: 340 },
            artifacts: [de1Artifact('de1-1352', 1352), de1Artifact('de1-1358', 1358)],
            recommendedArtifactId: null,
            updateAvailable: false,
        }), true);
    });

    test('a DE1 with the same catalog is carrying plenty', () => {
        assert.equal(catalogCarriesNothingFor({
            machine: { model: 'DE1Pro', build: 1352 },
            artifacts: [de1Artifact('de1-1352', 1352), de1Artifact('de1-1358', 1358)],
        }), false);
    });

    test('no grounds means null, and null is not "nothing" (A7)', () => {
        const artifacts = [de1Artifact('de1-1352', 1352)];
        assert.equal(catalogCarriesNothingFor({ machine: { model: 'Unknown' }, artifacts }), null,
            'the machine did not say what it is');
        assert.equal(catalogCarriesNothingFor({ machine: null, artifacts }), null,
            'no machine at all');
        assert.equal(catalogCarriesNothingFor({ machine: { model: 'Bengle' }, artifacts: [] }), null,
            'an empty catalog proves nothing about what could be carried');
        assert.equal(catalogCarriesNothingFor({ machine: { model: 'Bengle' }, artifacts: [{ id: 'x', build: 1 }] }), null,
            'an artifact that does not declare supportedModels cannot be ruled out');
        assert.equal(catalogCarriesNothingFor(null), null);
    });

    test('ONE undeclared artifact is enough to withhold the claim', () => {
        /* A half-declared catalog cannot rule out that the undeclared one applies, and the
         * sentence this gates is an assertion about the whole catalog. */
        assert.equal(catalogCarriesNothingFor({
            machine: { model: 'Bengle' },
            artifacts: [de1Artifact('de1-1352', 1352), { id: 'mystery', build: 9 }],
        }), null);
    });
});

describe('every class this skin knows is fully described here', () => {
    test('each machine class has a board marker AND a name to call it', () => {
        for (const machineClass of MACHINE_CLASSES) {
            assert.ok(Object.hasOwn(BOARD_MARKERS, machineClass), `no board marker for ${machineClass}`);
            assert.ok(MACHINE_CLASS_NAMES[machineClass], `no prose name for ${machineClass}`);
        }
        assert.deepEqual(Object.keys(BOARD_MARKERS).sort(), [...MACHINE_CLASSES].sort(),
            'a marker for a class the skin does not have is dead weight');
    });

    test('the two markers really are different numbers', () => {
        /* ONE HEX DIGIT APART. A copy-paste that made them equal would produce a guard that
         * passes every image on every machine and looks entirely healthy. */
        assert.notEqual(BOARD_MARKERS.de1, BOARD_MARKERS.bengle);
    });

    test('every DE1 model name resolves to the de1 class', () => {
        for (const model of DE1_MODELS) assert.equal(machineClassFromModel(model), 'de1', model);
    });
});

describe('the numbers live in exactly one place (B2)', () => {
    test('no second copy of either board marker anywhere in src/', () => {
        const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) return walk(path);
            return entry.isFile() && path.endsWith('.js') ? [path] : [];
        });
        const owner = join(REPO_ROOT, 'src', 'lib', 'firmware-image.js');
        const offenders = [];
        for (const path of walk(join(REPO_ROOT, 'src'))) {
            if (path === owner) continue;
            const text = stripComments(readFileSync(path, 'utf8'));
            for (const spelling of [/0x[Dd][Ee]10 ?0001/, /0x[Bb][Ee]10 ?0001/, /3725590529/, /3188719617/]) {
                if (spelling.test(text)) offenders.push(`${path.slice(REPO_ROOT.length + 1)} matches ${spelling}`);
            }
        }
        assert.deepEqual(offenders, []);
    });
});
