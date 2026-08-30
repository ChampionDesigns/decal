// The logger. One surface for every diagnostic line in the skin; no component calls
// console.* directly.
//
// THE DECISION THAT CARRIES ACROSS (CARRY_FORWARD, `logger.js` — "a rewrite, not a port…
// the value carried is the decision, not the code"): log through `console.*`, because
// ReaPrime captures the WebView's console (`skin_view.dart:684-692`), persists it with a
// 1 MB truncating cap and replays it at `GET /api/v1/webview/logs?order=asc|desc`. That
// makes every line recoverable from the machine, for free, with no skin-side transport.
//
// THE BUG THAT DOES NOT (verified at source): the old module was
// `export const logger = { debug: noop, … }` and `setDebug` REASSIGNED `logger.debug` in
// place, so any consumer that destructured (`const { debug } = logger`) captured the
// no-op permanently and never saw `setDebug(true)`. Here every method is a stable
// function for the lifetime of the logger and reads the level at call time.
//
// The one trade-off, stated because it is a real loss: the old module used
// `console.info.bind(console, '[INFO]')`, so devtools attributed each line to its call
// site. A level-checking wrapper cannot preserve that. It is paid for level gating and
// for sinks, and the console sink still calls the matching `console` method so devtools
// filtering and ReaPrime's capture both behave.
//
// DOM-free: `console` is injected, never reached for. That is what lets levels and sinks
// be tested under node:test with a recording double.

export const LEVELS = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
});

export const LEVEL_NAMES = Object.freeze(['debug', 'info', 'warn', 'error']);

/** Default tag. Provenance: a captured server-side log says which skin wrote the line. */
export const DEFAULT_TAG = 'Decal';

/**
 * A sink writing to a console-shaped object. `console.debug` rather than `console.log`
 * so the level survives the WebView -> ReaPrime capture.
 */
export function createConsoleSink(target) {
    if (!target) return () => {};
    const method = {
        debug: target.debug || target.log,
        info: target.info || target.log,
        warn: target.warn || target.log,
        error: target.error || target.log,
    };
    return function consoleSink(record) {
        const write = method[record.level] || target.log;
        if (typeof write !== 'function') return;
        write.call(target, `[${record.tag}] [${record.level.toUpperCase()}]`, ...record.args);
    };
}

/**
 * @param {object} [options]
 * @param {string} [options.level]     initial threshold; default 'info'
 * @param {string} [options.tag]       provenance tag, default 'Decal'
 * @param {object} [options.console]   console-shaped target for the default sink
 * @param {Function[]} [options.sinks] explicit sinks; replaces the console sink entirely
 * @param {Function} [options.now]     clock, injected for tests
 */
export function createLogger({
    level = 'info',
    tag = DEFAULT_TAG,
    console: consoleTarget,
    sinks,
    now = () => Date.now(),
} = {}) {
    // One shared state object: child scopes see level changes made on the parent, which is
    // what a single `setLevel` at boot has to mean.
    const state = {
        threshold: normaliseLevel(level),
        sinks: new Set(sinks || (consoleTarget ? [createConsoleSink(consoleTarget)] : [])),
        now,
    };
    return makeLogger(state, tag);
}

function makeLogger(state, tag) {
    function emit(levelName, args) {
        if (LEVELS[levelName] < state.threshold) return;
        const record = { level: levelName, tag, args, time: state.now() };
        for (const sink of state.sinks) {
            try {
                sink(record);
            } catch {
                // A broken sink must never take down the caller, and must never recurse
                // back into logging. Swallowed here and only here.
            }
        }
    }

    // Stable for the lifetime of the logger — never reassigned, so destructuring is safe.
    const logger = {
        debug: (...args) => emit('debug', args),
        info: (...args) => emit('info', args),
        warn: (...args) => emit('warn', args),
        error: (...args) => emit('error', args),

        get tag() { return tag; },

        /** Current threshold name. */
        getLevel() {
            return Object.keys(LEVELS).find((name) => LEVELS[name] === state.threshold) || 'info';
        },

        /** Set the threshold. Affects this logger and every scope sharing its state. */
        setLevel(next) {
            state.threshold = normaliseLevel(next);
            return logger;
        },

        /** The old skin's switch, kept because a `debug` preference still drives it. */
        setDebug(enabled) {
            return logger.setLevel(enabled ? 'debug' : 'info');
        },

        /** Cheap guard for expensive message construction. */
        isEnabled(levelName) {
            return normaliseLevel(levelName) >= state.threshold;
        },

        /**
         * A child logger tagged `parent:name`. This is how a module gets provenance
         * without inventing its own prefix convention: `logger.scope('storage')`.
         */
        scope(name) {
            return makeLogger(state, `${tag}:${name}`);
        },

        /** Add a sink; returns an unsubscribe. Sinks are shared by every scope. */
        addSink(sink) {
            state.sinks.add(sink);
            return () => state.sinks.delete(sink);
        },

        /** How many sinks are attached — for a self-check at boot. */
        sinkCount() { return state.sinks.size; },
    };
    return logger;
}

function normaliseLevel(level) {
    if (typeof level === 'number') return level;
    const value = LEVELS[level];
    if (value === undefined) throw new Error(`logger: unknown level '${level}'`);
    return value;
}

/**
 * The app-wide instance. Components import THIS and never touch `console`.
 *
 * It starts at 'info' with no sink: the composition root attaches the console sink (and
 * applies the stored `debug` preference through the storage router) at boot. Wiring it
 * that way keeps the dependency one-directional — the router logs, the logger does not
 * read storage — and keeps this module import-safe under node:test.
 */
export const logger = createLogger();
