/**
 * The screensaver image checks that need a document to run.
 */

import { SCREENSAVER_IMAGE_MAX_BYTES, SCREENSAVER_IMAGE_MAX_EDGE } from '../lib/screensaver-images.js';

const IO_TIMEOUT_MS = 15000;

function readFile(view, file, { signal, timeoutMs = IO_TIMEOUT_MS } = {}) {
    return new Promise((resolve) => {
        let reader, timer, finished = false;
        const finish = (result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            if (reader) reader.onload = reader.onerror = reader.onabort = null;
            resolve(result);
        };
        const abort = () => { finish({ ok: false, reason: 'cancelled' }); try { reader?.abort(); } catch { /* already finished */ } };
        if (signal?.aborted) { finish({ ok: false, reason: 'cancelled' }); return; }
        try {
            reader = new view.FileReader();
            signal?.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => { finish({ ok: false, reason: 'timeout' }); try { reader.abort(); } catch { /* already finished */ } }, timeoutMs);
            reader.onload = () => finish(typeof reader.result === 'string'
                ? { ok: true, url: reader.result } : { ok: false, reason: 'unreadable' });
            reader.onerror = () => finish({ ok: false, reason: 'unreadable' });
            reader.onabort = () => finish({ ok: false, reason: 'cancelled' });
            reader.readAsDataURL(file);
        } catch { finish({ ok: false, reason: 'unreadable' }); }
    });
}

export function verifyScreensaverImage(view, url, { signal, timeoutMs = IO_TIMEOUT_MS } = {}) {
    return new Promise((resolve) => {
        let image, timer, finished = false;
        const finish = (result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            if (image) image.onload = image.onerror = null;
            resolve(result);
        };
        const abort = () => { finish({ ok: false, reason: 'cancelled' }); if (image) image.src = ''; };
        if (signal?.aborted) { abort(); return; }
        try {
            image = new view.Image();
            signal?.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => { finish({ ok: false, reason: 'timeout' }); image.src = ''; }, timeoutMs);
            image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0
                ? { ok: true, width: image.naturalWidth, height: image.naturalHeight }
                : { ok: false, reason: 'unreadable' });
            image.onerror = () => finish({ ok: false, reason: 'unreadable' });
            image.src = url;
        } catch { finish({ ok: false, reason: 'unreadable' }); }
    });
}

export async function inspectScreensaverFile(view, file, options = {}) {
    if (!String(file?.type ?? '').toLowerCase().startsWith('image/')) return { ok: false, reason: 'not-image' };
    if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, reason: 'unreadable' };
    if (file.size > SCREENSAVER_IMAGE_MAX_BYTES) return { ok: false, reason: 'file-too-large' };
    const read = await readFile(view, file, options);
    if (!read.ok) return read;
    const decoded = await verifyScreensaverImage(view, read.url, options);
    if (!decoded.ok) return decoded;
    if (Math.max(decoded.width, decoded.height) > SCREENSAVER_IMAGE_MAX_EDGE) return { ok: false, reason: 'image-too-large' };
    return { ok: true, url: read.url };
}
