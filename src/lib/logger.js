

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

export function createLogger({
    level = 'info',
    tag = DEFAULT_TAG,
    console: consoleTarget,
    sinks,
    now = () => Date.now(),
} = {}) {
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

        scope(name) {
            return makeLogger(state, `${tag}:${name}`);
        },

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

export const logger = createLogger();
