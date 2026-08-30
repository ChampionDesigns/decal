
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLogger, createConsoleSink, LEVELS, DEFAULT_TAG, logger as sharedLogger } from '../src/lib/logger.js';

function recordingSink() {
    const records = [];
    const sink = (record) => records.push(record);
    sink.records = records;
    return sink;
}

function fakeConsole() {
    const calls = [];
    return {
        calls,
        debug: (...a) => calls.push(['debug', ...a]),
        info: (...a) => calls.push(['info', ...a]),
        warn: (...a) => calls.push(['warn', ...a]),
        error: (...a) => calls.push(['error', ...a]),
        log: (...a) => calls.push(['log', ...a]),
    };
}

test('levels gate: at info, debug is dropped and the rest pass', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'info', sinks: [sink] });
    log.debug('dropped');
    log.info('kept');
    log.warn('kept');
    log.error('kept');
    assert.deepEqual(sink.records.map((r) => r.level), ['info', 'warn', 'error']);
});

test('setLevel moves the threshold in both directions', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'error', sinks: [sink] });
    log.warn('dropped');
    log.setLevel('debug');
    log.debug('kept');
    log.setLevel('silent');
    log.error('dropped too');
    assert.deepEqual(sink.records.map((r) => r.level), ['debug']);
    assert.equal(log.getLevel(), 'silent');
});

test('DESTRUCTURING IS SAFE — the bug that made this a rewrite rather than a port', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'info', sinks: [sink] });
    const { debug } = log;
    debug('before');                       // gated out, but the SAME function object
    log.setDebug(true);
    debug('after');                        // must now be emitted
    assert.deepEqual(sink.records.map((r) => r.args[0]), ['after']);
    assert.equal(debug, log.debug, 'the method must be stable for the logger\'s lifetime');
});

test('setDebug(false) returns to info, not to silence', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'debug', sinks: [sink] });
    log.setDebug(false);
    log.debug('dropped');
    log.info('kept');
    assert.deepEqual(sink.records.map((r) => r.level), ['info']);
});

test('isEnabled guards expensive message construction', () => {
    const log = createLogger({ level: 'warn', sinks: [recordingSink()] });
    assert.equal(log.isEnabled('debug'), false);
    assert.equal(log.isEnabled('warn'), true);
    assert.equal(log.isEnabled('error'), true);
});

test('an unknown level is a mistake, not a silent default', () => {
    assert.throws(() => createLogger({ level: 'chatty' }), /unknown level 'chatty'/);
    assert.throws(() => createLogger().setLevel('loud'), /unknown level 'loud'/);
});

test('records carry level, tag, args and a time from the injected clock', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'debug', sinks: [sink], now: () => 1234 });
    const error = new Error('boom');
    log.error('write failed', error, { key: 'theme' });
    assert.deepEqual(sink.records[0], {
        level: 'error',
        tag: DEFAULT_TAG,
        args: ['write failed', error, { key: 'theme' }],
        time: 1234,
    });
});

test('the console sink calls the matching console method, tagged for provenance', () => {
    const target = fakeConsole();
    const log = createLogger({ level: 'debug', console: target });
    log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
    assert.deepEqual(target.calls, [
        ['debug', '[Decal] [DEBUG]', 'd'],
        ['info', '[Decal] [INFO]', 'i'],
        ['warn', '[Decal] [WARN]', 'w'],
        ['error', '[Decal] [ERROR]', 'e'],
    ]);
});

test('a console without debug/info falls back to log', () => {
    const calls = [];
    const sink = createConsoleSink({ log: (...a) => calls.push(a) });
    sink({ level: 'debug', tag: 'Decal', args: ['x'], time: 0 });
    assert.deepEqual(calls, [['[Decal] [DEBUG]', 'x']]);
    assert.doesNotThrow(() => createConsoleSink(null)({ level: 'info', tag: 't', args: [], time: 0 }));
});

test('scopes tag the source and share the parent level and sinks', () => {
    const sink = recordingSink();
    const log = createLogger({ level: 'info', sinks: [sink] });
    const storage = log.scope('storage');
    const kv = storage.scope('kv');
    storage.info('one');
    kv.info('two');
    // Nesting composes, so a line says where it came from all the way down.
    assert.deepEqual(sink.records.map((r) => r.tag), ['Decal:storage', 'Decal:storage:kv']);
    // A level set anywhere applies everywhere: one switch at boot, not one per module.
    storage.setLevel('error');
    log.info('dropped');
    kv.info('dropped');
    assert.equal(sink.records.length, 2);
});

test('sinks can be added and removed at runtime', () => {
    const first = recordingSink();
    const second = recordingSink();
    const log = createLogger({ level: 'info', sinks: [first] });
    const off = log.addSink(second);
    log.info('both');
    off();
    log.info('first only');
    assert.equal(first.records.length, 2);
    assert.equal(second.records.length, 1);
    assert.equal(log.sinkCount(), 1);
});

test('a throwing sink cannot take the caller down or block the others', () => {
    const good = recordingSink();
    const log = createLogger({ level: 'info', sinks: [() => { throw new Error('sink exploded'); }, good] });
    assert.doesNotThrow(() => log.info('still delivered'));
    assert.equal(good.records.length, 1);
});

test('the shared instance exists, starts quiet, and is wired by the composition root', () => {
    assert.equal(sharedLogger.getLevel(), 'info');
    assert.equal(sharedLogger.sinkCount(), 0);
    const sink = recordingSink();
    const off = sharedLogger.addSink(sink);
    sharedLogger.info('hello');
    off();
    assert.equal(sink.records.length, 1);
    assert.equal(sharedLogger.sinkCount(), 0);
});

test('level values are ordered and silent is above error', () => {
    assert.ok(LEVELS.debug < LEVELS.info);
    assert.ok(LEVELS.info < LEVELS.warn);
    assert.ok(LEVELS.warn < LEVELS.error);
    assert.ok(LEVELS.error < LEVELS.silent);
});
