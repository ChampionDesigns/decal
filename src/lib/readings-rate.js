/**
 * readings-rate.js — WHEN THE GAUGE CLUSTER IS ALLOWED TO REDRAW.
 *
 * Ben, 29 August 2026: "could we make it so they don't change at 15 Hz? Make it say 5 Hz
 * instead? Just the values in the data row above the chart, not anything else, charts
 * should still update at 15 Hz."
 *
 * ===========================================================================
 * WHY THIS IS A MODULE AND NOT FOUR LINES IN `live-wiring.js`
 * ===========================================================================
 * The rule has three clauses and two of them are the kind that get dropped by a later
 * simplification — a rate limit reads as one comparison, and the two flushes look like
 * special cases until the day a dash arrives late. Here they are one function with one
 * name, testable by `node:test` with no browser and no clock to move.
 *
 * DOM-free, like `chart-autoscale.js` and for the same reason.
 *
 * ===========================================================================
 * THE THROTTLE IS "DO NOT REASSIGN", NOT A TIMER
 * ===========================================================================
 * `LiveWiring`'s `#readings` builds a NEW frozen object on every read, and a new identity
 * is the whole of what makes Lit redraw the tiles. So the rate limit is the caller simply
 * not publishing — no timer, no queue, no copy of the values, and nothing to cancel when
 * the screen goes away.
 *
 * NOTHING ELSE IS SLOWED. The chart takes its samples from the derivation, not from
 * `readings`, so it keeps every frame the machine sends.
 */

/**
 * 5 Hz. Slow enough that the digits stop churning, fast enough that no number looks stuck.
 * The machine's own frame rate is far higher and the chart still draws all of it.
 */
export const READINGS_MIN_MS = 200;

/**
 * The cluster's channels, in one fixed order.
 *
 * It exists so the flush test below can ask "did a channel appear or disappear" rather
 * than "did any number move" — the second is every frame, which would defeat the throttle
 * entirely. KEEP IN STEP WITH `LiveWiring #readings`: a key missing here is a channel
 * whose dash is allowed to arrive late.
 */
export const READING_KEYS = Object.freeze([
    'pressure', 'flow', 'weight', 'group', 'steam', 'tank', 'milk',
]);

/**
 * WHICH CHANNELS HAVE A READING AT ALL, as one comparable string.
 *
 * `#readings` distinguishes a number from a channel that is genuinely absent, and the tile
 * draws the second as a dash — Ben's ruling of 22 August 2026, "dashes only for a channel
 * genuinely absent". `null` is that absence; anything else is a reading, INCLUDING 0,
 * which is a real value the machine serves at idle and must never read as missing.
 */
export function presenceOf(readings) {
    if (!readings || typeof readings !== 'object') return '';
    return READING_KEYS.map((key) => (readings[key] === null || readings[key] === undefined ? '-' : '#')).join('');
}

/**
 * MAY THE CLUSTER REDRAW THIS FRAME?
 *
 * Three clauses, and the two flushes are not optimisations — without them this rate limit
 * is a bug rather than a feature.
 *
 * 1. A CHANNEL APPEARED OR DISAPPEARED. A dash that arrives 200 ms late leaves a STALE
 *    NUMBER on screen, and not merely an old one: it is a reading for a channel the
 *    machine has stopped serving. That is worse than the churn being removed, so presence
 *    always publishes at once.
 * 2. THE MACHINE STATE CHANGED. Entering or leaving a shot must be crisp. The promotion
 *    and the chart mode turn on in that same frame, and a cluster arriving up to 200 ms
 *    after them reads as the screen tearing.
 * 3. OTHERWISE, 200 ms SINCE THE LAST PUBLISH.
 *
 * VALUES ALONE NEVER FORCE A PUBLISH — that is exactly the churn being removed.
 *
 * `last.at` of 0 with a first call at 0 still publishes, because `0 - 0 >= 0`: a cluster
 * that waited 200 ms for its first paint would show dashes on a machine that is already
 * serving numbers.
 *
 * @param {{at:number, presence:string, state:*}|null} last  what was last published
 * @param {{at:number, presence:string, state:*}} now        this frame
 * @param {number} minMs
 */
export function readingsDue(last, now, minMs = READINGS_MIN_MS) {
    if (!last) return true;
    if (now.presence !== last.presence) return true;
    if (now.state !== last.state) return true;
    return now.at - last.at >= minMs;
}
