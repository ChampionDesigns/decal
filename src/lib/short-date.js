/**
 * A served date, written the way a settings row can carry it.
 */

export function shortDate(iso, language) {
    if (typeof iso !== 'string' || iso.trim() === '') return null;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return null;
    return new Intl.DateTimeFormat(language || undefined, { day: 'numeric', month: 'short' }).format(at);
}

export function shortDateTime(ms, language) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
    const at = new Date(ms);
    if (Number.isNaN(at.getTime())) return null;
    return new Intl.DateTimeFormat(language || undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(at);
}
