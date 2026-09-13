import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreensaverImages, createScreensaverPlaylist, SCREENSAVER_IMAGE_LIMIT } from '../src/lib/screensaver-images.js';
import { inspectScreensaverFile } from '../src/components/screensaver-image-io.js';

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const image = (name) => ({ name, url: `image:${name}`, ok: true });
function fixture(initial = [], hooks = {}) {
    let stored = [...initial];
    const writes = [];
    const controller = createScreensaverImages({
        read: () => stored,
        write: async (next) => { writes.push([...next]); if (hooks.write && !await hooks.write(next)) return { ok: false }; stored = [...next]; return { ok: true }; },
        inspect: async (file, options) => hooks.inspect ? hooks.inspect(file, options) : file,
        verify: async (url) => !url.startsWith('bad:'),
    });
    return { controller, writes, stored: () => stored, external: (next) => { stored = [...next]; return controller.refresh(); } };
}

test('adding mixed files retains current valid slides and accounts for every offered file', async () => {
    const f = fixture(['image:old']);
    await f.controller.refresh();
    await f.controller.add([image('new'), { name: 'broken.png', ok: false, reason: 'unreadable' }, { name: 'notes.txt', ok: false, reason: 'not-image' }]);
    assert.deepEqual(f.stored(), ['image:old', 'image:new']);
    assert.equal(f.controller.get().active, 2);
    assert.deepEqual(f.controller.get().outcome.files.map((file) => file.status), ['added', 'unreadable', 'not-image']);
});

test('the capacity counts decoded active images and reports overflow separately from unreadable and non-image files', async () => {
    const f = fixture(['bad:legacy']);
    await f.controller.refresh();
    const files = [...Array.from({ length: 15 }, (_, index) => image(String(index))),
        { name: 'broken.png', reason: 'unreadable' }, { name: 'document.pdf', reason: 'not-image' }];
    await f.controller.add(files);
    assert.equal(f.controller.get().active, SCREENSAVER_IMAGE_LIMIT);
    assert.equal(f.stored().length, 13, 'the legacy unreadable URL is preserved until explicitly removed');
    assert.equal(f.controller.get().outcome.files.filter((file) => file.status === 'capacity').length, 3);
    assert.equal(f.controller.get().outcome.files.filter((file) => file.status === 'unreadable').length, 1);
    assert.equal(f.controller.get().outcome.files.filter((file) => file.status === 'not-image').length, 1);
    const count = f.writes.length;
    await f.controller.add([image('overfull')]);
    assert.equal(f.writes.length, count, 'an overfull pick does not rewrite or displace current slides');
});

test('replacement failures keep the original and success replaces only that stable image', async () => {
    const f = fixture(['image:a', 'image:b']);
    await f.controller.refresh();
    const id = f.controller.get().images[0].id;
    await f.controller.replace(id, [{ name: 'broken.png', reason: 'unreadable' }]);
    assert.deepEqual(f.stored(), ['image:a', 'image:b']);
    assert.equal(f.controller.get().outcome.files[0].targetId, id);
    await f.controller.replace(id, [image('replacement')]);
    assert.deepEqual(f.stored(), ['image:replacement', 'image:b']);
    assert.equal(f.controller.get().images[0].id, id);
    await f.controller.remove(id);
    assert.deepEqual(f.stored(), ['image:b']);
});

test('an unreadable selection tile can be replaced or dismissed without affecting active images', async () => {
    const f = fixture(['image:a']);
    await f.controller.add([{ name: 'broken.png', reason: 'unreadable' }]);
    const id = f.controller.get().outcome.files[0].id;
    await f.controller.replace(id, [image('fixed')]);
    assert.deepEqual(f.stored(), ['image:a', 'image:fixed']);
    await f.controller.add([{ name: 'other.png', reason: 'unreadable' }]);
    await f.controller.remove(f.controller.get().outcome.files[0].id);
    assert.equal(f.controller.get().outcome.files.length, 0);
    assert.deepEqual(f.stored(), ['image:a', 'image:fixed']);
});

test('storage refusal leaves the confirmed list intact for add, replace, remove and clear', async () => {
    const f = fixture(['image:a'], { write: async () => false });
    await f.controller.refresh();
    const id = f.controller.get().images[0].id;
    for (const operation of [() => f.controller.add([image('b')]), () => f.controller.replace(id, [image('b')]), () => f.controller.remove(id), () => f.controller.clear()]) {
        await operation();
        assert.deepEqual(f.stored(), ['image:a']);
        assert.equal(f.controller.get().outcome.failure, 'storage');
        assert.equal(f.controller.get().active, 1);
    }
});

test('overlapping additions and replacements serialize without dropping earlier valid results', async () => {
    const wait = deferred();
    const f = fixture(['image:a'], { inspect: async (file) => { if (file.name === 'slow') await wait.promise; return file; } });
    await f.controller.refresh();
    const first = f.controller.add([image('slow')]);
    const second = f.controller.add([image('fast')]);
    wait.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(f.stored(), ['image:a', 'image:slow', 'image:fast']);
    const id = f.controller.get().images[0].id;
    await Promise.all([f.controller.replace(id, [image('one')]), f.controller.replace(id, [image('two')])]);
    assert.deepEqual(f.stored(), ['image:two', 'image:slow', 'image:fast']);
});

test('clear cancels earlier decoding and wins after an already-started storage write', async () => {
    const wait = deferred(), entered = deferred();
    const f = fixture(['image:a'], { inspect: async (file) => { entered.resolve(); await wait.promise; return file; } });
    const pick = f.controller.add([image('slow')]);
    await entered.promise;
    const clear = f.controller.clear();
    wait.resolve();
    await Promise.all([pick, clear]);
    assert.deepEqual(f.stored(), []);
    const write = deferred(), started = deferred();
    const g = fixture(['image:a'], { write: async () => { started.resolve(); await write.promise; return true; } });
    const add = g.controller.add([image('b')]);
    await started.promise;
    const cleared = g.controller.clear();
    write.resolve();
    await Promise.all([add, cleared]);
    assert.deepEqual(g.stored(), []);
});

test('a removed target is not resurrected by a queued replacement', async () => {
    const f = fixture(['image:a']);
    await f.controller.refresh();
    const id = f.controller.get().images[0].id;
    await Promise.all([f.controller.remove(id), f.controller.replace(id, [image('new')])]);
    assert.deepEqual(f.stored(), []);
    assert.equal(f.controller.get().outcome.failure, 'target-gone');
});

test('the playlist skips unreadable legacy URLs, keeps valid slides and stops its timer', async () => {
    const painted = [], timers = new Map(); let next = 0;
    const p = createScreensaverPlaylist({ paint: (url) => painted.push(url), fallback: 'built-in', verify: async (url) => url !== 'bad',
        setTimer: (tick) => { timers.set(++next, tick); return next; }, clearTimer: (id) => timers.delete(id) });
    p.setMode(true);
    await p.setImages(['bad', 'one', 'two']);
    assert.ok(!painted.includes('bad'));
    assert.equal(painted.at(-1), 'one');
    [...timers.values()][0]();
    assert.equal(painted.at(-1), 'two');
    p.reject('two');
    await p.settled();
    assert.equal(painted.at(-1), 'one');
    assert.equal(timers.size, 0);
    await p.setImages(['bad']);
    assert.equal(painted.at(-1), 'built-in');
    p.stop();
    assert.equal(painted.at(-1), '');
});

test('late playlist validation cannot replace a newer selection', async () => {
    const wait = deferred(), painted = [];
    const p = createScreensaverPlaylist({ paint: (url) => painted.push(url), fallback: 'built-in', verify: async (url) => { if (url === 'old') await wait.promise; return true; } });
    p.setMode(true);
    const old = p.setImages(['old']);
    await p.setImages(['new']);
    wait.resolve(); await old;
    assert.equal(painted.at(-1), 'new');
    assert.ok(!painted.includes('old'));
    p.stop();
});

test('existing per-file byte and edge safeguards remain distinct from unreadable-image failures', async () => {
    class Reader { readAsDataURL(file) { this.result = file.url; queueMicrotask(() => this.onload?.()); } abort() {} }
    class Image { set src(value) { this.naturalWidth = value === 'wide' ? 5000 : 10; this.naturalHeight = 10; queueMicrotask(() => this.onload?.()); } }
    const view = { FileReader: Reader, Image };
    assert.equal((await inspectScreensaverFile(view, { type: 'image/png', size: 5 * 1024 * 1024 })).reason, 'file-too-large');
    assert.equal((await inspectScreensaverFile(view, { type: 'image/png', size: 100, url: 'wide' })).reason, 'image-too-large');
    assert.equal((await inspectScreensaverFile(view, { type: 'text/plain', size: 100 })).reason, 'not-image');
    assert.equal((await inspectScreensaverFile(view, { type: 'image/png', size: 0 })).reason, 'unreadable');
    assert.equal((await inspectScreensaverFile(view, { type: 'image/png', size: 100, url: 'valid' })).ok, true);
});

test('failed clear restarts aborted legacy validation and later operations still settle', async () => {
    let calls = 0;
    const c = createScreensaverImages({ read: () => ['image:old'], write: async () => false, inspect: async (file) => file,
        verify: async (_url, { signal }) => {
            calls += 1;
            if (calls > 1) return true;
            return new Promise((resolve) => signal.addEventListener('abort', () => resolve(false), { once: true }));
        } });
    void c.refresh();
    await c.clear();
    assert.equal(c.get().active, 1);
    assert.equal(c.get().checking, false);
    assert.equal(c.get().outcome.failure, 'storage');
    await c.add([image('new')]);
    assert.equal(c.get().busy, false);
    assert.equal(c.get().active, 1);
});

test('an accepted write with a different readback is not reported as saved', async () => {
    const c = createScreensaverImages({ read: () => ['image:old'], write: async () => true, inspect: async (file) => file, verify: async () => true });
    const result = await c.add([image('new')]);
    assert.equal(result.ok, false);
    assert.equal(c.get().outcome.failure, 'unconfirmed');
    assert.equal(c.get().outcome.files[0].status, 'not-saved');
    assert.deepEqual(c.get().images.map((entry) => entry.url), ['image:old']);
});

test('replacing a legacy valid but inactive image cannot bypass the active limit', async () => {
    const f = fixture(Array.from({ length: 13 }, (_, index) => `image:${index}`));
    await f.controller.refresh();
    const inactive = f.controller.get().images.find((entry) => entry.status === 'capacity');
    const result = await f.controller.replace(inactive.id, [image('new')]);
    assert.equal(result.ok, false);
    assert.equal(f.writes.length, 0);
    assert.equal(f.controller.get().outcome.files[0].status, 'capacity');
    assert.equal(f.controller.get().active, 12);
});

test('unresolved failed tiles survive later additions and removals until replaced or dismissed', async () => {
    const f = fixture(['image:a']);
    await f.controller.add([{ name: 'broken.png', reason: 'unreadable' }]);
    const issue = f.controller.get().issues[0];
    await f.controller.add([image('b')]);
    assert.equal(f.controller.get().issues[0].id, issue.id);
    await f.controller.remove(f.controller.get().images[0].id);
    assert.equal(f.controller.get().issues[0].id, issue.id);
    await f.controller.replace(issue.id, [image('fixed')]);
    assert.equal(f.controller.get().issues.length, 0);
    assert.deepEqual(f.stored(), ['image:b', 'image:fixed']);
});

test('progress distinguishes current file inspection from the storage write', async () => {
    const reading = [deferred(), deferred()], entered = [deferred(), deferred()], saving = deferred(), finishSave = deferred();
    let index = 0;
    const f = fixture([], {
        inspect: async (file) => { const current = index++; entered[current].resolve(); await reading[current].promise; return file; },
        write: async () => { saving.resolve(); await finishSave.promise; return true; },
    });
    const operation = f.controller.add([image('one'), image('two')]);
    await entered[0].promise;
    assert.equal(f.controller.get().outcome.phase, 'reading');
    assert.equal(f.controller.get().outcome.reading, 1);
    reading[0].resolve(); await entered[1].promise;
    assert.equal(f.controller.get().outcome.reading, 2);
    reading[1].resolve(); await saving.promise;
    assert.equal(f.controller.get().outcome.phase, 'saving');
    assert.equal(f.controller.get().active, 0, 'decoding does not prematurely publish unsaved slides');
    finishSave.resolve(); await operation;
    assert.equal(f.controller.get().active, 2);
});
