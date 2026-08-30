/**
 * Collapsible families in the profile list — the grouping rules.
 */

export const PROFILE_FOLDER_MIN = 2;

const DELIMITERS = ['/', '•', '·'];

/** "A-Flow / default-dark" -> { folder: "A-Flow", leaf: "default-dark" }. */
export function splitProfileTitle(title) {
    const raw = String(title ?? '');
    let at = -1;
    for (const d of DELIMITERS) {
        const i = raw.indexOf(d);
        if (i > 0 && (at === -1 || i < at)) at = i;
    }
    if (at <= 0) return { folder: null, leaf: raw };
    const folder = raw.slice(0, at).trim();
    const leaf = raw.slice(at + 1).trim();
    if (!folder || !leaf) return { folder: null, leaf: raw };
    return { folder, leaf };
}

const TRAILING_STOPWORDS = new Set(['for', 'the', 'a', 'an', 'of', 'and', 'to', 'in', 'with', 'on']);

const WEAK_FIRST_WORDS = new Set(['i', 'a', 'an', 'the', 'my', 'new', 'old', 'test']);
const namesAFamily = (prefix) => {
    const parts = words(prefix);
    if (parts.length > 1) return true;
    const one = parts[0].toLowerCase();
    return one.length >= 3 && !WEAK_FIRST_WORDS.has(one);
};

const words = (title) => String(title ?? '').trim().split(/\s+/).filter(Boolean);

export function deriveTitleFamilies(titles, minimum = PROFILE_FOLDER_MIN) {
    const candidates = new Map();   // prefix -> [title, ...]
    for (const title of titles) {
        const parts = words(title);
        // Every prefix EXCEPT the whole title: a member has to keep a leaf.
        for (let n = 1; n < parts.length; n++) {
            if (TRAILING_STOPWORDS.has(parts[n - 1].toLowerCase())) continue;
            const prefix = parts.slice(0, n).join(' ');
            if (!namesAFamily(prefix)) continue;
            if (!candidates.has(prefix)) candidates.set(prefix, []);
            candidates.get(prefix).push(title);
        }
    }

    const ranked = [...candidates.entries()]
        .filter(([, members]) => members.length >= minimum)
        .sort((a, b) =>
            words(b[0]).length - words(a[0]).length
            || b[1].length - a[1].length
            || a[0].localeCompare(b[0]));

    const assigned = new Map();
    for (const [prefix, members] of ranked) {
        const free = members.filter(t => !assigned.has(t));
        if (free.length < minimum) continue;
        for (const t of free) assigned.set(t, prefix);
    }
    return assigned;
}

/**
 * The part of a title to show INSIDE its folder.
 *
 * Repeating "Damian's " on four consecutive rows under a heading that says
 * "Damian's" is the thing folders exist to stop.
 */
export function folderLeaf(title, folder) {
    const raw = String(title ?? '').trim();
    if (!folder) return raw;
    const explicit = splitProfileTitle(raw);
    if (explicit.folder === folder) return explicit.leaf;
    if (raw.toLowerCase().startsWith(String(folder).toLowerCase())) {
        const rest = raw.slice(String(folder).length).replace(/^[\s•·/,:-]+/, '').trim();
        if (rest) return rest;
    }
    return raw;
}

export function groupProfilesByFolder(entries, titleOf, minimum = PROFILE_FOLDER_MIN) {
    const order = [];
    const byFolder = new Map();
    const derived = deriveTitleFamilies(
        entries.map(titleOf).filter(t => !splitProfileTitle(t).folder), minimum);
    for (const entry of entries) {
        const title = titleOf(entry);
        const folder = splitProfileTitle(title).folder || derived.get(title) || null;
        if (!folder) { order.push({ folder: null, entries: [entry] }); continue; }
        let bucket = byFolder.get(folder);
        if (!bucket) {
            bucket = { folder, entries: [] };
            byFolder.set(folder, bucket);
            order.push(bucket);
        }
        bucket.entries.push(entry);
    }
    return order.map(g => (g.folder && g.entries.length < minimum
        ? { folder: null, entries: g.entries }
        : g));
}
