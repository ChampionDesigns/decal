import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { WEATHER_MAX_ATTEMPTS, createWeatherStore } from '../src/stores/weather-store.js';
import { WEATHER_STATE, weatherState } from '../src/lib/weather-model.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';

const MINUTE = 60000;

function fakeSockets() {
    const opened = [];
    let listener = null;
    let released = 0;
    return {
        opened,
        released: () => released,
        send: (frame) => { if (listener) listener(frame); },
        channel(spec) {
            opened.push(spec);
            return {
                subscribe(fn) {
                    listener = fn;
                    return () => { released += 1; listener = null; };
                },
            };
        },
    };
}

function fakeClock() {
    let at = 0;
    let seq = 0;
    const pending = new Map();
    return {
        now: () => at,
        setTimer(fn, ms) { seq += 1; pending.set(seq, { fn, due: at + ms }); return seq; },
        clearTimer(id) { pending.delete(id); },
        pending: () => pending.size,
        advance(ms) {
            at += ms;
            for (const [id, t] of [...pending].sort((a, b) => a[1].due - b[1].due)) {
                if (t.due <= at) { pending.delete(id); t.fn(); }
            }
        },
    };
}

const reading = (patch = {}) => ({
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 0,
    isDay: true, code: 2, temperature: 21.4, units: 'metric', periods: [],
    ...patch,
});

function rig() {
    const sockets = fakeSockets();
    const clock = fakeClock();
    const store = createWeatherStore({
        sockets, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    });
    return { sockets, clock, store };
}

describe('the weather store opens the plugin endpoint', () => {
    test('one channel, on the plugin endpoint row, giving up after three failed opens', () => {
        const { sockets, store } = rig();
        store.attach();
        assert.equal(sockets.opened.length, 1);
        const [spec] = sockets.opened;
        assert.equal(spec.path, '/ws/v1/plugins/weather.reaplugin/weather');
        assert.equal(spec.channel, WS_CHANNELS.pluginEndpoint);
        assert.equal(spec.maxAttempts, 3);
        assert.equal(WEATHER_MAX_ATTEMPTS, 3);
    });

    test('a second attach opens nothing more', () => {
        const { sockets, store } = rig();
        store.attach();
        store.attach();
        assert.equal(sockets.opened.length, 1);
    });

    test('without a socket layer it holds nothing and does not throw', () => {
        const store = createWeatherStore();
        store.attach();
        assert.equal(store.get(), null);
    });

    test('detach lets the channel go, once', () => {
        const { sockets, store } = rig();
        store.attach();
        store.detach();
        store.detach();
        assert.equal(sockets.released(), 1);
    });
});

describe('the weather store holds the last frame', () => {
    test('a frame is held as it came', () => {
        const { sockets, store } = rig();
        store.attach();
        const frame = reading({ temperature: 9 });
        sockets.send(frame);
        assert.deepEqual(store.get(), frame);
    });

    test('a frame that is not an object is dropped, and the last good one stays', () => {
        const { sockets, store } = rig();
        store.attach();
        sockets.send(reading({ temperature: 9 }));
        sockets.send('not a frame');
        sockets.send(null);
        assert.equal(store.get().temperature, 9);
    });

    test('a failed read replaces a good one', () => {
        const { sockets, store } = rig();
        store.attach();
        sockets.send(reading());
        sockets.send({ ok: false, reason: 'no_location' });
        assert.equal(weatherState(store.get()), WEATHER_STATE.PROMPT);
    });
});

describe('a reading still ages when its frames stop', () => {
    test('two hours after the fetch with no new frame, the reading is hidden', () => {
        const { sockets, clock, store } = rig();
        store.attach();
        sockets.send(reading({ ageMinutes: 100 }));
        clock.advance(20 * MINUTE);
        assert.equal(weatherState(store.get()), WEATHER_STATE.READING, 'at 120 minutes it still shows');
        clock.advance(1 * MINUTE);
        assert.equal(weatherState(store.get()), WEATHER_STATE.HIDDEN);
        assert.equal(store.get().ageMinutes, 121, 'the age it carries is its true age');
        assert.equal(store.get().temperature, 21.4, 'the rest of the reading is kept for the modal');
    });

    test('a newer frame starts the count again', () => {
        const { sockets, clock, store } = rig();
        store.attach();
        sockets.send(reading({ ageMinutes: 100 }));
        clock.advance(15 * MINUTE);
        sockets.send(reading({ ageMinutes: 0 }));
        clock.advance(30 * MINUTE);
        assert.equal(weatherState(store.get()), WEATHER_STATE.READING);
        assert.equal(store.get().ageMinutes, 0);
        assert.equal(clock.pending(), 1, 'one count runs, not one per frame');
    });

    test('a reading with no stated age counts from when it arrived', () => {
        const { sockets, clock, store } = rig();
        store.attach();
        sockets.send(reading({ ageMinutes: null }));
        clock.advance(121 * MINUTE);
        assert.equal(weatherState(store.get()), WEATHER_STATE.HIDDEN);
    });

    test('a failed read starts no count', () => {
        const { sockets, clock, store } = rig();
        store.attach();
        sockets.send({ ok: false, reason: 'no_location' });
        assert.equal(clock.pending(), 0);
    });

    test('detach stops the count', () => {
        const { sockets, clock, store } = rig();
        store.attach();
        sockets.send(reading());
        store.detach();
        assert.equal(clock.pending(), 0);
    });
});
