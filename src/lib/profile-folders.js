/**
 * Collapsible families in the profile list — the grouping rules.
 */

export const PROFILE_FOLDER_MIN = 2;

// NO STORAGE KEY LIVES HERE. Which folders are open is persisted through the storage
// router under the LOGICAL key `profileFoldersOpen` (src/lib/storage-routes.js), and
// the router owns the `decal.` prefix - it REJECTS a caller that passes a physical
// key (storage-router.js, PREFIXED_KEY). This module used to also export
// `PROFILE_FOLDER_PREF = 'decal.profileFoldersOpen'`, a second hand-maintained copy
// of a key the table already owned, which is precisely the shape the old skin had
// (`PROFILE_FOLDER_PREF = 'slate.profileFoldersOpen'` used as a logical key) and the
// reason B7 exists: one owner per key. A consumer writes
//
//     await storage.set('profileFoldersOpen', [...openFolders]);
//
// and nothing in this file needs to know where that lands.

// A delimiter is an author saying "this part is the family". The slash is the
// Decent convention; the bullet arrived with the Baseline set, which is four
// profiles that are unmistakably one family and were not folding.
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
    // Only the FIRST delimiter splits. "Pour over basket/V60 22g in, 375g out"
    // is one family and one leaf, not a three-level tree. Same for
    // "Baseline • Medium Contact • 6 Bar", whose second bullet is part of the
    // leaf's own name.
    const leaf = raw.slice(at + 1).trim();
    // Both halves have to be real. "Trailing/" and "/Leading" give either a
    // folder you cannot label or a row with no name.
    if (!folder || !leaf) return { folder: null, leaf: raw };
    return { folder, leaf };
}

// Words that must not END a folder name. "Flow profile for straight espresso"
// and "Flow profile for milky drinks" share three words, and a folder called
// "Flow profile for" reads like a sentence someone walked away from.
const TRAILING_STOPWORDS = new Set(['for', 'the', 'a', 'an', 'of', 'and', 'to', 'in', 'with', 'on']);

// A single word can only name a family if it is a NAME. Measured on the real
// library: "I Can't Believe It's Not Filter" and "I got your back" share their
// first word, and the rule happily filed both under a folder called "I".
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

    // Longest prefix wins, so a title joins the most specific family it can.
    // Ties break on size, then alphabetically, so the result does not depend on
    // Map iteration order.
    const ranked = [...candidates.entries()]
        .filter(([, members]) => members.length >= minimum)
        .sort((a, b) =>
            words(b[0]).length - words(a[0]).length
            || b[1].length - a[1].length
            || a[0].localeCompare(b[0]));

    const assigned = new Map();
    for (const [prefix, members] of ranked) {
        // A title already in a longer family stays there. What is left has to
        // still clear the minimum, or this prefix describes one profile.
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
        // Strip the prefix and any delimiter or punctuation left dangling at
        // the front of what remains.
        const rest = raw.slice(String(folder).length).replace(/^[\s•·/,:-]+/, '').trim();
        if (rest) return rest;
    }
    return raw;
}

export function groupProfilesByFolder(entries, titleOf, minimum = PROFILE_FOLDER_MIN) {
    const order = [];
    const byFolder = new Map();
    // Families found in the titles, for everything the delimiter rule misses.
    // Computed from the titles that have NO delimiter, so an explicit family
    // can never be broken up by a coincidental shared word — "Tea portafilter/
    // black tea" belongs to its author's folder, not to a derived "Tea" one.
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
    // A folder holding one profile is strictly worse than the profile: the
    // same row count, and one more tap to reach it.
    return order.map(g => (g.folder && g.entries.length < minimum
        ? { folder: null, entries: g.entries }
        : g));
}
