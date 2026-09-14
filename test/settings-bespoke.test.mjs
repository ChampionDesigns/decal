/**
 *.4's bespoke-and-writes cluster, asked the questions a measurement cannot: bespoke-leaves-nine, d7-led-live-preview, d9-calibration-surfaces, q14-toggle-pill, f3-q1-reset-to-default-hole.
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

describe('led-colour: the four converters, and only the four', () => {
    test('8 -> 16 shifts into the high byte, which is what the MACHINE holds', () => {
        assert.equal(led8to16(0x4a), '4A00');
        assert.equal(led8to16(0xff), 'FF00');
        assert.equal(led8to16(0), '0000');

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

    test('16 -> 8 -> 16 is the identity for a CANONICAL colour and nothing else', () => {
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

    test('the preview pair is addressed by ROUTE ID, never spelled, and the composite is still not ported', () => {
        for (const [path, code] of Object.entries(CODE)) {
            assert.doesNotMatch(code, /ledPreviewComposite/, `${path} ports the composite`);
            assert.doesNotMatch(code, /previewLedStrip/, `${path} spells a Dart method name`);
            assert.doesNotMatch(code, /['\"`]\/machine\/ledStrip/, `${path} spells a path`);
        }
        const store = CODE['src/stores/led-strip-store.js'];
        assert.match(store, /postMachineLedStripPreview['\"]/, 'the drag has to reach the strip');
        assert.match(store, /postMachineLedStripPreviewClear/, 'and something has to end it');
        assert.doesNotMatch(store, /postMachineLedStripCommit/,
            'the keeping step runs an empty method and its refusal was reportable');
    });

    test('the validity helpers agree with the wire format', () => {
        assert.equal(isColour16('FFFFC1C18080'), true);
        assert.equal(isColour16('FFFFC1C1808'), false);
        assert.equal(isChannel16('FFFF'), true);
        assert.equal(isChannel16('FFFFF'), false);
    });
});

describe('the palette is a draft, the strip follows it, and Save is the only store', () => {
    function slowStore() {
        const parked = [];
        const previewParked = [];
        const previews = [];
        const state = { holdPreview: false };
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') {
                return new Promise((resolve) => parked.push(() => resolve(ok({ ...body }, 200))));
            }
            if (key === 'POST /machine/ledStrip/preview') {
                previews.push(body);
                const answer = reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
                if (!state.holdPreview) return answer;
                return new Promise((resolve) => previewParked.push(() => resolve(answer)));
            }
            if (key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            if (key === 'POST /machine/ledStrip/reset') return ok({ ...LED_BODY });
            return bad(503);
        });
        return {
            store: createLedStripStore({ transport }), transport, parked, previewParked, previews, state,
        };
    }

    const posted = (transport, path) => transport.calls.filter((call) => call.path.endsWith(path));

    test('a drag reaches the STRIP and never the stored palette', async () => {
        const { store, transport, previews } = slowStore();
        await store.load();

        const hexes = ['#ffaa55', '#ffd9a0', '#eaf2ff', '#ff7a00', '#ff2200', '#0ca581', '#00c2d1'];
        for (const hex of hexes) void store.preview('frontStrip', 'awake', hex);
        await store.previewSettled();

        assert.ok(previews.length > 0, 'a drag put nothing on the wire — the strip cannot follow it');
        assert.equal(store.get().previewing, true, 'and the store does not know a colour is showing');

        assert.equal(transport.calls.filter((call) => call.method === 'PUT').length, 0,
            'a drag wrote the stored palette');
        assert.equal(store.counters().intents, 7);
        assert.equal(store.counters().sent, 0);
        assert.equal(store.get().dirty, true, 'and the header counts one thing to save');
        assert.equal(store.hex('frontStrip', 'awake'), '#00c2d1', 'the picker shows the last colour');

        const last = previews[previews.length - 1];
        assert.equal(last.frontStrip, ledHex8ToColour16('#00c2d1'));
        assert.equal(last.backStrip, undefined,
            'a strip the body does not name is left alone — naming it would push a colour at it');
    });

    test('a drag against a slow strip keeps ONE request in flight and sends the newest', async () => {
        const { store, previewParked, previews, state } = slowStore();
        await store.load();
        state.holdPreview = true;

        void store.preview('frontStrip', 'awake', '#ff2200');

        assert.equal(previewParked.length, 1);
        for (const hex of ['#0ca581', '#00c2d1', '#7a3ff2']) {
            void store.preview('frontStrip', 'awake', hex);
        }
        assert.equal(previewParked.length, 1, 'four frames, four requests — the slot is not a slot');
        assert.equal(store.counters().previewPeak, 1, 'never two previews at once');
        assert.equal(store.counters().coalesced, 2, 'the frames a newer one replaced');

        previewParked.shift()();
        while (previewParked.length === 0) await new Promise((resolve) => { setTimeout(resolve, 1); });
        assert.equal(previewParked.length, 1, 'the freed slot took the newest waiting frame');
        previewParked.shift()();
        state.holdPreview = false;
        await store.previewSettled();

        assert.equal(previews.length, 2, 'four frames cost two requests');
        assert.equal(previews[1].frontStrip, ledHex8ToColour16('#7a3ff2'),
            'the colour the finger stopped on is the one the strip was left showing');
    });

    test('a frame that repeats the colour already showing is not sent', async () => {
        const { store, previews } = slowStore();
        await store.load();
        for (let i = 0; i < 4; i += 1) {
            await store.preview('frontStrip', 'awake', '#112233');
            await store.previewSettled();
        }
        assert.equal(previews.length, 1, 'a finger resting on one colour kept the write path busy');
    });

    test('Save sends ONE palette — the reviewed one — and ends the preview', async () => {
        const { store, transport, parked } = slowStore();
        await store.load();

        for (const hex of ['#ff2200', '#0ca581', '#00c2d1', '#7a3ff2']) {
            void store.preview('backStrip', 'awake', hex);
        }
        await store.previewSettled();
        const saving = store.commit();
        assert.equal(parked.length, 1, 'one write, whatever the drag did');
        parked.shift()();
        assert.equal(await saving, true);
        await store.settled();

        const puts = transport.calls.filter((call) => call.method === 'PUT');
        assert.equal(puts.length, 1, 'four intents, one write');
        assert.equal(puts[0].body.backStrip.awake, ledHex8ToColour16('#7a3ff2'),
            'the machine is given the colour the user stopped on');

        assert.equal(puts[0].body.frontStrip.awake, LED_BODY.frontStrip.awake);
        assert.equal(puts[0].body.backStrip.sleeping, LED_BODY.backStrip.sleeping);
        assert.equal(store.counters().peakInFlight, 1, 'never two writes at once');
        assert.equal(store.get().dirty, false, 'and there is nothing left to save');

        assert.equal(posted(transport, '/ledStrip/preview/clear').length, 1);
        assert.equal(store.get().previewing, false);
    });

    test('THE KEEPING STEP IS NEVER POSTED — the PUT is the persistence', async () => {
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') return ok({ ...body });
            if (key === 'POST /machine/ledStrip/preview'
                || key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            return bad(503, { error: 'the fixture was never meant to answer this' });
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.previewSettled();

        assert.equal(await store.commit(), true, 'a save that stored the palette reported a failure');
        assert.equal(posted(transport, '/ledStrip/commit').length, 0,
            'a request that runs an empty method was posted, and its refusal was reportable');
        assert.equal(store.get().refusal, null);
        assert.equal(store.get().dirty, false);
        assert.equal(store.hex('frontStrip', 'awake'), '#112233');
        assert.equal(LED_REFUSAL.NOT_KEPT, undefined, 'the state it produced is gone with it');
    });

    test('a colour chosen while the Save is out is REFUSED, not silently discarded', async () => {
        const { store, parked } = slowStore();
        await store.load();
        await store.preview('frontStrip', 'awake', '#4a0924');
        await store.previewSettled();

        const saving = store.commit();
        assert.equal(store.get().writing, true, 'the page has to be able to show it is saving');

        const moved = await store.preview('frontStrip', 'awake', '#3f094a');
        assert.equal(moved, false, 'the edit was taken, and the save is about to throw it away');
        assert.equal(store.hex('frontStrip', 'awake'), '#4a0924',
            'the reviewed colour is what is being saved and what the page must keep showing');

        parked.shift()();
        assert.equal(await saving, true);
        assert.equal(store.hex('frontStrip', 'awake'), '#4a0924');
        assert.equal(store.get().dirty, false, 'and nothing is left half-saved');
        assert.equal(store.get().writing, false, 'the picker comes back');
    });

    test('the power switch is refused during a Save too, and by the same rule', async () => {
        const { store, parked } = slowStore();
        await store.load();
        await store.preview('frontStrip', 'awake', '#4a0924');
        const saving = store.commit();
        assert.equal(await store.power(false, 'awake', ['frontStrip']), false);
        assert.equal(store.hex('frontStrip', 'awake'), '#4a0924');
        parked.shift()();
        await saving;
    });

    test('Cancel drops the colour, ends the preview, and takes the machine’s own answer', async () => {
        for (const resets of [ok({ ...LED_BODY }), bad(503)]) {
            const transport = transportOf(({ key }) => {
                if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
                if (key === 'POST /machine/ledStrip/preview'
                    || key === 'POST /machine/ledStrip/preview/clear') {
                    return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
                }
                if (key === 'POST /machine/ledStrip/reset') return resets;
                return bad(500);
            });
            const store = createLedStripStore({ transport });
            await store.load();
            void store.preview('frontStrip', 'awake', '#112233');
            await store.previewSettled();
            assert.equal(store.get().dirty, true);
            assert.equal(store.get().previewing, true);

            await store.reset();
            assert.equal(store.get().dirty, false, 'Cancel leaves nothing staged');
            assert.equal(store.get().draft, null);
            assert.equal(store.get().previewing, false, 'and nothing showing');
            assert.equal(posted(transport, '/ledStrip/preview/clear').length, 1,
                'Cancel left the tried colour standing on the strip until the next sleep');
            assert.equal(store.hex('frontStrip', 'awake'),
                ledColour16ToHex8(LED_BODY.frontStrip.awake),
                'and the picker is back on the palette the machine holds');
            assert.equal(transport.calls.filter((call) => call.method === 'PUT').length, 0,
                'nothing was ever stored, so there is nothing to write back');
        }
    });

    test('leaving the picker ends the preview and KEEPS the draft', async () => {
        const { store, transport } = slowStore();
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.previewSettled();

        assert.equal(await store.endPreview(), true);
        assert.equal(posted(transport, '/ledStrip/preview/clear').length, 1);
        assert.equal(store.get().previewing, false);
        assert.equal(store.get().dirty, true, 'walking to another leaf threw the edit away');
        assert.equal(store.hex('frontStrip', 'awake'), '#112233');

        assert.equal(await store.endPreview(), true);
        assert.equal(posted(transport, '/ledStrip/preview/clear').length, 1);
    });

    test('a frame still waiting when the picker closes is dropped, not sent after the clear', async () => {
        const { store, transport, previewParked, previews, state } = slowStore();
        await store.load();
        state.holdPreview = true;
        void store.preview('frontStrip', 'awake', '#ff2200');
        void store.preview('frontStrip', 'awake', '#00c2d1');

        const leaving = store.endPreview();
        previewParked.shift()();
        state.holdPreview = false;
        await leaving;

        assert.equal(previews.length, 1, 'the abandoned frame was sent anyway');
        assert.equal(posted(transport, '/ledStrip/preview/clear').length, 1);
        const order = transport.calls.map((call) => call.path);
        assert.ok(order.lastIndexOf('/machine/ledStrip/preview')
            < order.indexOf('/machine/ledStrip/preview/clear'),
            'a preview landed after the clear, so the strip kept the colour the picker abandoned');
    });

    test('a refused preview keeps the draft and says which refusal it is', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'POST /machine/ledStrip/preview') return bad(503, { error: 'busy' });
            return bad(500);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.previewSettled();

        assert.equal(store.get().refusal, LED_REFUSAL.PREVIEW_FAILED);

        assert.notEqual(store.get().refusal, LED_REFUSAL.WRITE_FAILED);
        assert.equal(store.get().dirty, true, 'the edit is still there to save');
        assert.equal(store.hex('frontStrip', 'awake'), '#112233');
        assert.equal(store.get().previewing, false, 'and nothing is standing on the strip');
    });

    test('a refused Save keeps the draft, so the values are still there to try again', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') return bad(500, { error: 'machine busy' });
            if (key === 'POST /machine/ledStrip/preview') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            return bad(500);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.previewSettled();

        assert.equal(await store.commit(), false);
        assert.equal(store.get().refusal, LED_REFUSAL.WRITE_FAILED, 'and it says so');
        assert.equal(store.get().dirty, true, 'the header still counts the change');
        assert.equal(store.hex('frontStrip', 'awake'), '#112233', 'the colour is still on screen');

        assert.equal(store.get().previewing, true);
    });

    test('a Save with nothing staged writes nothing', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /machine/ledStrip'
            ? ok({ ...LED_BODY }) : bad(500)));
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(await store.commit(), true);
        assert.equal(transport.calls.filter((call) => call.method !== 'GET').length, 0);
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
         * storey up, and it is the storey the previous skin put it on. */
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
        assert.equal(transport.calls.filter((call) => call.method !== 'GET').length, 0);
    });

    test('a zone or bank the machine does not have is refused before the wire', async () => {
        const transport = transportOf(({ key }) => (key === 'GET /machine/ledStrip'
            ? ok({ ...LED_BODY }) : bad(500)));
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(await store.preview('sideStrip', 'awake', '#ffaa55'), false);
        assert.equal(await store.preview('frontStrip', 'dozing', '#ffaa55'), false);
        assert.equal(await store.power(true, 'awake', ['sideStrip']), false);
        assert.equal(await store.power(true, 'awake', []), false);
        assert.equal(store.get().refusal, LED_REFUSAL.BAD_TARGET);
        assert.equal(transport.calls.filter((call) => call.method !== 'GET').length, 0);
    });

    test('POWER FOLLOWS THE SELECTED ZONE — the rear strip is not the front’s business', async () => {
        const { store } = slowStore();
        await store.load();
        const front = ['frontStrip', 'frontSwitch'];

        assert.equal(await store.power(false, 'awake', front), true);
        assert.equal(store.hex('frontStrip', 'awake'), '#000000');
        assert.equal(store.hex('frontSwitch', 'awake'), '#000000');
        assert.equal(store.hex('backStrip', 'awake'), ledColour16ToHex8(LED_BODY.backStrip.awake),
            'Power off beside "Front" darkened the rear strip');
        assert.equal(store.hex('frontStrip', 'sleeping'), ledColour16ToHex8(LED_BODY.frontStrip.sleeping),
            'and the other bank is not the switch’s business either');

        assert.equal(store.isOn('awake', front), false);
        assert.equal(store.isOn('awake', ['backStrip']), true);
        assert.equal(store.isOn('awake', LED_ZONES), true);

        assert.equal(await store.power(true, 'awake', front), true);
        assert.equal(store.hex('frontStrip', 'awake'), ledColour16ToHex8(LED_BODY.frontStrip.awake));
    });

    test('Power previews too, on the zones it darkened and no others', async () => {
        const { store, previews } = slowStore();
        await store.load();
        await store.power(false, 'awake', ['frontStrip', 'frontSwitch']);
        await store.previewSettled();

        assert.equal(previews.length, 1, 'turning the strip off is something a person expects to SEE');
        assert.equal(previews[0].frontStrip, COLOUR16_OFF);
        assert.equal(previews[0].backStrip, undefined,
            'the rear strip was named in a body that had no business naming it');
    });

    test('Both is a real selection, and it is what turns everything off in one press', async () => {
        const { store, previews } = slowStore();
        await store.load();
        await store.power(false, 'awake', LED_ZONES);
        await store.previewSettled();
        for (const zone of LED_ZONES) assert.equal(store.hex(zone, 'awake'), '#000000');
        assert.deepEqual(Object.keys(previews[0]).sort(), ['backStrip', 'frontStrip'],
            'the front switch has no live register and cannot be previewed');
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

    test('the two volatile routes survive the 202 with a null body, and reset takes the state', async () => {
        const transport = transportOf(({ key, body }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') return ok({ ...body });
            if (key === 'POST /machine/ledStrip/preview'
                || key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            if (key === 'POST /machine/ledStrip/reset') return ok({ ...LED_BODY });
            return bad(500);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.previewSettled();
        assert.equal(store.get().previewing, true, 'a null body on a 2xx is success, not a decode failure');
        assert.equal(await store.commit(), true);
        assert.equal(await store.reset(), true);
        assert.equal(store.get().status, LED_STATUS.READY);

        assert.equal(transport.calls.filter((call) => call.path.endsWith('/ledStrip') && call.method === 'GET').length, 1);
    });

    test('a read issued before a Save cannot answer over it', async () => {
        let releaseGet = 'seed';
        const transport = transportOf(async ({ key, body }) => {
            if (key === 'GET /machine/ledStrip') {
                if (releaseGet === 'seed') { releaseGet = null; return ok({ ...LED_BODY }); }
                await new Promise((resolve) => { releaseGet = resolve; });
                return ok({ ...LED_BODY });
            }
            if (key === 'PUT /machine/ledStrip') return ok({ ...body });
            if (key === 'POST /machine/ledStrip/preview'
                || key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            return bad(503);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        assert.equal(store.hex('frontStrip', 'awake'), '#ffc180', 'the seeded palette');

        const reading = store.load();
        while (typeof releaseGet !== 'function') await new Promise((resolve) => { setTimeout(resolve, 1); });
        await store.preview('frontStrip', 'awake', '#00c2d1');
        assert.equal(await store.commit(), true, 'the PUT lands');

        releaseGet();
        await reading;

        assert.equal(store.hex('frontStrip', 'awake'), '#00c2d1',
            'an older read put back the palette the machine no longer holds');
        assert.equal(store.get().dirty, false);
    });

    test('a read does not clear the refusal of the write before it', async () => {
        const transport = transportOf(({ key }) => {
            if (key === 'GET /machine/ledStrip') return ok({ ...LED_BODY });
            if (key === 'PUT /machine/ledStrip') return bad(503, { error: 'busy' });
            if (key === 'POST /machine/ledStrip/preview'
                || key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            if (key === 'POST /machine/ledStrip/reset') return ok({ ...LED_BODY });
            return bad(500);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#112233');
        await store.commit();
        assert.equal(store.get().refusal, LED_REFUSAL.WRITE_FAILED);

        await store.load();
        assert.equal(store.get().refusal, LED_REFUSAL.WRITE_FAILED,
            'a leaf re-entry erased the one reason the person can act on');

        assert.equal(await store.reset(), true);
        assert.equal(store.get().refusal, null);
    });

    test('a read that is discarded puts back the status it displaced', async () => {
        let releaseGet = 'seed';
        let releasePut = null;
        const transport = transportOf(async ({ key, body }) => {
            if (key === 'GET /machine/ledStrip') {
                if (releaseGet === 'seed') { releaseGet = null; return ok({ ...LED_BODY }); }
                await new Promise((resolve) => { releaseGet = resolve; });
                return ok({ ...LED_BODY });
            }
            if (key === 'PUT /machine/ledStrip') {
                await new Promise((resolve) => { releasePut = resolve; });
                return ok({ ...body });
            }
            if (key === 'POST /machine/ledStrip/preview'
                || key === 'POST /machine/ledStrip/preview/clear') {
                return reaSuccess({ status: 202, data: null, method: 'POST', url: 'test' });
            }
            return bad(503);
        });
        const store = createLedStripStore({ transport });
        await store.load();
        await store.preview('frontStrip', 'awake', '#00c2d1');
        await store.previewSettled();

        const saving = store.commit();
        while (typeof releasePut !== 'function') await new Promise((resolve) => { setTimeout(resolve, 1); });

        const reading = store.load();
        while (typeof releaseGet !== 'function') await new Promise((resolve) => { setTimeout(resolve, 1); });
        assert.equal(store.get().status, LED_STATUS.LOADING, 'the spinner is owed while the GET is out');

        releasePut();
        assert.equal(await saving, true);
        releaseGet();
        await reading;

        assert.equal(store.get().status, LED_STATUS.READY,
            'a discarded read left the leaf saying the lighting cannot be read');
        assert.equal(store.hex('frontStrip', 'awake'), '#00c2d1',
            'and the palette on the page is still the one the machine was given');
    });

    test('a machine that goes away takes the preview slot with it', async () => {
        const { store, previews, previewParked, state } = slowStore();
        await store.load();
        state.holdPreview = true;
        void store.preview('frontStrip', 'awake', '#ff2200');
        void store.preview('frontStrip', 'awake', '#00c2d1');

        store.forget();
        previewParked.shift()();
        state.holdPreview = false;
        await store.previewSettled();

        assert.equal(previews.length, 1, 'a frame was posted at whatever machine answers next');
        assert.equal(store.get().previewing, false);
        assert.equal(store.get().strip, null);
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

describe('the load-cell wizard is a thin client over the machine’s own state', () => {
    function calStore(script) {
        const transport = transportOf(script);
        return { store: createCalibrationStore({ transport, setTimer: () => null, clearTimer: () => {} }), transport };
    }

    const IDLE = { step: 'idle', detectedCell: 'none', subState: 'settling', secondsRemaining: 0, status: 'none' };

    test('the commands are the machine’s three and the body key is its own', async () => {
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

        const wired = [...leaf.matchAll(/command:\s*'([a-z]+)'/g)].map((m) => m[1]);
        assert.deepEqual([...new Set(wired)].sort(), ['abort', 'latch', 'zero'],
            'the only commands the wizard can send are the three the handler declares');
    });

    test('the latch weight comes from THE ONE TABLE, and is not typed on the leaf', () => {
        const limits = limitsFor('bengle');
        assert.equal(hasLimit(limits, 'calibrationWeight'), true);
        assert.deepEqual(limits.calibrationWeight, { min: 50, max: 2000, step: 1, unit: 'g' });
        /* de1handler.dart:290-301 declares exactly this pair; nothing on the leaf repeats
         * it, which is the whole of /R2 at this row. */
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        assert.doesNotMatch(leaf, /2000/, 'the leaf must not carry the ceiling');
        assert.doesNotMatch(leaf, /min:\s*50\b/, 'nor the floor');
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

    test('a half that fails makes the whole write false, and staged intents are not cleared', async () => {
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
        for (const path of ['src/stores/skins-store.js']) {
            assert.doesNotMatch(CODE[path], /updateAvailable/, `${path} invents a verdict nothing serves`);
        }
    });

    test('the skin writes live in the store, and the install-from-URL route is untouched', () => {
        const code = Object.values(CODE).join('\n');
        assert.doesNotMatch(code, /postWebuiSkinsInstallUrl/,
            'installing from a typed URL is how a tablet serves something nobody vetted');

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

    test('the Reload after a switch goes to the host entry point, not to this origin', () => {
        const leaf = CODE['src/screens/settings-bespoke-leaf.js'];
        assert.match(leaf, /hostEntryUrl\(/, 'nothing on the Skin page uses the entry point');
        assert.match(leaf, /hostServesThisPage\(/,
            'the entry point is used unconditionally — a skin the host did not serve has none');
    });

    test('the sentence above the tiles no longer promises a reload that does not happen', () => {
        assert.equal(SOURCE['src/screens/settings-bespoke-leaf.js'].includes('The screen reloads itself.'),
            false, 'the page still promises an automatic reload it does not perform');
    });
});

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
        localIp: '192.0.2.10',
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

describe('shortDate: a stamp, "never", and a string that is not a date', () => {
    test('a served ISO timestamp becomes a day and a short month', () => {
        const text = shortDate('2026-08-12T05:59:27.904910Z', 'en');
        assert.match(text, /12/);
        assert.match(text, /Aug/);
    });

    test('an unparseable string is null — never a guess and never today', () => {
        assert.equal(shortDate('nonsense'), null);
        assert.equal(shortDate(''), null);
        assert.equal(shortDate(null), null);
        assert.equal(shortDate(undefined), null);
        assert.equal(shortDate(1755000000000), null, 'a number is not the served shape');
    });

    test('the module owns a DATE and wall-clock.js still owns the time of day', () => {
        assert.doesNotMatch(stripComments(read('src/lib/wall-clock.js')), /shortDate/);
        assert.doesNotMatch(stripComments(read('src/lib/short-date.js')), /hourCycle|CLOCK_FORMAT/);
    });

    test('shortDateTime adds the time, and takes MILLISECONDS because its caller holds seconds', () => {
        const text = shortDateTime(Date.UTC(2026, 7, 12, 5, 59), 'en-GB');
        assert.match(text, /12/);
        assert.match(text, /Aug/);
        assert.match(text, /\d{2}:\d{2}/, 'a conversation needs the time, not just the day');
    });

    test('shortDateTime refuses anything that is not a finite number of milliseconds', () => {
        assert.equal(shortDateTime('2026-08-12T05:59:27Z'), null, 'a string is not the shape this takes');
        assert.equal(shortDateTime(Number.NaN), null);
        assert.equal(shortDateTime(null), null);
        assert.equal(shortDateTime(undefined), null);
    });
});

describe('plugin-pages: the destination lives where a screen AND a store can both read it', () => {
    test('the DYE2 pair is the manifest\'s own spelling', () => {
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

        assert.ok(!http.includes('ui'),
            'if DYE2 grows a `ui` endpoint, the Plugins page can find its own front door and this pair '
            + 'should be re-argued rather than kept');
    });

    test('the store does not declare it, because the screen that needs it may not import a store', () => {
        const store = stripComments(read('src/stores/plugins-store.js'));
        assert.doesNotMatch(store, /DYE2_PLUGIN|dye2\.reaplugin/,
            'a constant a Live skeleton file must read cannot be declared in src/stores/');
        const screen = stripComments(read('src/screens/live-screen.js'));
        assert.match(screen, /from 'src\/lib\/plugin-pages\.js'/);
    });
});

describe('bespoke-leaves-nine: TWENTY, named, and each one a leaf the tree has', () => {
    const BESPOKE_IDS = Object.keys(BESPOKE_LEAVES);
    const LEAF = SOURCE['src/screens/settings-bespoke-leaf.js'];
    const LEAF_CODE = CODE['src/screens/settings-bespoke-leaf.js'];

    test('the registry declares TWENTY bespoke leaves', () => {
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
        assert.doesNotMatch(LEAF_CODE, /ui-settings-row/, 'a second row shape here is a block');
        assert.doesNotMatch(LEAF_CODE, /<h2/, 'the one leaf heading is <settings-leaf>’s');
        assert.doesNotMatch(LEAF_CODE, /leaf-heading/);
    });

    test('every component composed is on the 57-item inventory', () => {
        const composed = new Set([...LEAF_CODE.matchAll(/<(ui-[a-z-]+)/g)].map((m) => m[1]));
        const inventory = new Set([
            'ui-card', 'ui-card-grid', 'ui-definition-card', 'ui-tile-grid', 'ui-wizard-column',

            'ui-select',
            'ui-colour-swatch-row', 'ui-slider', 'ui-progress-track', 'ui-empty-state',
            'ui-bank', 'ui-button', 'ui-stepper',

            'ui-switch',

            'ui-file-button',

            'ui-colour-wheel',

            'ui-dialog', 'ui-time-picker', 'ui-list-row', 'ui-confirm-dialog',
            'ui-text-field', 'ui-notes-editor', 'ui-status-chip', 'ui-keycap',

            'ui-numeric-keypad',

            'ui-badge',

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

    test('not one of the three dead measures is spelled in this cluster', () => {
        for (const [path, code] of Object.entries(CODE)) {
            for (const dead of [/\b885\b/, /\b1200px\b/, /\b760px\b/, /\b1263\b/]) {
                assert.doesNotMatch(code, dead, `${path} carries a dead measure`);
            }
        }

        const capped = [...LEAF_CODE.matchAll(/max-inline-size:\s*([^;]+);/g)].map((m) => m[1].trim());

        assert.ok(capped.length > 0, 'the prose measure vanished — this guard now checks nothing');
        assert.deepEqual([...new Set(capped)], ['var(--ui-measure)'],
            'the only measure a section may name is the PROSE one; the leaf measure is the pane’s');

        const sized = [...LEAF_CODE.replace(/\bsize="\d+"/g, '')
            .matchAll(/(?:^|\s)(inline-size|width|max-width):\s*([^;]+);/g)]
            .map((m) => `${m[1]}: ${m[2].trim()}`);

        assert.deepEqual(sized, [
            'inline-size: 100%',
            'inline-size: var(--_ui-form-control-w)',
            'inline-size: var(--_ui-thumb-size)',
            'inline-size: 100%',
            'inline-size: var(--_ui-thumb-size)',
        ], 'a language tile, form control, image card, fitted picture and fixed thumbnail');

        assert.match(LEAF_CODE, /--_ui-lighting-col-min:\s*420px/);
        assert.match(LEAF_CODE, /repeat\(auto-fit, minmax\(min\(var\(--_ui-lighting-col-min\), 100%\), 1fr\)\)/);
    });

    test('the three gated leaves ask before they render AND before they read', () => {
        for (const capability of ['ledStrip', 'scaleCalibration', 'wakeSchedule']) {
            assert.match(LEAF_CODE, new RegExp(`#allowed\\('${capability}'\\)`), `${capability} is not gated`);
        }
        /* FAIL-CLOSED IS ONE EXPRESSION AND IT IS PRESENT-ONLY, so ABSENT and UNKNOWN
         * both close the surface — and so does having no capability store at all. */
        const model = stripComments(read('src/screens/settings-model.js'));
        assert.match(model, /capability\(capability\) === CAPABILITY\.PRESENT/);
        assert.match(model, /: false/, 'no capability store is UNKNOWN, not open');

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

    test('the capability answer is a state, not a one-shot verdict: the leaf subscribes to it', () => {
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

describe('the pill dissolved into the row, and the screen is the confirmation', () => {
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

    test('the brightness control is a SLIDER and no toggle', () => {
        const row = SETTINGS_ROWS.find((entry) => entry.id === 'display-screen-brightness');
        assert.ok(row, 'the brightness row is in the registry');
        assert.equal(row.archetype, ARCHETYPE.SLIDER);
        assert.notEqual(row.archetype, ARCHETYPE.SWITCH, 'never a switch, and never a pill');

        const renderer = stripComments(read('src/screens/settings-leaf.js'));
        assert.match(renderer, /case ARCHETYPE\.SLIDER:/);
        assert.match(renderer, /<ui-slider/);
    });

    test('#29 names a switch because there is no wrapper between them — why the retirement is SAFE', () => {
        const row = stripComments(read('src/components/ui-settings-row.js'));
        assert.match(row, /assignedElements\(\{\s*flatten:\s*true\s*\}\)/,
            'the naming walk is over assigned elements, which do not include a child’s shadow root');
    });
});

describe('every route this cluster calls has a row, and the row names this caller', () => {
    const rest = new Map(CONTRACTS.rest.map((row) => [row.id, row]));

    const ADOPTED = [
        'getMachineLedStrip', 'putMachineLedStrip', 'postMachineLedStripPreview',
        'postMachineLedStripPreviewClear',
        'postMachineLedStripReset', 'getMachineScaleCalibration', 'putMachineScaleCalibration',
        'getMachineCalibration', 'postMachineCalibration', 'getWebuiSkins', 'getWebuiSkinsDefault',
    ];

    test('all eleven are `consumed` and pinned at the table’s own commit', () => {
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

    test('the preview pair is no longer excluded, and the keeping step is no longer consumed', () => {
        const excluded = read('src/data/EXCLUDED.md');
        assert.match(excluded, /ledStrip\/preview/);
        assert.match(excluded, /REMOVED at the re-pin/);

        const commit = rest.get('postMachineLedStripCommit');
        assert.equal(commit.status, 'recorded');
        assert.deepEqual(commit.consumedBy, []);
        for (const [path, code] of Object.entries(CODE)) {
            assert.doesNotMatch(code, /postMachineLedStripCommit/, `${path} still posts the keeping step`);
        }
    });
});

describe('the flow-calibration factor is a plain row on #29', () => {
    test('it is a stepper on a leaf that is NOT one of the nine', () => {
        const row = SETTINGS_ROWS.find((r) => r.id === 'calibration-flow-multiplier-factor');
        assert.ok(row, 'D9 asks for the factor to be exposed');
        assert.equal(row.archetype, 'stepper');
        assert.equal(row.leaf, 'calibration-flow-multiplier');
        assert.equal(leafKind(row.leaf), LEAF_KIND.PRIMITIVE,
            'a tenth bespoke leaf for one number would be the one-primitive claim leaking');
    });

    test('it is BOUNDED by a declared row, and the row is in the one table', () => {
        const row = SETTINGS_ROWS.find((r) => r.id === 'calibration-flow-multiplier-factor');
        assert.equal(row.limit, 'flowCalibration', 'it names a row in the limits table');
        assert.equal(hasLimit(limitsFor('bengle'), 'flowCalibration'), true);
        assert.equal(hasLimit(limitsFor('bengle'), 'flowMultiplier'), false,
            'and the field name is still not a limits key — the ROW name is');
    });
});
