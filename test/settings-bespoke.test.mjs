/**
 * settings-bespoke.test.mjs — wave 5.4's bespoke-and-writes cluster, asked the questions
 * a measurement cannot: `bespoke-leaves-nine`, `d7-led-live-preview`,
 * `d9-calibration-surfaces`, `q14-toggle-pill`, `f3-q1-reset-to-default-hole`.
 *
 * THE SPLIT WITH THE RENDER SUITE IS THE USUAL ONE. Everything here runs under `node
 * --test` with no browser: the colour maths, the write pattern's SHAPE, the store
 * behaviour against a scripted transport, the source-level absences (no timer on the LED
 * path) and the contract rows. The render suite measures boxes and drives components;
 * nothing there can prove an absence and nothing here can prove a width.
 *
 * THREE OF THE CLAIMS BELOW ARE ABSENCES and each one names its mechanism rather than its
 * symptom, because an absence asserted as a symptom passes for the wrong reason:
 *
 *   D7   no `setTimeout`, `setInterval`, debounce or throttle on the preview path
 *   Q14  no pill wrapper on the settings screen — #56 is retired outright (DQ-610) and
 *        #29 could never have named a switch inside one
 *   T21  no 885, no 1200 and no 760 anywhere in the cluster's sources
 *
 * THERE WAS A FOURTH AND IT WAS F3'S. It is gone, with the reason at §8: an absence test
 * that spells the control's name in its title and its patterns is itself a test naming
 * the control, which is what Part 10 §12 forbids. §8 is empty on purpose.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../scripts/lib/source-scan.js';

import {
    led8to16, ledRgbToColour16, ledColour16ToHex8, ledHex8ToRgb,
    ledHex8ToColour16, isColour16, isChannel16, canonicalColour16, COLOUR16_OFF, HEX8_BLACK,
} from '../src/lib/led-colour.js';
import {
    createLedStripStore, readLedStrip, LED_ZONES, LED_BANKS, LED_STATUS, LED_REFUSAL,
} from '../src/stores/led-strip-store.js';
import {
    createCalibrationStore, readCalibrationState, CAL_STATUS, CAL_STATUS_NONE,
    CAL_STEP, CAL_LOAD, CAL_COMMAND, isCalibrationInProgress, isCalibrationTerminal,
} from '../src/stores/calibration-store.js';
import { createSkinsStore, readSkins, readSkin, SKINS_STATUS } from '../src/stores/skins-store.js';
import { createAppInfoStore, readAppInfo, APP_INFO_STATUS } from '../src/stores/app-info-store.js';
import { shortDate, shortDateTime } from '../src/lib/short-date.js';
import { DYE2_PLUGIN, DYE2_PLUGIN_ID, DYE2_PAGE_ENDPOINT } from '../src/lib/plugin-pages.js';
import { createMachineFieldsPort, FIELD_DOORS, DOORS } from '../src/stores/machine-fields-port.js';
import { BESPOKE_LEAVES, leafKind, LEAF_KIND, SETTINGS_ROWS, ARCHETYPE } from '../src/lib/settings-leaves.js';
import { allLeaves } from '../src/lib/settings-nav.js';
import { limitsFor, hasLimit } from '../src/lib/machine-limits.js';
import { reaSuccess, reaFailure } from '../src/data/rea-errors.js';

const CONTRACTS = JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/data/CONTRACTS.json', import.meta.url)), 'utf8'));

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** Every file this cluster added or owns. The absence claims sweep all of them. */
const CLUSTER_FILES = Object.freeze([
    'src/lib/led-colour.js',
    'src/stores/led-strip-store.js',
    'src/stores/calibration-store.js',
    'src/stores/skins-store.js',
    'src/stores/app-info-store.js',
    'src/stores/machine-fields-port.js',
    'src/screens/settings-bespoke-leaf.js',
]);

const SOURCE = Object.fromEntries(CLUSTER_FILES.map((path) => [path, read(path)]));
const CODE = Object.fromEntries(CLUSTER_FILES.map((path) => [path, stripComments(SOURCE[path])]));

/** A transport whose answers are a script. `callRoute` builds the path; this reads it. */
function transportOf(script) {
    const calls = [];
    return {
        calls,
        socketUrl: () => 'ws://test',
        async request(path, { method = 'GET', body } = {}) {
            calls.push({ path, method, body });
            return script({ path, method, body, key: `${method} ${path}` });
        },
    };
}

const ok = (data, status = 200) => reaSuccess({ status, data, method: 'GET', url: 'test' });
const bad = (status, problem = null) => reaFailure('http', {
    status, message: `test ${status}`, problem, method: 'GET', url: 'test',
});

const LED_BODY = Object.freeze({
    frontStrip: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
    backStrip: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
    frontSwitch: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
});

/* ===========================================================================
 * 1. THE FOUR CONVERTERS — Part 6's `led-color.js` row, and the three that did not come
 * =========================================================================== */

describe('led-colour: the four converters, and only the four', () => {
    /* THIS TEST WAS HEADED "8 -> 16 is byte replication, which is what the served fixture
     * shows" AND IT ASSERTED THE WRONG CONVENTION (audit F-044, 29 August 2026). Verbatim:
     *
     *     assert.equal(led8to16(0x4a), '4A4A');
     *     assert.equal(led8to16(0xff), 'FFFF');
     *     assert.equal(ledRgbToColour16({ r: 0xff, g: 0xc1, b: 0x80 }), 'FFFFC1C18080');
     *     assert.equal(ledRgbToColour16({ r: 0x4a, g: 0x2b, b: 0x00 }), '4A4A2B2B0000');
     *
     * The recorded fixture it cites really does carry replicated channels, so the reasoning
     * was sound and the evidence was a recording rather than a machine. On Ben's running
     * tablet every colour the device holds is SHIFTED (`FF00D900A000`, `FF00D3008E00`), and
     * the replicated `FFFF22220000` the skin sent came back stored as `FF0022000000`. The
     * machine is the truth teller (O2), so the convention follows it and this test follows
     * the convention. */
    test('8 -> 16 shifts into the high byte, which is what the MACHINE holds', () => {
        assert.equal(led8to16(0x4a), '4A00');
        assert.equal(led8to16(0xff), 'FF00');
        assert.equal(led8to16(0), '0000');
        /* THE DEVICE READ IS THE PROOF, and it is a whole colour rather than a channel:
         * this is the exact document `_audit/e2e-2026-08-29/settings-B-e2e.md` §3.5 found
         * on the machine before anything was written to it. */
        assert.equal(ledRgbToColour16({ r: 0xff, g: 0xd9, b: 0xa0 }), 'FF00D900A000');
        assert.equal(ledRgbToColour16({ r: 0xff, g: 0x22, b: 0x00 }), 'FF0022000000');
    });

    test('16 -> 8 takes the HIGH byte, and 8 -> 16 -> 8 is lossless', () => {
        /* THE LOW BYTE IS IGNORED, so a colour in the OTHER spelling still reads correctly
         * — which is what makes the encoding change safe for a machine (or a fixture)
         * holding replicated values. */
        assert.equal(ledColour16ToHex8('FFFFC1C18080'), '#ffc180');
        assert.equal(ledColour16ToHex8('FF00C1008000'), '#ffc180');
        for (const hex of ['#000000', '#ffffff', '#ffaa55', '#7a3ff2', '#0ca581']) {
            assert.equal(ledColour16ToHex8(ledHex8ToColour16(hex)), hex, `round trip ${hex}`);
        }
    });

    /* AND THIS TEST'S CLAIM SURVIVED THE CHANGE WITH ITS EXAMPLE INVERTED (F-044). It read
     *
     *     assert.equal(ledColour16ToHex8('AB000000FFFF'), '#ab00ff');
     *     assert.notEqual(ledHex8ToColour16('#ab00ff'), 'AB000000FFFF');
     *
     * — where `AB00`/`FFFF` was an example of a colour the encoder would NOT reproduce.
     * `AB00` is now exactly what the encoder produces, so the example that makes the point
     * has to be a colour with a non-zero LOW byte instead. The claim — a read value is
     * never assumed to survive a re-encode, and the store never re-encodes one — is the
     * same, and the ADDITION below is what F-044 bought: for a colour in the server's own
     * form, the round trip now IS the identity. */
    test('16 -> 8 -> 16 is the identity for a CANONICAL colour and nothing else', () => {
        /* THE F-044 PROPERTY. Every colour the device serves is in this form, so a
         * document sent and a document read back are now comparable byte for byte. */
        for (const wire of ['FF00D900A000', 'FF00D3008E00', 'FF0022000000', '000000000000']) {
            assert.equal(ledHex8ToColour16(ledColour16ToHex8(wire)), wire, `canonical ${wire}`);
            assert.equal(canonicalColour16(wire), wire);
        }
        /* AND NOT FOR ANY OTHER SPELLING: a low byte is unreachable from an 8-bit picker.
         * `canonicalColour16` is what makes the two comparable — it does not pretend the
         * low byte survived. */
        assert.equal(ledColour16ToHex8('ABCD0000FFFF'), '#ab00ff');
        assert.notEqual(ledHex8ToColour16('#ab00ff'), 'ABCD0000FFFF');
        assert.equal(canonicalColour16('ABCD0000FFFF'), 'AB000000FF00');
        assert.equal(canonicalColour16('FFFF22220000'), 'FF0022000000',
            'the exact pair the tablet measured: sent replicated, stored shifted');
        assert.doesNotMatch(CODE['src/stores/led-strip-store.js'], /ledColour16ToHex8\([^)]*\)\s*\)/,
            'a read colour is never fed back through the encoder');
    });

    test('anything malformed is BLACK, which is the server’s own answer', () => {
        // Color16.fromJson: `if (hex is! String || hex.length < 12) return off;`
        for (const junk of ['', 'nope', 'FFFFC1C1808', null, undefined, 42, {}]) {
            assert.equal(ledColour16ToHex8(junk), HEX8_BLACK, `${String(junk)} reads black`);
        }
        assert.deepEqual(ledHex8ToRgb('not a colour'), { r: 0, g: 0, b: 0 });
        assert.equal(ledHex8ToColour16('not a colour'), COLOUR16_OFF);
    });

    test('the hash is optional on the way in and always present on the way out', () => {
        assert.deepEqual(ledHex8ToRgb('ffaa55'), ledHex8ToRgb('#FFAA55'));
        assert.match(ledColour16ToHex8('FFFFAAAA5555'), /^#[0-9a-f]{6}$/);
    });

    test('the three that were NOT ported have no spelling anywhere in the cluster', () => {
        for (const [path, code] of Object.entries(CODE)) {
            assert.doesNotMatch(code, /ledPreviewComposite/, `${path} ports the composite`);
            assert.doesNotMatch(code, /previewLedStrip/, `${path} calls a route that does not exist`);
            assert.doesNotMatch(code, /ledStrip\/preview/, `${path} spells a route that does not exist`);
        }
    });

    test('the validity helpers agree with the wire format', () => {
        assert.equal(isColour16('FFFFC1C18080'), true);
        assert.equal(isColour16('FFFFC1C1808'), false);
        assert.equal(isChannel16('FFFF'), true);
        assert.equal(isChannel16('FFFFF'), false);
    });
});

/* ===========================================================================
 * 2. D7 — THE WRITE PATTERN. No timer, one write in flight, latest-wins.
 * =========================================================================== */

describe('D7: pendingColour, one write in flight, latest-wins — and no clock', () => {
    /** A store over a transport whose PUTs park until they are released. */
    function slowStore() {
        const parked = [];
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') {
                return new Promise((resolve) => parked.push(() => resolve(ok({ status: 'accepted' }, 200))));
            }
            if (key === 'POST /machine/ledStrip/commit') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            if (key === 'POST /machine/ledStrip/reset') return ok({ ...LED_BODY });
            return bad(503);
        });
        return { store: createLedStripStore({ transport }), transport, parked };
    }

    test('N rapid changes put exactly ONE write on the wire at a time', async () => {
        const { store, transport, parked } = slowStore();
        await store.load();

        const hexes = ['#ffaa55', '#ffd9a0', '#eaf2ff', '#ff7a00', '#ff2200', '#0ca581', '#00c2d1'];
        const drain = hexes.map((hex) => store.preview('frontStrip', 'awake', hex));

        /* Seven intents, and the wire has one. Nothing is queued: the six that arrived
         * while the first was in flight overwrote each other in `pendingColour`. */
        assert.equal(parked.length, 1, 'one PUT on the wire');
        assert.equal(store.counters().intents, 7);
        assert.equal(store.counters().sent, 1);

        parked.shift()();                      // the first write answers
        await new Promise((r) => setTimeout(r, 0));
        assert.equal(parked.length, 1, 'the NEXT write goes out, not six of them');

        parked.shift()();
        await Promise.all(drain);
        await store.settled();

        const puts = transport.calls.filter((c) => c.method === 'PUT');
        assert.equal(puts.length, 2, 'seven intents, two writes');
        assert.equal(store.counters().peakInFlight, 1, 'never two writes at once');
        assert.equal(store.counters().dropped, 5);
    });

    test('the LAST colour wins — the machine ends on it, not on an intermediate', async () => {
        const { store, transport, parked } = slowStore();
        await store.load();

        const drain = ['#ff2200', '#0ca581', '#00c2d1', '#7a3ff2']
            .map((hex) => store.preview('backStrip', 'awake', hex));
        while (parked.length) {
            parked.shift()();
            await new Promise((r) => setTimeout(r, 0));
        }
        await Promise.all(drain);
        await store.settled();

        const last = transport.calls.filter((c) => c.method === 'PUT').pop();
        assert.equal(last.body.backStrip.awake, ledHex8ToColour16('#7a3ff2'),
            'the machine is left wearing the colour the user stopped on');
        assert.equal(store.hex('backStrip', 'awake'), '#7a3ff2');
        /* AND THE UNTOUCHED ZONES ARE UNTOUCHED. PUT takes the whole state, so a preview
         * that dropped a zone would blank it. */
        assert.equal(last.body.frontStrip.awake, LED_BODY.frontStrip.awake);
        assert.equal(last.body.backStrip.sleeping, LED_BODY.backStrip.sleeping);
    });

    test('THE PATH CONTAINS NO TIMER — asserted against the source, all four spellings', () => {
        for (const path of ['src/stores/led-strip-store.js', 'src/lib/led-colour.js']) {
            const code = CODE[path];
            for (const spelling of [/setTimeout/, /setInterval/, /requestAnimationFrame/,
                /\bdebounce\b/i, /\bthrottle\b/i, /queueMicrotask/]) {
                assert.doesNotMatch(code, spelling, `${path} contains ${spelling}`);
            }
        }
        /* The screen half too: a debounce at the call site would be the same defect one
         * storey up, and it is the storey the old skin put it on. */
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        assert.doesNotMatch(leaf, /setTimeout|setInterval|\bdebounce\b|\bthrottle\b/i,
            'the leaf that presses the swatch must not schedule the write either');
    });

    test('a preview with no strip state is REFUSED, not guessed at', async () => {
        const transport = transportOf(() => bad(503, { error: 'hydration' }));
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(store.get().status, LED_STATUS.UNAVAILABLE);
        assert.equal(await store.preview('frontStrip', 'awake', '#ffaa55'), false);
        assert.equal(store.get().refusal, LED_REFUSAL.NO_STATE);
        assert.equal(transport.calls.filter((c) => c.method === 'PUT').length, 0);
    });

    test('a zone or bank the machine does not have is refused before the wire', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /machine/ledStrip'
            ? ok({ ...LED_BODY }) : bad(500)));
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(await store.preview('sideStrip', 'awake', '#ffaa55'), false);
        assert.equal(await store.preview('frontStrip', 'dozing', '#ffaa55'), false);
        assert.equal(store.get().refusal, LED_REFUSAL.BAD_TARGET);
        assert.equal(transport.calls.filter((c) => c.method === 'PUT').length, 0);
    });

    test('404 is the feature gate; 503 on the read is transient and stays transient', async () => {
        const gate = createLedStripStore({ transport: transportOf(() => bad(404)) });
        await gate.load();
        assert.equal(gate.get().status, LED_STATUS.UNSUPPORTED);

        const hydrating = createLedStripStore({ transport: transportOf(() => bad(503)) });
        await hydrating.load();
        assert.equal(hydrating.get().status, LED_STATUS.UNAVAILABLE,
            'a 503 must not read as "this machine has no LED strip"');
    });

    test('commit survives the 202 with a null body, and reset takes the returned state', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'POST /machine/ledStrip/commit') {
                /* jsonAccepted() with no data: 202, EMPTY body, application/json. */
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            if (key === 'POST /machine/ledStrip/reset') return ok({ ...LED_BODY });
            return bad(500);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(await store.commit(), true, 'a null body on a 2xx is success, not a decode failure');
        assert.equal(await store.reset(), true);
        assert.equal(store.get().status, LED_STATUS.READY);
        /* The reset reply IS the new state — no second GET. */
        assert.equal(transport.calls.filter((c) => c.path.endsWith('/ledStrip') && c.method === 'GET').length, 1);
    });

    test('readLedStrip fills every zone and bank, and black is the server’s own default', () => {
        const strip = readLedStrip({ frontStrip: { awake: 'FFFFC1C18080' } });
        for (const zone of LED_ZONES) {
            for (const bank of LED_BANKS) assert.equal(typeof strip[zone][bank], 'string');
        }
        assert.equal(strip.frontStrip.sleeping, COLOUR16_OFF);
        assert.equal(strip.backStrip.awake, COLOUR16_OFF);
        assert.equal(readLedStrip(null), null);
        assert.equal(readLedStrip([]), null);
    });
});

/* ===========================================================================
 * 3. D9 — THE CALIBRATION SURFACES
 * =========================================================================== */

describe('D9: the load-cell wizard is a thin client over the machine’s own state', () => {
    function calStore(script) {
        const transport = transportOf(script);
        return { store: createCalibrationStore({ transport, setTimer: () => null, clearTimer: () => {} }), transport };
    }

    const IDLE = { step: 'idle', detectedCell: 'none', subState: 'settling', secondsRemaining: 0, status: 'none' };

    test('CB-15 is dead: the commands are the machine’s three and the body key is its own', async () => {
        const { store, transport } = calStore(({ key, body }) => {
            if (key === 'GET /machine/scaleCalibration') return ok({ ...IDLE });
            if (key === 'PUT /machine/scaleCalibration') {
                return reaSuccess({
                    status: 202,
                    data: { status: 'accepted', state: { ...IDLE, step: body.command === 'zero' ? 'zeroing' : 'calLatch', secondsRemaining: 15 } },
                    method: 'PUT', url: 'test',
                });
            }
            return bad(503);
        });
        await store.read();
        await store.zero();
        await store.latch(250);

        const puts = transport.calls.filter((c) => c.method === 'PUT');
        assert.equal(puts.length, 2);
        assert.deepEqual(puts.map((c) => c.path), [
            '/machine/scaleCalibration', '/machine/scaleCalibration',
        ], 'the path is the machine’s, not /machine/scale/calibrate');
        assert.deepEqual(puts[0].body, { command: 'zero' }, 'no weight rides with a zero');
        assert.deepEqual(puts[1].body, { command: 'latch', weightGrams: 250 },
            'weightGrams, not grams; latch, not left/right');
        for (const call of puts) {
            assert.ok(['abort', 'zero', 'latch'].includes(call.body.command));
        }
    });

    test('the wizard is driven by the state in EVERY reply, the 409 included', async () => {
        const busy = { ...IDLE, step: 'calLatch', secondsRemaining: 9, subState: 'averaging' };
        const { store } = calStore(({ key }) => {
            if (key === 'GET /machine/scaleCalibration') return ok({ ...IDLE });
            return bad(409, { status: 'rejected', reason: 'machine busy or shot in progress', state: busy });
        });
        await store.read();
        const result = await store.zero();

        assert.equal(result.ok, false);
        assert.equal(result.reason, 'machine busy or shot in progress');
        assert.deepEqual(store.state(), Object.freeze(busy),
            'a refusal still describes the machine, and the wizard moves with it');
    });

    test('all BESPOKE_IDS diagnostic statuses cross this layer, plus the never-run sentinel', () => {
        assert.equal(CAL_STATUS.length, 9);
        assert.deepEqual([...CAL_STATUS], [
            'ok', 'incomplete', 'noZero', 'notSettled', 'badWeight',
            'badDelta', 'illConditioned', 'outOfRange', 'notIsolated',
        ]);
        assert.equal(CAL_STATUS_NONE, 'none');
        assert.ok(!CAL_STATUS.includes(CAL_STATUS_NONE), '0xFF is not a tenth diagnosis');

        /* AND THE LEAF HAS A SENTENCE FOR EACH — the whole point of the rebuild, since the
         * old skin showed a generic HTTP error where the machine had said badDelta. */
        const leaf = SOURCE['src/screens/settings-bespoke-leaf.js'];
        for (const status of CAL_STATUS) {
            assert.match(leaf, new RegExp(`\\b${status}:`), `no sentence for ${status}`);
        }
        assert.match(leaf, /badDelta: '[^']+'/, 'badDelta is named, not swallowed');
    });

    test('secondsRemaining is carried, and the poll is armed ONLY while the machine works', async () => {
        let armed = 0;
        let cleared = 0;
        const transport = transportOf(({ key }) => (key === 'GET /machine/scaleCalibration'
            ? ok({ ...IDLE, step: 'zeroing', secondsRemaining: 12 })
            : bad(503)));
        const store = createCalibrationStore({
            transport,
            setTimer: () => { armed += 1; return armed; },
            clearTimer: () => { cleared += 1; },
        });
        await store.read();
        assert.equal(store.state().secondsRemaining, 12);
        assert.equal(store.busy, true);
        assert.ok(armed >= 1, 'the countdown polls while the machine is zeroing');

        store.forget();
        assert.ok(cleared >= 1, 'and stops the moment there is nothing to count');
    });

    test('a terminal step disarms the poll — nothing ticks after the walk ends', async () => {
        let armed = 0;
        const transport = transportOf(() => ok({ ...IDLE, step: 'complete', status: 'ok', detectedCell: 'a' }));
        const store = createCalibrationStore({ transport, setTimer: () => { armed += 1; return 1; }, clearTimer: () => {} });
        await store.read();
        assert.equal(armed, 0, 'a finished calibration does not start a clock');
        assert.equal(isCalibrationInProgress(store.state()), false);
        assert.equal(isCalibrationTerminal(store.state()), true);
    });

    test('404 is the feature gate and the wizard is hidden', async () => {
        const { store } = calStore(() => bad(404));
        await store.read();
        assert.equal(store.get().load, CAL_LOAD.UNSUPPORTED);
        assert.equal(store.state(), null);
    });

    test('a body missing a field is NOT a state, and defaults are not invented', () => {
        assert.equal(readCalibrationState({ step: 'idle' }), null);
        assert.equal(readCalibrationState({ ...IDLE, secondsRemaining: 'soon' }), null);
        assert.equal(readCalibrationState(null), null);
        assert.deepEqual(readCalibrationState(IDLE), Object.freeze(IDLE));
    });

    test('the three commands are the only three, and they are named once', () => {
        assert.deepEqual(Object.values(CAL_COMMAND), ['abort', 'zero', 'latch']);
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        for (const gone of ['left', 'right', 'calibrateScale', 'buildCalibrateBody']) {
            assert.doesNotMatch(leaf, new RegExp(`command:\\s*'${gone}'`), `${gone} is CB-15's vocabulary`);
        }
        /* AND THE BUTTON TABLE CANNOT OFFER A FOURTH. Read off the leaf's own source
         * rather than off the constant, so a command written straight into the table
         * would be caught even though it never reached CAL_COMMAND. */
        const wired = [...leaf.matchAll(/command:\s*'([a-z]+)'/g)].map((m) => m[1]);
        assert.deepEqual([...new Set(wired)].sort(), ['abort', 'latch', 'zero'],
            'the only commands the wizard can send are the three the handler declares');
    });

    test('the latch weight comes from THE ONE TABLE, and is not typed on the leaf', () => {
        const limits = limitsFor('bengle');
        assert.equal(hasLimit(limits, 'calibrationWeight'), true);
        assert.deepEqual(limits.calibrationWeight, { min: 1, max: 10000, step: 1, unit: 'g' });
        /* de1handler.dart:290-301 declares exactly this pair; nothing on the leaf repeats
         * it, which is the whole of B2/R2 at this row. */
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        assert.doesNotMatch(leaf, /10000/, 'the leaf must not carry the ceiling');
        assert.doesNotMatch(leaf, /min:\s*1\b/, 'nor the floor');
    });

    test('the flow-calibration factor writes through its OWN door and re-reads', async () => {
        let served = 1;
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /machine/calibration') return ok({ flowMultiplier: served });
            if (key === 'POST /machine/calibration') {
                served = body.flowMultiplier;
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            return bad(503);
        });
        const store = createCalibrationStore({ transport, setTimer: () => null, clearTimer: () => {} });
        await store.readFlow();
        assert.equal(store.get().flowMultiplier, 1);

        assert.equal(await store.writeFlow(1.08), true);
        assert.equal(store.get().flowMultiplier, 1.08, 'the value shown is the value the machine holds');
        assert.equal(await store.writeFlow(Number.NaN), false, 'a non-number never reaches the wire');
        assert.equal(transport.calls.filter((c) => c.method === 'POST').length, 1);
    });
});

/* ===========================================================================
 * 4. THE TWO-DOOR MACHINE PORT — B7, one storey below the routing table
 * =========================================================================== */

describe('one field, one door, decided in a table', () => {
    test('every routed field names a door this port has, and no field has two', () => {
        for (const [field, door] of Object.entries(FIELD_DOORS)) {
            assert.ok(DOORS.includes(door), `${field} names an unknown door ${door}`);
        }
        assert.equal(new Set(Object.keys(FIELD_DOORS)).size, Object.keys(FIELD_DOORS).length);
    });

    test('a patch is split by the table, and neither door sees the other’s fields', async () => {
        const wrote = { settings: null, flow: null };
        const port = createMachineFieldsPort({
            settings: {
                read: async () => ({ fan: 30, usb: true }),
                write: async (patch) => { wrote.settings = patch; return true; },
            },
            calibration: {
                readFlow: async () => {},
                get: () => ({ flowMultiplier: 1.05 }),
                writeFlow: async (value) => { wrote.flow = value; return true; },
            },
        });

        const document = await port.read();
        assert.deepEqual(document, { fan: 30, usb: true, flowMultiplier: 1.05 },
            'one document to the model, assembled from two');

        assert.equal(await port.write({ fan: 35, flowMultiplier: 1.1 }), true);
        assert.deepEqual(wrote.settings, { fan: 35 }, 'the settings door never sees flowMultiplier');
        assert.equal(wrote.flow, 1.1);
    });

    test('a patch of settings fields alone never touches the calibration route', async () => {
        let flowCalls = 0;
        const port = createMachineFieldsPort({
            settings: { read: async () => ({}), write: async () => true },
            calibration: { readFlow: async () => {}, get: () => ({ flowMultiplier: null }), writeFlow: async () => { flowCalls += 1; return true; } },
        });
        await port.write({ fan: 20 });
        assert.equal(flowCalls, 0);
    });

    test('an absent flow multiplier is ABSENT, never a null in the document', async () => {
        const port = createMachineFieldsPort({
            settings: { read: async () => ({ fan: 30 }), write: async () => true },
            calibration: { readFlow: async () => {}, get: () => ({ flowMultiplier: null }), writeFlow: async () => true },
        });
        assert.deepEqual(await port.read(), { fan: 30 });
        assert.ok(!('flowMultiplier' in await port.read()));
    });

    test('a half that fails makes the whole write false — D11 must not clear staged intents', async () => {
        const port = createMachineFieldsPort({
            settings: { read: async () => ({}), write: async () => true },
            calibration: { readFlow: async () => {}, get: () => ({ flowMultiplier: 1 }), writeFlow: async () => false },
        });
        assert.equal(await port.write({ fan: 30, flowMultiplier: 2 }), false);
        assert.equal(await port.write({}), false, 'an empty patch is not a successful write of nothing');
    });

    test('no doors at all is null, not a port that silently drops writes', () => {
        assert.equal(createMachineFieldsPort({}), null);
        assert.equal(createMachineFieldsPort({ settings: null, calibration: null }), null);
    });
});

/* ===========================================================================
 * 5. THE SKINS LIST — two leaves, one read, and no invented verdict
 * =========================================================================== */

describe('the installed skins, read once for two leaves', () => {
    const RECORDS = [
        { id: 'decal', name: 'Decal', version: '0.0.1', isBundled: false, reaMetadata: { lastChecked: '2026-08-19T00:00:00Z' } },
        { id: 'beanie', name: 'Beanie', version: '0.3.5', isBundled: true, reaMetadata: { lastChecked: null } },
    ];

    test('the list and the default are read together and shared', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /webui/skins') return ok(RECORDS);
            if (key === 'GET /webui/skins/default') return ok(RECORDS[0]);
            return bad(503);
        });
        const store = createSkinsStore({ transport });
        await Promise.all([store.load(), store.load()]);
        assert.equal(transport.calls.length, 2, 'two leaves asking is one pair of requests');
        assert.equal(store.get().status, SKINS_STATUS.READY);
        assert.equal(store.active().id, 'decal');
    });

    test('404 on the default means NONE SET, not a missing feature', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /webui/skins'
            ? ok(RECORDS)
            : bad(404, { error: 'No default skin available' })));
        const store = createSkinsStore({ transport });
        await store.load();
        assert.equal(store.get().status, SKINS_STATUS.READY, 'the list is still good');
        assert.equal(store.get().defaultId, null);
        assert.equal(store.get().defaultLoaded, true);
        assert.equal(store.active(), null);
    });

    /* THE OUTCOME HALF (27 August 2026). Slate answers "is there an update?" by fetching
     * api.github.com straight from the webview and diffing a tag; Decal cannot, and
     * `src/data/README.md`'s Gate 3 says why. What it CAN do is report what the run
     * actually did, because the versions before and after are both in this store's hands. */

    test('an update run reports the versions that MOVED, and nothing else', async () => {
        const after = [
            { ...RECORDS[0], version: '0.1.100' },
            { ...RECORDS[1] },
        ];
        let updated = false;
        const transport = transportOf(({ key }) => {
            if (key === 'GET /webui/skins') return ok(updated ? after : RECORDS);
            if (key === 'GET /webui/skins/default') return ok(RECORDS[0]);
            if (key === 'POST /webui/skins/update') { updated = true; return ok({ message: 'done' }); }
            return bad(503);
        });
        const store = createSkinsStore({ transport });
        await store.load();
        assert.equal(await store.updateAll(), true);
        assert.equal(store.get().updateRan, true);
        assert.deepEqual(store.get().updated, [{ id: 'decal', from: '0.0.1', to: '0.1.100' }],
            'the skin that did not move is not reported as updated');
    });

    test('a run in which nothing moved says so — which is a REPORT, not a prediction', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /webui/skins') return ok(RECORDS);
            if (key === 'GET /webui/skins/default') return ok(RECORDS[0]);
            if (key === 'POST /webui/skins/update') return ok({ message: 'done' });
            return bad(503);
        });
        const store = createSkinsStore({ transport });
        await store.load();
        await store.updateAll();
        assert.equal(store.get().updateRan, true);
        assert.deepEqual(store.get().updated, []);
    });

    test('a FAILED run reports nothing as updated, because a failed POST moved nothing', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /webui/skins') return ok(RECORDS);
            if (key === 'GET /webui/skins/default') return ok(RECORDS[0]);
            if (key === 'POST /webui/skins/update') return bad(500);
            return bad(503);
        });
        const store = createSkinsStore({ transport });
        await store.load();
        assert.equal(await store.updateAll(), false);
        assert.equal(store.get().updateRan, false, 'nothing ran, so nothing is reported');
        assert.deepEqual(store.get().updated, []);
        assert.ok(store.get().updateError, 'and the failure itself is published');
    });

    test('the outcome dies with the next plain read, so a sentence cannot outlive its run', async () => {
        let updated = false;
        const transport = transportOf(({ key }) => {
            if (key === 'GET /webui/skins') return ok(updated ? [{ ...RECORDS[0], version: '9.9.9' }] : RECORDS);
            if (key === 'GET /webui/skins/default') return ok(RECORDS[0]);
            if (key === 'POST /webui/skins/update') { updated = true; return ok({}); }
            return bad(503);
        });
        const store = createSkinsStore({ transport });
        await store.load();
        await store.updateAll();
        assert.equal(store.get().updateRan, true);
        /* A LEAF RE-OPENED IS A NEW READ, and a person who has pressed nothing this time
         * must not be told what a previous visit's press did. */
        await store.refresh();
        assert.equal(store.get().updateRan, false);
        assert.deepEqual(store.get().updated, []);
    });

    test('an empty list is a real answer; a non-array is not a list at all', () => {
        assert.deepEqual(readSkins([]), []);
        assert.equal(readSkins({}), null);
        assert.equal(readSkins(null), null);
        assert.equal(readSkin({ name: 'no id' }), null, 'an unreadable record is dropped, not defaulted');
    });

    test('NO update verdict is synthesised for a SKIN', () => {
        /* THE CLAIM IS ABOUT SKINS AND ALWAYS WAS. `GET /webui/skins` carries `lastChecked`
         * and no verdict, so "an update is available" would be this app's invention.
         * FIRMWARE is the opposite case and arrived on 24 Aug 2026: its catalog SERVES
         * `updateAvailable` as a tri-state, and reading a served field is the opposite of
         * synthesising one — so the leaf file, which now renders both, is checked for the
         * skins half by its skins code rather than by the word appearing anywhere in it. */
        for (const path of ['src/stores/skins-store.js']) {
            assert.doesNotMatch(CODE[path], /updateAvailable/, `${path} invents a verdict nothing serves`);
        }
    });

    /* THREE OF THE FOUR ARE ADDRESSED SINCE 26 AUGUST 2026, and the rule they were held
     * behind was a WAVE BOUNDARY rather than a decision about the routes.
     *
     * Ben: "use Slate completely" on Display › Skin, which means the tiles switch — and
     * switching is `PUT /webui/skins/default` followed by a server stop and start, because
     * the default is a preference and `start` is what re-points the server. And on Updates
     * › Skin / App: a control that updates, and an answer to "where do skins get added and
     * removed?".
     *
     * `postWebuiSkinsInstallUrl` IS STILL NOT ADDRESSED and that is a decision rather than
     * a gap: installing a skin from a typed URL is how a tablet ends up serving something
     * nobody vetted, and Ben has not asked for it. `skins-store.js` is the ONE file
     * allowed to spell the other three — a screen reaching for them directly is what this
     * test still forbids. */
    test('the skin writes live in the store, and the install-from-URL route is untouched', () => {
        const code = Object.values(CODE).join('\n');
        assert.doesNotMatch(code, /postWebuiSkinsInstallUrl/,
            'installing from a typed URL is how a tablet serves something nobody vetted');
        /* THE STORE SPELLS THEM AND NOTHING ELSE DOES. Five routes, one caller: a screen
         * reaching for any of them would be a second answer to "what does switching a skin
         * mean", and the ORDER is the whole of that answer (see `switchTo`). */
        const store = CODE['src/stores/skins-store.js'];
        const elsewhere = CLUSTER_FILES
            .filter((path) => path !== 'src/stores/skins-store.js')
            .map((path) => CODE[path]).join('\n');
        for (const id of ['putWebuiSkinsDefault', 'postWebuiSkinsUpdate', 'deleteWebuiSkinsById',
            'postWebuiServerStart', 'postWebuiServerStop']) {
            assert.match(store, new RegExp(id), `${id} is not addressed by the store that owns it`);
            assert.doesNotMatch(elsewhere, new RegExp(id),
                `${id} belongs to skins-store.js; a second caller here is a second answer`);
        }
    });
});

/* ===========================================================================
 * 5b. THE APP HALF OF "SKIN / APP" — a route with no caller until 27 Aug 2026
 * =========================================================================== */

describe('which build of Decaid this tablet runs, read once and never invented', () => {
    /* THE RECORDED CAPTURE, verbatim from tools/rea-fixtures/api__v1__info.json. Nine
     * fields a running ReaPrime actually served, rather than nine plausible strings. */
    const INFO = Object.freeze({
        commit: 'e3313d840e52ecc334d705078cca48ae05e0283a',
        commitShort: 'e3313d84',
        branch: 'port/rea-bench-v2',
        buildTime: '2026-08-11T19:56:05Z',
        version: '1.0.0-bengle.1',
        buildNumber: '2259',
        appStore: false,
        fullVersion: '1.0.0-bengle.1+2259',
        localIp: '192.168.1.73',
    });

    test('one read per store, however many times a leaf opens', async () => {
        /* A BUILD CANNOT CHANGE UNDER A RUNNING PAGE, so paging in and out of the leaf is
         * not a second question. `#load()` on the leaf calls this on every open. */
        const transport = transportOf(() => ok({ ...INFO }));
        const store = createAppInfoStore({ transport });
        await store.load();
        await store.load();
        await Promise.all([store.load(), store.load()]);
        assert.equal(transport.calls.length, 1);
        assert.equal(store.get().status, APP_INFO_STATUS.READY);
        assert.equal(store.get().info.commitShort, 'e3313d84');
    });

    test('a FAILED read is retried, because a machine still coming up is not a permanent answer', async () => {
        let up = false;
        const transport = transportOf(() => (up ? ok({ ...INFO }) : bad(503)));
        const store = createAppInfoStore({ transport });
        await store.load();
        assert.equal(store.get().status, APP_INFO_STATUS.FAILED);
        assert.equal(store.get().info.version, null, 'a failed read leaves every field absent');
        up = true;
        await store.load();
        assert.equal(transport.calls.length, 2);
        assert.equal(store.get().status, APP_INFO_STATUS.READY);
    });

    test('the server’s own two spellings of "I do not know" are ABSENCE, not values', () => {
        /* build_info.dart is nine String.fromEnvironment reads whose defaults are the
         * literal word `unknown` (commit, commitShort, branch, buildTime), and _localIp
         * answers '' when the lookup fails. Printing "unknown" beside "Commit" would dress
         * an absence up as a reading; the dash is what every unread value in this skin
         * shows. */
        const info = readAppInfo({
            ...INFO, commit: 'unknown', commitShort: 'UNKNOWN', branch: '  ', localIp: '',
        });
        assert.equal(info.commit, null);
        assert.equal(info.commitShort, null, 'the sentinel is matched whatever its case');
        assert.equal(info.branch, null);
        assert.equal(info.localIp, null);
        assert.equal(info.version, '1.0.0-bengle.1', 'a real value is untouched');
    });

    test('appStore is the one field whose false is an ANSWER rather than an absence', () => {
        /* bool.fromEnvironment('APP_STORE') defaults to false, which is a real statement:
         * this build did not come from an app store. */
        assert.equal(readAppInfo({ ...INFO, appStore: false }).appStore, false);
        assert.equal(readAppInfo({ ...INFO, appStore: true }).appStore, true);
        assert.equal(readAppInfo({ ...INFO, appStore: 'false' }).appStore, null,
            'a non-boolean is unreadable, and unreadable is not false');
    });

    test('a body that is not a record is UNREADABLE, not an anonymous build', () => {
        assert.equal(readAppInfo(null), null);
        assert.equal(readAppInfo([]), null);
        assert.equal(readAppInfo('1.0.0'), null);
    });

    test('the update feed now has a reader, which is the whole of this repair', () => {
        /* THE DEFECT, STATED AS A GUARD. `/ws/v1/update` was ATTACHED on every boot, its
         * frames parsed by a complete reader carrying phase, currentVersion,
         * latestVersion, releaseNotes, releaseUrl, installable, progress and error — and
         * on 27 August 2026 `FEED.UPDATE` appeared in exactly two files, `live-stores.js`
         * and `feed-readers.js`, both of which are the pipe rather than a consumer. A
         * socket held open for the life of the app and thrown away.
         *
         * OUTSIDE src/stores/ IS THE TEST, and it is the right boundary rather than a
         * convenient one: everything under `src/stores/` is the plumbing that fills the
         * feed, so a reader that lives there is the pipe reading itself. The day somebody
         * deletes the Decaid block, this turns red and says what went with it. */
        const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = `${dir}/${entry.name}`;
            if (entry.isDirectory()) return walk(path);
            return entry.name.endsWith('.js') ? [path] : [];
        });
        const readers = walk('src')
            .filter((path) => !path.startsWith('src/stores/'))
            .filter((path) => /FEED\.UPDATE|appUpdate/.test(stripComments(readFileSync(path, 'utf8'))));
        assert.ok(readers.length > 0,
            'the /ws/v1/update socket is attached on every boot and nothing outside src/stores/ reads it');

        /* AND ITS TWO COMMANDS HAVE CALLERS. `check` is the only thing that moves
         * latestVersion off null short of a twelve-hour timer, and `install` is the whole
         * point of the frame carrying `installable`. */
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        assert.match(leaf, /appUpdate\?\.check/, 'nothing asks ReaPrime to check for a newer build');
        assert.match(leaf, /appUpdate\?\.install/, 'nothing acts on an available update');
    });

    test('nothing substitutes the SKIN’s version for the APP’s', () => {
        /* The two are different quantities and printing one where the other was asked for
         * is a lie that survives review because it looks right. */
        assert.doesNotMatch(CODE['src/stores/app-info-store.js'], /skin-manifest|SKIN_VERSION/);
    });
});

/* ===========================================================================
 * 5c. THE SERVED DATE ON A SKIN ROW — three cases, three different facts
 * =========================================================================== */

describe('shortDate: a stamp, "never", and a string that is not a date', () => {
    test('a served ISO timestamp becomes a day and a short month', () => {
        const text = shortDate('2026-08-12T05:59:27.904910Z', 'en');
        assert.match(text, /12/);
        assert.match(text, /Aug/);
    });

    test('an unparseable string is null — never a guess and never today', () => {
        /* `new Date('nonsense')` IS an object whose time value is NaN, so every
         * truthiness check passes and Intl throws a RangeError. Testing the number is the
         * only test that asks whether a date was read. */
        assert.equal(shortDate('nonsense'), null);
        assert.equal(shortDate(''), null);
        assert.equal(shortDate(null), null);
        assert.equal(shortDate(undefined), null);
        assert.equal(shortDate(1755000000000), null, 'a number is not the served shape');
    });

    test('the module owns a DATE and wall-clock.js still owns the time of day', () => {
        /* Folding this into wall-clock.js would have made that file's own first line
         * false about half its contents: a clock ticks, has a stored preference and
         * repaints two live surfaces; a server stamp does none of those. */
        /* CODE, NOT PROSE. `short-date.js` NAMES the clock module's constants in its own
         * header, explaining why it is not part of it — a source scan that could not tell
         * an argument from an import would forbid the file from stating its own reason. */
        assert.doesNotMatch(stripComments(read('src/lib/wall-clock.js')), /shortDate/);
        assert.doesNotMatch(stripComments(read('src/lib/short-date.js')), /hourCycle|CLOCK_FORMAT/);
    });

    /* THE SECOND CALLER ASKED FOR THE TIME AS WELL (27 August 2026): Help › Talk to
     * Decent's message thread. Two messages on one afternoon are otherwise stamped
     * identically, and the whole point of a thread is that it has an order a reader can
     * see. It lives here rather than at the call site for the reason the module already
     * argues — one `Intl.DateTimeFormat` option bag per call site is how one app comes to
     * spell one kind of thing two ways, which is what Slate does. */
    test('shortDateTime adds the time, and takes MILLISECONDS because its caller holds seconds', () => {
        const text = shortDateTime(Date.UTC(2026, 7, 12, 5, 59), 'en-GB');
        assert.match(text, /12/);
        assert.match(text, /Aug/);
        assert.match(text, /\d{2}:\d{2}/, 'a conversation needs the time, not just the day');
    });

    test('shortDateTime refuses anything that is not a finite number of milliseconds', () => {
        /* THE UNIT DIFFERENCE IS THE POINT. `shortDate` takes the ISO string ReaPrime
         * serves; this takes the epoch milliseconds the Decent support backend's UNIX
         * seconds become at the call site, where the unit is known. Converting to a string
         * only to parse it back would be two chances to lose an hour to a timezone — so a
         * string is refused here exactly as a number is refused there. */
        assert.equal(shortDateTime('2026-08-12T05:59:27Z'), null, 'a string is not the shape this takes');
        assert.equal(shortDateTime(Number.NaN), null);
        assert.equal(shortDateTime(null), null);
        assert.equal(shortDateTime(undefined), null);
    });
});

/* ===========================================================================
 * THE ONE PLACE A PLUGIN PAGE IS NAMED
 *
 * `plugin-pages.js` exists because of a collision between two pinned laws, and the test
 * for it is a test that the collision is still resolved the only way it can be.
 * =========================================================================== */

describe('plugin-pages: the destination lives where a screen AND a store can both read it', () => {
    test('the DYE2 pair is the manifest\'s own spelling, and it is Ben\'s endpoint', () => {
        assert.equal(DYE2_PLUGIN.id, 'dye2.reaplugin');
        assert.equal(DYE2_PLUGIN.page, 'bean-picker');
        assert.equal(DYE2_PLUGIN_ID, DYE2_PLUGIN.id);
        assert.equal(DYE2_PAGE_ENDPOINT, DYE2_PLUGIN.page);
    });

    /* THE ID AND THE ENDPOINT ARE BOTH IN A REAL RECORDING, which is the difference
     * between naming a destination and guessing one. */
    test('both halves are in a recorded GET /api/v1/plugins', () => {
        const listing = JSON.parse(read('tools/rea-fixtures/api__v1__plugins.json'));
        const manifest = listing.find((entry) => entry.id === DYE2_PLUGIN.id);
        assert.ok(manifest, `no plugin ${DYE2_PLUGIN.id} in the recorded listing`);
        const http = manifest.api.filter((entry) => entry.type === 'http').map((entry) => entry.id);
        assert.ok(http.includes(DYE2_PLUGIN.page), `the manifest declares ${http.join(', ')}`);
        /* AND IT IS NOT WHAT `pluginPage()` WOULD FIND. That helper looks for the endpoint
         * whose id is exactly `ui` — the convention the Decent-authored plugins follow —
         * and DYE2 declares no such endpoint, which is why the Plugins row correctly draws
         * no Open button and why this pair had to be recorded by hand. */
        assert.ok(!http.includes('ui'),
            'if DYE2 grows a `ui` endpoint, the Plugins page can find its own front door and this pair '
            + 'should be re-argued rather than kept');
    });

    /* THE PLACEMENT IS FORCED, NOT PREFERRED, and this is the assertion that says so. The
     * pair reads best beside `pageUrl` in `plugins-store.js` and it cannot live there: the
     * Live skeleton may not import a store (`test/live-screen.test.mjs`), and the screen is
     * one of its two readers. */
    test('the store does not declare it, because the screen that needs it may not import a store', () => {
        const store = stripComments(read('src/stores/plugins-store.js'));
        assert.doesNotMatch(store, /DYE2_PLUGIN|dye2\.reaplugin/,
            'a constant a Live skeleton file must read cannot be declared in src/stores/');
        const screen = stripComments(read('src/screens/live-screen.js'));
        assert.match(screen, /from 'src\/lib\/plugin-pages\.js'/);
    });
});

/* ===========================================================================
 * 6. THE BESPOKE_IDS — enumeration, composition, and what is NOT here
 * =========================================================================== */

describe('bespoke-leaves-nine: TWENTY, named, and each one a leaf the tree has', () => {
    /* NAMED FOR WHAT IT HOLDS. It was `NINE`, and had not been nine since 24 August
 * 2026 — the count is asserted below rather than carried in the name. */
    const BESPOKE_IDS = Object.keys(BESPOKE_LEAVES);
    const LEAF = SOURCE['src/screens/settings-bespoke-leaf.js'];
    const LEAF_CODE = CODE['src/screens/settings-bespoke-leaf.js'];

    test('§4.4 named nine; the registry declares TWENTY', () => {
        /* THE TENTH IS `updates-firmware-update`, and it is a decision reversed rather
         * than a leaf appearing. D4 had reduced it to a sentence; Ben reversed that on
         * 24 August 2026 — "I should be able to pick a file, but it should also have a
         * 'latest' button that pulls it." A catalog, two install paths and a progress
         * track are not a settings row, so it is bespoke by the same rule as the nine.
         *
         * TEN MORE ARRIVED THE SAME DAY, on Ben's "lets fix all the settings pages then
         * now" — descaling, transport mode, plugins, visualizer, the Decent account,
         * feedback, the USB charger's status block, the scale connection surface, the
         * keyboard bindings and the cup warmer. EVERY ONE OF THEM WAS A DOOR WITH NOBODY
         * WALKING THROUGH IT: not one needed a route the generated table did not already
         * carry, most had a served fixture, and the cup warmer had a COMPLETE STORE with
         * no caller anywhere in `src/`. What they lacked was a surface.
         *
         * THE TWENTY-FIRST REVERSES THE F3/Q1 SCREEN LAW, which held that
         * `calibration-default-load-settings` must carry zero rows and zero note. That
         * rule was written when the values a reset moves were mostly invisible here.
         * `De1Controller.applySettingsDefaults` writes SEVEN — the fan threshold, the
         * four heater-up numbers, the refill kit mode, the flow estimate and the steam
         * purge mode — and on 24 August every one of them became a control on a page.
         *
         * AND ONE LEFT AGAIN ON 26 AUGUST 2026, which is the direction this number should
         * move. The cup warmer's four hand-drawn controls became four registry rows the
         * moment a DOOR existed for their two routes (`cupWarmerDoorFor`), in the order
         * Ben asked for. A leaf is bespoke because it needs a LAYOUT nothing else has —
         * never because its data was awkward to reach.
         *
         * AND TWO ARRIVED THE SAME DAY, both connection pages: Ben asked for "a list of
         * previously connected devices" on Machine and "the same setup" on Scale. A list
         * of devices, each with its own state and its own three actions, is not a settings
         * row and never could be — a row has one control. `connection-machine` had been
         * one text field that never said whether the machine was connected. */
        /* 21 -> 20 on 28 August 2026. `display-screen` left: its bespoke half was the
         * brightness slider and nothing else, and `ARCHETYPE.SLIDER` made that a
         * registry row. The first archetype added since the cut, and it was added to
         * retire a page rather than to draw a new control. */
        assert.equal(BESPOKE_IDS.length, 20);
        const known = new Set(allLeaves().map((leaf) => leaf.id));
        for (const id of BESPOKE_IDS) {
            assert.ok(known.has(id), `${id} is not a leaf settings-nav.js has`);
            assert.equal(leafKind(id), LEAF_KIND.BESPOKE);
        }
    });

    test('every one of the twenty-one has a section, and nothing else does', () => {
        for (const id of BESPOKE_IDS) {
            assert.match(LEAF_CODE, new RegExp(`case '${id}':`), `${id} has no section`);
        }
        const cases = [...LEAF_CODE.matchAll(/case '([a-z0-9-]+)':\s*return this\.#/g)].map((m) => m[1]);
        assert.deepEqual([...cases].sort(), [...BESPOKE_IDS].sort(),
            'a twenty-second section would be a registry change, not a branch');
    });

    test('THE BESPOKE HALF RENDERS NO ROW AND NO HEADING — the primitive owns both', () => {
        assert.doesNotMatch(LEAF_CODE, /ui-settings-row/, 'a second row shape is a block (T13/T14/T17/T20)');
        assert.doesNotMatch(LEAF_CODE, /<h2/, 'the one leaf heading is <settings-leaf>’s');
        assert.doesNotMatch(LEAF_CODE, /leaf-heading/);
    });

    test('every component composed is on the 57-item inventory', () => {
        const composed = new Set([...LEAF_CODE.matchAll(/<(ui-[a-z-]+)/g)].map((m) => m[1]));
        const inventory = new Set([
            'ui-card', 'ui-card-grid', 'ui-definition-card', 'ui-tile-grid', 'ui-wizard-column',
            /* #7, joined 26 Aug 2026: the language picker (Ben: "add a dropdown to choose
             * the language"). It REPLACES the tile grid on that leaf, which now has no
             * screen caller at all — a Wave-1 primitive with its own suite and its own
             * gallery entry, composed by nothing under `src/screens/`. Said here rather
             * than left to be discovered. */
            'ui-select',
            'ui-colour-swatch-row', 'ui-slider', 'ui-progress-track', 'ui-empty-state',
            'ui-bank', 'ui-button', 'ui-stepper',
            /* #5, joined 21 Aug 2026 (cmp-ss-1): the lighting leaf's Power switch.
             * Slate renders it as a slate-switch beside the word Power
             * (settings.js:3954); the composition is #5 and no new control. */
            'ui-switch',
            /* JOINED 24 Aug 2026 with the firmware leaf. A button over a clipped file
             * input: two surfaces now ask for a file off the tablet (a profile and a
             * firmware image) and a screen that authored its own input would be two
             * copies of the same three traps — the cleared value, the focusable hidden
             * box, the silent cancel. */
            'ui-file-button',
            /* JOINED 24 Aug 2026. Ben: "LED colour wheel is missing from the settings."
             * Six preset swatches answer six questions out of sixteen million, which on a
             * control whose whole subject is colour is not a control. The old skin has the
             * same wheel from the same vendored library; what this component owns is the
             * three traps that come with it — the app's zoom against iro's own pointer
             * maths, the programmatic set that fires as an input, and the rebuild that is
             * the flicker. */
            'ui-colour-wheel',
            /* SEVEN JOINED ON 24 AUGUST 2026 with the nine new leaves. Each is on the
             * 57-item inventory already; what changed is that this cluster now composes
             * it. None is a new control and none is authored here:
             *
             *   ui-dialog        #18 — the wake-schedule editor and the night-mode time
             *   ui-time-picker   #22 — a minute-of-day is a clock face, and its host IS
             *                    a dialog body, which is why neither can be a #29 row
             *   ui-list-row      a schedule, a plugin, a found device, a WiFi endpoint
             *   ui-confirm-dialog  descaling and air purge cannot be undone half way,
             *                    and a removed plugin cannot be reinstalled from here
             *   ui-text-field    a plugin setting and a scale address
             *   ui-notes-editor  the feedback description — the only multi-line surface
             *   ui-status-chip   the account state and a found device's state
             *   ui-keycap        a bound key, drawn as the key it is
             */
            'ui-dialog', 'ui-time-picker', 'ui-list-row', 'ui-confirm-dialog',
            'ui-text-field', 'ui-notes-editor', 'ui-status-chip', 'ui-keycap',
            /* JOINED 24 AUGUST 2026. Ben: "In all settings I cannot seem to open the
             * number pad when chaning a spinners value, tapping the number should always
             * open the number pad modal." The registry rows reach the SCREEN's one keypad
             * through `leaf-edit`, which the screen answers out of the leaf model. A
             * bespoke stepper is not a model row, so that route finds nothing and the
             * four steppers on this pane were the only numbers in the app a tap did not
             * open. #53 is on the inventory already and no control is authored here. */
            'ui-numeric-keypad',
            /* JOINED 27 AUGUST 2026, AND IT HAD ZERO CONSUMERS UNTIL THAT DAY. #12's
             * `attention` variant was built for one sentence — its own header names
             * "Update available" on the skin list as the case it exists for — and nothing
             * in `src/screens/` had ever rendered it. Two surfaces on Updates › Skin / App
             * do now: the app-update line, and the row of a skin whose version actually
             * moved in the last run. A variant with no caller is the defect this fork
             * exists to remove, and it was sitting inside the component library. */
            'ui-badge',
            /* JOINED 30 AUGUST 2026 WITH THE PLUGIN SETTINGS GEAR. The Plugins page listed
             * every plugin with a name, an enable switch and an Open button, and the Open
             * button appears only when the plugin declares an HTML PAGE — so a plugin with
             * `settingFields` and no page had NOWHERE in Settings to be configured. Ben,
             * 30 August 2026: "Is there where we need to add a gear icon to each of the
             * plugins to open the settings for it?" The gear is #31 in its icon-only form,
             * one per row that declares fields. */
            'ui-icon-button',
        ]);
        for (const tag of composed) {
            assert.ok(inventory.has(tag), `${tag} is not a component this cluster declared composing`);
        }
        /* AND EVERY ONE OF THEM IS IMPORTED — a tag rendered without its module is an
         * un-upgraded element that silently renders nothing. */
        for (const tag of composed) {
            assert.match(LEAF_CODE, new RegExp(`import 'src/components/${tag}\\.js'`), `${tag} is not imported`);
        }
    });

    test('NO NEW CUSTOM ELEMENT beyond the one renderer', () => {
        const defined = [...LEAF_CODE.matchAll(/customElements\.define\('([^']+)'/g)].map((m) => m[1]);
        assert.deepEqual(defined, ['settings-bespoke-leaf']);
        for (const path of CLUSTER_FILES.filter((p) => p !== 'src/screens/settings-bespoke-leaf.js')) {
            assert.doesNotMatch(CODE[path], /customElements\.define/, `${path} defines an element`);
        }
    });

    test('T21 / T1: not one of the three dead measures is spelled in this cluster', () => {
        for (const [path, code] of Object.entries(CODE)) {
            for (const dead of [/\b885\b/, /\b1200px\b/, /\b760px\b/, /\b1263\b/]) {
                assert.doesNotMatch(code, dead, `${path} carries a dead measure`);
            }
        }
        /* AND NO SECTION DECLARES A WIDTH. Every width-shaped declaration in the file is
         * enumerated rather than pattern-matched, because a negative lookahead over CSS is
         * how a rule stops covering what it was written for. */
        const capped = [...LEAF_CODE.matchAll(/max-inline-size:\s*([^;]+);/g)].map((m) => m[1].trim());
        /* TWO DECLARATIONS SINCE 27 AUGUST 2026 AND BOTH NAME THE SAME TOKEN. `.prose` has
         * always carried it; `.caution` — the tinted warning above the firmware buttons —
         * joined it. Slate's own recipe for that block spells `70ch`, which is
         * --ui-measure to the character, so the token is what is written rather than the
         * number: a section spelling its own width IS T21, whatever the width happens to
         * equal. The claim asserted here is therefore about the VALUE and not the count —
         * a third prose block may join tomorrow and must still name the token. */
        assert.ok(capped.length > 0, 'the prose measure vanished — this guard now checks nothing');
        assert.deepEqual([...new Set(capped)], ['var(--ui-measure)'],
            'the only measure a section may name is the PROSE one; the leaf measure is the pane’s');

        /* THE ATTRIBUTE `size="440"` ON THE COLOUR WHEEL IS NOT A CSS DECLARATION and must
         * not be read as one. It is a PROPERTY the component takes — iro's own config
         * width, in design units — and `ui-colour-wheel.js` is where the whole scale
         * argument lives. Stripping the attribute before the scan keeps this guard about
         * what it is about: a SECTION of this leaf declaring how wide it is. */
        const sized = [...LEAF_CODE.replace(/\bsize="\d+"/g, '')
            .matchAll(/(?:^|\s)(inline-size|width|max-width):\s*([^;]+);/g)]
            .map((m) => `${m[1]}: ${m[2].trim()}`);
        /* THREE NOW, AND NONE IS A MEASURE. The first is a language tile filling its own
         * track. The second is a screen-saver THUMBNAIL, which is a fixed thing — a
         * picture shown at picture size.
         *
         * THE THIRD ARRIVED 26 AUGUST 2026 AND IT IS A CONTROL, NOT A SECTION. The
         * WiFi-scale address entry sat in a space-between flex row with nothing telling it
         * how wide to be, and a `ui-text-field` states no width of its own — MEASURED
         * beside Slate's page, it drew about 40px wide and 55 tall, narrower than it was
         * tall, with no room for the placeholder it carries. It takes
         * `--_ui-form-control-w`, the same width the form rows and the settings rows give
         * a field, so an address entry is the same size wherever it appears.
         *
         * WHAT T1 AND T21 ARE ABOUT is a LEAF declaring its own measure and coming out
         * wider than every other leaf. None of these can: a tile fills the track its grid
         * gives it, the thumbnails wrap inside their row, and a 320px field inside a
         * wrapping row cannot widen the pane. All three name a token rather than a
         * literal, so the one place each can be changed is the one place it is declared. */
        assert.deepEqual(sized, [
            'inline-size: 100%',
            'inline-size: var(--_ui-form-control-w)',
            'inline-size: var(--_ui-thumb-size)',
        ], 'a tile filling its track, one form control, and a fixed thumbnail');

        /* The one width-shaped NUMBER is a track MINIMUM for auto-fit, which cannot make
         * anything wider than its container — and it is Slate's own min-w-[420px]. */
        assert.match(LEAF_CODE, /--_ui-lighting-col-min:\s*420px/);
        assert.match(LEAF_CODE, /repeat\(auto-fit, minmax\(min\(var\(--_ui-lighting-col-min\), 100%\), 1fr\)\)/);
    });

    test('A3: the three gated leaves ask before they render AND before they read', () => {
        for (const capability of ['ledStrip', 'scaleCalibration', 'wakeSchedule']) {
            assert.match(LEAF_CODE, new RegExp(`#allowed\\('${capability}'\\)`), `${capability} is not gated`);
        }
        /* FAIL-CLOSED IS ONE EXPRESSION AND IT IS PRESENT-ONLY, so ABSENT and UNKNOWN
         * both close the surface — and so does having no capability store at all. */
        const model = stripComments(read('src/screens/settings-model.js'));
        assert.match(model, /capability\(capability\) === CAPABILITY\.PRESENT/);
        assert.match(model, /: false/, 'no capability store is UNKNOWN, not open');

        /* A GATE IS THE SERVED ARRAY, NEVER A MODEL-NAME SNIFF — and the claim is about
         * the SNIFF, not about a word.
         *
         * THIS BANNED THE IDENTIFIER `machineClass` OUTRIGHT until 27 August 2026, which
         * was too wide by one step and would have been caught the first time anything in
         * this file legitimately needed the class. The Default load settings page needed it
         * that day: its Page column names OTHER leaves, `leafFor()` applies no machine
         * filter, and on a Bengle it printed "Flow Multiplier" — a leaf gated
         * `machines: ['de1']` and therefore absent from that machine's own nav. A reset
         * page pointing at a page you cannot open is a route with no client.
         *
         * AND READING THE CLASS IS NOT SNIFFING A MODEL. `machineClass()` is
         * `machineClassFromServedSet` (`adapters-r.js:555-558`) — the SAME served array this
         * whole test is about, read through the capability store, with `null` for "not
         * answered yet". What the rule exists to stop is the other thing: a string test on
         * the machine's reported model name, which is what the served array replaced and
         * which no capability read can correct.
         *
         * SO THE BAN IS ON THE SHAPE. A comparison against a model NAME, in any of the
         * spellings that have actually been written: `model === 'bengle'`,
         * `model.includes('bengle')`, or a bare 'bengle' / 'de1' literal in this file —
         * the class values themselves belong in the registry and the nav, never here. */
        assert.doesNotMatch(LEAF_CODE, /model\s*(===|==|!==|\.includes|\.startsWith|\.match)/i,
            'a gate is the served array, never a model-name sniff');
        assert.doesNotMatch(LEAF_CODE, /['"](bengle|de1)['"]/i,
            'a machine class literal here is a branch the registry should be carrying');
    });

    test('the leaf reads nothing at all for a capability it is not allowed', () => {
        /* The `#load` switch guards both machine reads with the same call the render does,
         * so a gated-off leaf issues no request to a machine that advertised no feature. */
        assert.match(LEAF_CODE, /if \(this\.#allowed\('ledStrip'\)\) go\(deps\.led\?\.load\(\)\)/);
        assert.match(LEAF_CODE, /if \(this\.#allowed\('scaleCalibration'\)\) go\(deps\.calibration\?\.read\(\)\)/);
    });

    /**
     * AND THE GATE DOES NOT LATCH, which is the other half of fail-closed.
     *
     * The capability read is asynchronous and fails by default (the mock's 503), so the
     * honest first order is leaf-then-answer: a leaf mounted before the array lands asks
     * once, is told no, and — with `deps` memoised per boot, so no property of the leaf
     * ever changes again — would never ask a second time. Closed on UNKNOWN is correct;
     * closed FOREVER on an answer that arrived a moment later is a machine page that is
     * dark on a machine that offers the feature. The subscription is the missing edge and
     * `#loadKey` is what keeps it from re-reading on every bump.
     */
    test('A3 is a state, not a one-shot verdict: the leaf subscribes to the answer', () => {
        const model = stripComments(read('src/screens/settings-model.js'));
        assert.match(model, /watchAllowed:\s*\(listener\)/, 'the model hands the leaf an edge, not just a predicate');
        assert.match(model, /capabilities\?\.subscribe === 'function'/);
        /* IT CARRIES NO CAPABILITY DATA. The listener takes no argument and asks
         * `allowed()` again, so A3 still has exactly one expression. */
        assert.match(LEAF_CODE, /watchAllowed\(\(\) => \{ bump\(\); this\.#load\(\); \}\)/);
        assert.match(LEAF_CODE, /#loadKey/, 'the read is memoised per leaf per gate state');
        const table = /const LEAF_CAPABILITY = Object\.freeze\(\{([^}]+)\}\)/.exec(LEAF_CODE);
        assert.ok(table, 'the gated leaves are one table');
        for (const capability of ['ledStrip', 'scaleCalibration', 'wakeSchedule']) {
            assert.match(table[1], new RegExp(`'${capability}'`), `${capability} has no row in the gate table`);
        }
    });
});

/* ===========================================================================
 * 7. Q14 — the toggle pill, answered
 * =========================================================================== */

describe('Q14: #56 dissolved into #5, and the screen is the confirmation', () => {
    /* ANSWERED AND EXECUTED, 21 Aug 2026 (DQ-610, Ben's ruling): the pill is a
     * `shape="pill"` attribute on #5 and the wrapper component is deleted. The two tests
     * that follow were written when #56 still existed and both still bind — the first
     * because "no settings file composes it" is now true by construction, the second
     * because the retirement's own evidence is what makes the deletion safe. */
    test('the wrapper is gone, and no file in the cluster reaches for it', () => {
        assert.equal(existsSync(fileURLToPath(new URL('../src/components/ui-toggle-pill.js', import.meta.url))), false,
            '#56 is retired: the pill is a shape attribute on #5 (DQ-610)');
    });

    test('no settings file composes ui-toggle-pill', () => {
        for (const path of [...CLUSTER_FILES, 'src/screens/settings-leaf.js', 'src/screens/settings-screen.js']) {
            assert.doesNotMatch(stripComments(read(path)), /ui-toggle-pill/,
                `${path} composes the pill the brightness leaf was supposed to need`);
        }
    });

    /* Q14 SURVIVED ITS OWN LEAF. The claim is "brightness is a SLIDER, not a pill", and
     * it used to be asserted against `#brightness()`'s method body in the bespoke file.
     * On 28 August 2026 `ARCHETYPE.SLIDER` turned that method into a registry row, so the
     * method is gone and the claim is not: it is now a property of the ROW, which is a
     * stronger place to hold it. A row cannot render a pill by accident — the archetype
     * decides the control, and `settings-leaf.js` has one branch per archetype. */
    test('the brightness control is a SLIDER and no toggle — which is what Slate renders', () => {
        const row = SETTINGS_ROWS.find((entry) => entry.id === 'display-screen-brightness');
        assert.ok(row, 'the brightness row is in the registry');
        assert.equal(row.archetype, ARCHETYPE.SLIDER);
        assert.notEqual(row.archetype, ARCHETYPE.SWITCH, 'never a switch, and never a pill');
        /* AND THE RENDERER DRAWS ONE. The row naming an archetype nothing draws is the
         * other half of the same defect, and `settings-leaves.test.mjs` asserts that in
         * both directions for every archetype; this pins the component by name. */
        /* READ DIRECTLY: `CODE` is the bespoke cluster's own files, and the renderer is
         * not one of them — which is the point, since the control left that cluster. */
        const renderer = stripComments(read('src/screens/settings-leaf.js'));
        assert.match(renderer, /case ARCHETYPE\.SLIDER:/);
        assert.match(renderer, /<ui-slider/);
    });

    /**
     * THE MECHANICAL HALF OF THE EVIDENCE, and the reason the retirement is the safe
     * outcome rather than merely the tidy one.
     *
     * #29 names a slotted control through a four-rule ladder over
     * `slot.assignedElements({flatten: true})`. `flatten` descends nested `<slot>`s, NOT a
     * child custom element's shadow root. #56 has NO `label` property and sets NO role on
     * its host, so it falls to rule 3 (role-less generic, left alone) and the `<ui-switch>`
     * nested inside it is never visited: composed naively in a settings row, the switch
     * ships with NO ACCESSIBLE NAME — T15's own "four of twenty switches have no
     * accessible name", re-created by the component built to be tidy.
     *
     * This test asserts the two API facts that make that true. If someone gives #56 a
     * `label` property or a host role, this fails and the reviewer re-reads the
     * retirement — which is the point. It does not freeze the defect: nothing composes the
     * two, so there is no nameless switch anywhere to preserve.
     */
    test('#29 names a switch because there is no wrapper between them — why the retirement is SAFE', () => {
        /* The hazard this test was written for: #29 names a slotted control through a
         * four-rule ladder over `slot.assignedElements({flatten: true})`, and `flatten`
         * descends nested `<slot>`s but NOT a child custom element's shadow root. #56 had
         * no `label` property and set no role, so a switch wrapped in one fell to rule 3
         * (role-less generic, left alone) and shipped with NO ACCESSIBLE NAME — T15's own
         * "four of twenty switches have no accessible name", re-created by the component
         * built to be tidy.
         *
         * With #56 retired the hazard is not fixed, it is INEXPRESSIBLE: there is nothing
         * to nest, and a `shape="pill"` switch is the assigned element itself. Ben's own
         * note on the ruling says the same thing — "No nesting -> the naming gap never
         * arises". What is asserted here is the mechanism that made it a hazard, so that a
         * future wrapper around a control is measured against it again. */
        const row = stripComments(read('src/components/ui-settings-row.js'));
        assert.match(row, /assignedElements\(\{\s*flatten:\s*true\s*\}\)/,
            'the naming walk is over assigned elements, which do not include a child’s shadow root');
    });
});

/* ===========================================================================
 * 8. F3 / Q1 — DELIBERATELY EMPTY
 *
 * Three tests stood here and all three have been removed. Part 10 §12's MUST NOT for
 * this workflow reads "no code, no branch, no plan doc, no placeholder control, no
 * disabled button, no TODO that implies a shape, no test naming one" — and a test whose
 * TITLE and five regexes spell the control's name still names it and still implies its
 * shape, however the assertion is pointed. The third was worse: it swept THIS FILE for
 * the spelling and allowed up to three hits, which is a test whose passing condition is
 * that the phrase is present.
 *
 * The routing cluster wrote the same test, removed it, and recorded why at
 * test/settings-contract.test.mjs:226-231; the skeleton cluster applied that reading at
 * test/settings-skeleton.test.mjs:256. This is the same reading, applied here, and it is
 * the third file in the wave to reach it.
 *
 * WHAT WAS ACTUALLY LOST, and it is not the absence: the sweep ran over
 * COMMENT-STRIPPED source (`stripComments`, :63), so it never saw the file comments that
 * do name the phrase and its "zero matches" was never a statement about the sources as
 * written. It protected nothing — there is no control, no handler and no caller in the
 * cluster for it to catch — and its one real assertion, that the wizard's button table
 * can only send the machine's own three commands, is not an F3 claim at all and now sits
 * with the other D9 command assertions in §3.
 *
 * The hole is recorded in DEFERRED_QUESTIONS_bespoke.md §1 and in the digest's
 * deferred_questions, which is the single sanctioned deliverable, and nowhere else.
 * =========================================================================== */

/* ===========================================================================
 * 9. THE CONTRACT ROWS — checked at the pin, at the moment the caller exists
 * =========================================================================== */

describe('every route this cluster calls has a row, and the row names this caller', () => {
    const rest = new Map(CONTRACTS.rest.map((row) => [row.id, row]));

    const ADOPTED = [
        'getMachineLedStrip', 'putMachineLedStrip', 'postMachineLedStripCommit',
        'postMachineLedStripReset', 'getMachineScaleCalibration', 'putMachineScaleCalibration',
        'getMachineCalibration', 'postMachineCalibration', 'getWebuiSkins', 'getWebuiSkinsDefault',
    ];

    test('all ten are `consumed` and pinned at the table’s own commit', () => {
        for (const id of ADOPTED) {
            const row = rest.get(id);
            assert.ok(row, `${id} has no contract row`);
            assert.equal(row.status, 'consumed', `${id} is called but not marked consumed`);
            assert.equal(row.checkedCommit, CONTRACTS.pinnedCommit, `${id} was checked at another commit`);
            assert.ok(row.consumedBy.length > 0, `${id} names no caller`);
            assert.ok(row.handlerFile && row.handlerSymbol, `${id} names no handler`);
        }
    });

    test('the caller each row names is a file that exists and calls it', () => {
        for (const id of ADOPTED) {
            const named = rest.get(id).consumedBy.join(' ');
            const file = named.match(/src\/[\w/-]+\.js/)?.[0];
            assert.ok(file, `${id}'s consumedBy names no file`);
            assert.match(read(file), new RegExp(`'${id}'`), `${file} does not address ${id}`);
        }
    });

    test('every route id this cluster addresses is in the table', () => {
        const ids = new Set();
        for (const code of Object.values(CODE)) {
            for (const m of code.matchAll(/callRoute\([^,]+,\s*'([A-Za-z]+)'/g)) ids.add(m[1]);
        }
        assert.ok(ids.size >= 10, 'the cluster addresses the routes it says it does');
        for (const id of ids) assert.ok(rest.has(id), `${id} is addressed with no contract row`);
    });

    test('NO PATH IS SPELLED IN THIS CLUSTER — every one comes from the generated table', () => {
        for (const [path, code] of Object.entries(CODE)) {
            assert.doesNotMatch(code, /['"`]\/api\/v1\//, `${path} spells a route`);
        }
    });

    test('the two forbidden ledStrip routes are in EXCLUDED.md and in no source', () => {
        const excluded = read('src/data/EXCLUDED.md');
        assert.match(excluded, /ledStrip\/preview/);
        for (const code of Object.values(CODE)) {
            assert.doesNotMatch(code, /preview\/clear/);
        }
    });
});

/* ===========================================================================
 * 10. THE REGISTRY ROW D9 ADDED — still a primitive, still one owner
 * =========================================================================== */

describe('the flow-calibration factor is a plain row on #29', () => {
    test('it is a stepper on a leaf that is NOT one of the nine', () => {
        const row = SETTINGS_ROWS.find((r) => r.id === 'calibration-flow-multiplier-factor');
        assert.ok(row, 'D9 asks for the factor to be exposed');
        assert.equal(row.archetype, 'stepper');
        assert.equal(row.leaf, 'calibration-flow-multiplier');
        assert.equal(leafKind(row.leaf), LEAF_KIND.PRIMITIVE,
            'a tenth bespoke leaf for one number would be the one-primitive claim leaking');
    });

    /* THIS TEST SAID "UNBOUNDED" AND IS REVERSED (Ben, 26 Aug 2026, O8): "All steppers
     * should have a range and when at the max the + or - should be grayed out." A stepper
     * with no range has no greyed cap, so O8 cannot be true of a row with no limits entry.
     *
     * THE OLD CLAIM WAS STILL RIGHT ABOUT ITS OWN HALF, and that half survives below: the
     * SERVER declares no band for this field, so the band is this skin's statement rather
     * than a range read off a handler — which is why it is written down in
     * `machine-limits.js` with its reasoning, and not invented at the row. */
    test('it is BOUNDED by a declared row, and the row is in the one table', () => {
        const row = SETTINGS_ROWS.find((r) => r.id === 'calibration-flow-multiplier-factor');
        assert.equal(row.limit, 'flowCalibration', 'it names a row in the limits table');
        assert.equal(hasLimit(limitsFor('bengle'), 'flowCalibration'), true);
        assert.equal(hasLimit(limitsFor('bengle'), 'flowMultiplier'), false,
            'and the field name is still not a limits key — the ROW name is');
    });
});
