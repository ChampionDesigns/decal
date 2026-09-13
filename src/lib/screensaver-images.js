/**
 * The screensaver's image list and the slideshow that plays it: the stored limits, the
 * store that adds, removes and reorders the URLs, and the playlist that paints them in
 * turn and drops one the view cannot decode.
 */

export const SCREENSAVER_IMAGE_LIMIT = 12;
export const SCREENSAVER_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const SCREENSAVER_IMAGE_MAX_EDGE = 4096;

export const storedImageUrls = (value) => Array.isArray(value)
    ? value.filter((url) => typeof url === 'string' && url.trim() !== '')
    : [];
const sameUrls = (a, b) => a.length === b.length && a.every((url, index) => url === b[index]);
const accepted = (result) => result === true || result?.ok === true;

export function createScreensaverImages({ read, write, inspect, verify }) {
    const listeners = new Set();
    let entries = [], issues = [], outcome = null, expected = null, commitFailure = null;
    let nextId = 0, pending = 0, epoch = 0, generation = 0;
    let validation = Promise.resolve(), validationAbort = null, operationAbort = null;
    let queue = Promise.resolve();
    const state = () => {
        let active = 0;
        const images = entries.map((entry) => {
            const status = entry.valid === null ? 'checking' : !entry.valid ? 'unreadable'
                : active < SCREENSAVER_IMAGE_LIMIT ? 'active' : 'capacity';
            if (status === 'active') active += 1;
            return Object.freeze({ ...entry, status });
        });
        return Object.freeze({ images: Object.freeze(images), issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))), active, busy: pending > 0, checking: images.some((image) => image.status === 'checking'),
            outcome: outcome ? Object.freeze({ ...outcome, files: Object.freeze(outcome.files.map((file) => Object.freeze({ ...file }))) }) : null });
    };
    const publish = () => { const snapshot = state(); for (const listener of listeners) listener(snapshot); };

    function refresh() {
        const urls = storedImageUrls(read());
        if (sameUrls(urls, entries.map((entry) => entry.url))
            && !(validationAbort?.signal.aborted && entries.some((entry) => entry.valid === null))) return validation;
        validationAbort?.abort();
        validationAbort = new AbortController();
        const signal = validationAbort.signal, version = ++epoch;
        if (expected && sameUrls(urls, expected.map((entry) => entry.url))) entries = expected.map((entry) => ({ ...entry }));
        else {
            const previous = [...entries];
            entries = urls.map((url) => {
                const index = previous.findIndex((entry) => entry.url === url);
                return index >= 0 ? previous.splice(index, 1)[0] : { id: ++nextId, url, name: '', valid: null };
            });
        }
        publish();
        validation = (async () => {
            for (const entry of entries) {
                if (entry.valid !== null) continue;
                let valid = false;
                try { valid = accepted(await verify(entry.url, { signal })); } catch { /* unreadable */ }
                if (signal.aborted || version !== epoch) return;
                entry.valid = valid;
                publish();
            }
        })();
        return validation;
    }

    async function current(cancelled = () => false) {
        do {
            await refresh();
            if (cancelled()) return false;
        } while (entries.some((entry) => entry.valid === null));
        return true;
    }

    async function commit(next) {
        expected = next;
        let ok = false;
        try { ok = accepted(await write(next.map((entry) => entry.url))); } catch { /* keep confirmed images */ }
        const confirmed = ok && sameUrls(storedImageUrls(read()), next.map((entry) => entry.url));
        commitFailure = confirmed ? null : ok ? 'unconfirmed' : 'storage';
        if (confirmed) entries = next;
        expected = null;
        await refresh();
        return confirmed;
    }

    function enqueue(work, { supersede = false, validate = true } = {}) {
        if (supersede) { generation += 1; operationAbort?.abort(); validationAbort?.abort(); }
        const version = generation;
        pending += 1;
        publish();
        const result = queue.then(async () => {
            if (version !== generation) return { cancelled: true };
            const abort = new AbortController();
            operationAbort = abort;
            try {
                if (validate) await current(() => version !== generation);
                if (version !== generation) return { cancelled: true };
                return await work(abort.signal, () => version === generation);
            } finally { if (operationAbort === abort) operationAbort = null; }
        }).catch(() => {
            outcome = { files: [], failure: 'storage' };
            return { ok: false };
        }).finally(() => { pending -= 1; publish(); });
        queue = result.then(() => {});
        return result;
    }

    function pick(files, targetId = null) {
        const offered = Array.from(files ?? []);
        if (!offered.length) return Promise.resolve({ cancelled: true });
        return enqueue(async (signal, isCurrent) => {
            const results = [], additions = [];
            const issue = targetId === null ? null : issues.find((file) => file.id === targetId);
            const original = targetId === null ? null : entries.find((entry) => entry.id === (issue?.targetId ?? targetId));
            outcome = null;
            const replacing = targetId !== null;
            if (replacing && ((!original && !issue) || (issue?.targetId && !original))) {
                outcome = { files: [], failure: 'target-gone' };
                return { ok: false };
            }
            const originalActive = original && state().images.some((entry) => entry.id === original.id && entry.status === 'active');
            const capacity = originalActive ? 1 : Math.max(0, SCREENSAVER_IMAGE_LIMIT - state().active);
            for (let index = 0; index < offered.length; index += 1) {
                if (signal.aborted || !isCurrent()) return { cancelled: true };
                const file = offered[index], name = file?.webkitRelativePath || file?.name || '';
                outcome = { files: [...results], reading: index + 1, total: offered.length, phase: 'reading' };
                publish();
                let inspected;
                try { inspected = await inspect(file, { signal }); }
                catch { inspected = { ok: false, reason: 'unreadable' }; }
                if (signal.aborted || !isCurrent()) return { cancelled: true };
                const result = { id: `pick-${++nextId}`, name, status: inspected?.reason ?? 'unreadable', targetId: original?.id ?? null };
                if (inspected?.ok) {
                    if (additions.length < capacity && (!replacing || additions.length === 0)) {
                        result.status = replacing ? 'replaced' : 'added';
                        additions.push({ id: original?.id ?? ++nextId, url: inspected.url, name, valid: true, result });
                    } else result.status = replacing && additions.length ? 'not-used' : 'capacity';
                }
                results.push(result);
                outcome = { files: [...results], reading: index + 1, total: offered.length, phase: 'reading' };
                publish();
            }
            await current(() => signal.aborted || !isCurrent());
            if (signal.aborted || !isCurrent()) return { cancelled: true };
            const target = original && entries.find((entry) => entry.id === original.id);
            if (original && !target) {
                outcome = { files: results, failure: 'target-gone' };
                return { ok: false };
            }
            let next = [...entries];
            const targetActive = target && state().images.some((entry) => entry.id === target.id && entry.status === 'active');
            const free = targetActive ? 1 : Math.max(0, SCREENSAVER_IMAGE_LIMIT - state().active);
            const usable = additions.slice(0, replacing ? Math.min(1, free) : free);
            for (const addition of additions.filter((entry) => !usable.includes(entry))) addition.result.status = 'capacity';
            for (const { result, ...entry } of usable) {
                if (target) next = next.map((current) => current.id === target.id ? entry : current);
                else next.push(entry);
            }
            if (usable.length > 0) { outcome = { files: results, phase: 'saving' }; publish(); }
            const ok = usable.length === 0 || await commit(next);
            if (!ok) for (const addition of usable) addition.result.status = 'not-saved';
            const failed = results.filter((file) => ['unreadable', 'file-too-large', 'image-too-large', 'timeout', 'not-saved'].includes(file.status));
            if ((ok && usable.length > 0) || failed.length > 0) {
                issues = issues.filter((file) => file.id !== issue?.id && (!original || file.targetId !== original.id));
            }
            issues.push(...failed);
            outcome = { files: results, ...(ok ? {} : { failure: commitFailure }) };
            publish();
            return { ok: ok && usable.length > 0, outcome };
        });
    }

    return {
        get: state,
        refresh,
        subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
        add: (files) => pick(files),
        replace: (id, files) => pick(files, id),
        remove: (id) => enqueue(async () => {
            const image = entries.find((entry) => entry.id === id);
            if (!image) {
                issues = issues.filter((file) => file.id !== id);
                if (outcome?.files) outcome = { ...outcome, files: outcome.files.filter((file) => file.id !== id) };
                return { ok: true };
            }
            const ok = await commit(entries.filter((entry) => entry.id !== id));
            if (ok) issues = issues.filter((file) => file.targetId !== id);
            outcome = ok ? null : { files: [], failure: commitFailure };
            return { ok };
        }),
        clear: () => enqueue(async () => {
            const ok = await commit([]);
            if (ok) issues = [];
            outcome = ok ? null : { files: [], failure: commitFailure };
            return { ok };
        }, { supersede: true, validate: false }),
        settled: () => queue.then(() => validation),
    };
}

export function createScreensaverPlaylist({ paint, verify, fallback, defaultMinutes = 10,
    setTimer = setInterval, clearTimer = clearInterval }) {
    let mode = false, candidates = [], images = [], rejected = new Set();
    let minutes = defaultMinutes, index = 0, timer = null, version = 0, abort = null;
    let validation = Promise.resolve();
    const visible = () => images.length ? images : rejected.has(fallback) ? [] : [fallback];
    const show = () => {
        const list = visible();
        if (index >= list.length) index = 0;
        paint(mode ? list[index] ?? '' : '');
    };
    const apply = () => {
        if (timer !== null) { clearTimer(timer); timer = null; }
        show();
        if (mode && visible().length > 1) timer = setTimer(() => { index = (index + 1) % visible().length; show(); }, Math.max(1, minutes) * 60_000);
    };
    const load = (next) => {
        abort?.abort();
        abort = new AbortController();
        const signal = abort.signal, currentVersion = ++version;
        const previousImage = visible()[index];
        const known = new Set(images);
        candidates = storedImageUrls(next);
        const checked = candidates.map((url) => ({ url, valid: rejected.has(url) ? false : known.has(url) ? true : null }));
        const update = () => {
            const held = visible()[index] ?? previousImage;
            images = checked.filter((image) => image.valid).map((image) => image.url).slice(0, SCREENSAVER_IMAGE_LIMIT);
            index = Math.max(0, images.indexOf(held));
            apply();
        };
        update();
        validation = (async () => {
            for (const image of checked) {
                if (image.valid !== null) continue;
                let valid = false;
                try { valid = accepted(await verify(image.url, { signal })); } catch { /* skip unreadable images */ }
                if (signal.aborted || currentVersion !== version) return;
                image.valid = valid;
                update();
            }
        })();
        return validation;
    };
    return {
        setMode(next) { mode = next === true; apply(); },
        setImages(next) { rejected = new Set(); return load(next); },
        setCycle(next) { minutes = Number.isFinite(next) && next > 0 ? next : defaultMinutes; apply(); },
        reject(url) {
            if (!visible().includes(url)) return;
            rejected.add(url);
            images = images.filter((image) => image !== url);
            index = 0;
            void load(candidates);
        },
        settled: () => validation,
        stop() { version += 1; abort?.abort(); if (timer !== null) clearTimer(timer); timer = null; mode = false; paint(''); },
    };
}
