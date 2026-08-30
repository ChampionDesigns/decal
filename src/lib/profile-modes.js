/**
 * The pump-mode tables and every PURE decision the profile editor makes about a step (Gate 7 port of slate app/src/modules/profile_modes.js, 579 lines; CARRY_FORWARD.md §3d).
 */

import { REA_EXIT_TYPES } from '../data/rea-profile.js';
import { MACHINE_CLASSES } from './machine-limits.js';

/** Coerce a possibly-string / possibly-missing JSON value to a finite number, else 0. */
function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

/** Exact (0.1-quantised) equality with a small tolerance, string-tolerant. */
function nEq(a, b) {
    return Math.abs(num(a) - num(b)) < 1e-6;
}

/** Clamp x into [lo, hi]. */
function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}

const BASE_AUTHORING_RANGES = Object.freeze({
    /** A pressure step's setpoint. 0 bar is a valid step (stock pause/flush semantics). */
    pressureTarget: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    /** A power step's target, in hydraulic watts — the firmware shaper's authored maximum. */
    powerTarget: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'W' }),
    /** A lever step's P0, stored in the pressure key. */
    leverP0: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),

    /**
     * A flow step's PRESSURE LIMIT. `min: 0` is load-bearing: the limit can be
     * switched fully off (0 = no limit), and a min of 1 made it impossible to
     * turn off from the − button or the numpad.
     */
    stepPressureLimit: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    /**
     * A power step's PRESSURE CAP — soft-mandatory, so its floor is 1 bar and not
     * 0: `ProfileStepPower.fromJson` throws for a null OR zero limiter.
     */
    powerPressureCap: Object.freeze({ min: 1, max: 12, step: 0.1, unit: 'bar', mandatory: true }),
    /**
     * A lever step's OPTIONAL flow cap. The ceiling is the machine's max flow, so
     * the cap can span the full pump range; the floor stays 0 (cap off).
     */
    leverFlowCap: Object.freeze({ min: 0, max: 20, step: 0.1, unit: 'mL/s' }),

    /** Lever feel: the spring rate. */
    leverSpring: Object.freeze({ min: 0, max: 3, step: 0.1, unit: 'bar per 10 mL' }),
    /** Lever feel: the give. */
    leverGive: Object.freeze({ min: 0, max: 6, step: 0.1, unit: 'bar per mL/s' }),

    /** Exit thresholds, one per exit type ReaPrime's model can express. */
    exitPressure: Object.freeze({ min: 0, max: 12, step: 0.1, unit: 'bar' }),
    exitFlow: Object.freeze({ min: 0, max: 8, step: 0.1, unit: 'mL/s' }),
    exitPower: Object.freeze({ min: 0, max: 25.5, step: 0.1, unit: 'W' }),

    /** The step's own stop conditions. */
    seconds: Object.freeze({ min: 0, max: 300, step: 1, unit: 'sec' }),
    volume: Object.freeze({ min: 0, max: 500, step: 1, unit: 'mL' }),
    weight: Object.freeze({ min: 0, max: 500, step: 1, unit: 'g' }),
});

const FLOW_TARGET_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 20, de1: 15 });
const STEP_FLOW_LIMIT_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 20, de1: 8 });

export const MACHINE_DEPENDENT_AUTHORING_RANGES = Object.freeze(['flowTarget', 'stepFlowLimit']);

const UNKNOWN_MACHINE_CLASS_IS_OFFERED = 'de1';

/** The whole table, for one machine class. Built once per class, so identity is stable. */
function buildAuthoringRanges(machineClass) {
    return Object.freeze({
        ...BASE_AUTHORING_RANGES,
        /**
         * A flow step's setpoint. 0 mL/s is the bloom people already author, and the
         * ceiling is the machine's — 20 on a Bengle, 15 on a DE1.
         */
        flowTarget: Object.freeze({
            min: 0, max: FLOW_TARGET_CEILING_BY_MACHINE_CLASS[machineClass],
            step: 0.1, unit: 'mL/s',
        }),
        stepFlowLimit: Object.freeze({
            min: 0, max: STEP_FLOW_LIMIT_CEILING_BY_MACHINE_CLASS[machineClass],
            step: 0.1, unit: 'mL/s',
        }),
    });
}

const AUTHORING_RANGES_BY_MACHINE_CLASS = Object.freeze(Object.fromEntries(
    MACHINE_CLASSES.map((machineClass) => [machineClass, buildAuthoringRanges(machineClass)]),
));

export function authoringRangesFor(machineClass) {
    if (machineClass === null || machineClass === undefined) {
        return AUTHORING_RANGES_BY_MACHINE_CLASS[UNKNOWN_MACHINE_CLASS_IS_OFFERED];
    }
    if (!MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(
            `profile-modes: unknown machine class "${machineClass}". The classes are `
            + `${MACHINE_CLASSES.join(', ')} and null (not known yet); the answer comes from `
            + 'capabilities.machineClass(), never from a model name (A3).',
        );
    }
    return AUTHORING_RANGES_BY_MACHINE_CLASS[machineClass];
}

export const AUTHORING_RANGES = authoringRangesFor(null);

/** The sentinel for "the caller did not state a machine class", distinct from stating null. */
const MACHINE_CLASS_NOT_STATED = Symbol('profile-modes: machine class not stated');

export function authoringRange(name, machineClass = MACHINE_CLASS_NOT_STATED) {
    const stated = machineClass !== MACHINE_CLASS_NOT_STATED;
    if (!stated && MACHINE_DEPENDENT_AUTHORING_RANGES.includes(name)) {
        throw new Error(
            `profile-modes: "${name}" is MACHINE-DEPENDENT — its ceiling is `
            + `${FLOW_TARGET_CEILING_BY_MACHINE_CLASS.bengle}`
            + ' mL/s on a Bengle and lower on a DE1, so it cannot be read without stating '
            + 'the machine class. Pass '
            + `${MACHINE_CLASSES.join(', ')} or null as the second argument; null means `
            + '"not known yet" and answers with the narrower band. The class comes from '
            + 'capabilities.machineClass() (adapters-r.js machineClassFromServedSet), never '
            + 'from a model name (A3).',
        );
    }
    const range = authoringRangesFor(stated ? machineClass : null)[name];
    if (!range) throw new Error(`profile-modes: no authoring range declared for "${name}"`);
    return range;
}

/** The exit-threshold range for an exit type, or null for a type with no threshold. */
export function exitRange(type) {
    if (type === 'pressure') return AUTHORING_RANGES.exitPressure;
    if (type === 'flow') return AUTHORING_RANGES.exitFlow;
    if (type === 'power') return AUTHORING_RANGES.exitPower;
    return null;
}

export const MODE_TABLE = Object.freeze({
    flow: Object.freeze({
        pump: 'flow', targetKey: 'flow', targetRange: 'flowTarget', seed: 6.0,
        numpadTitle: 'FLOW',
        limiterRange: 'stepPressureLimit', limiterTitle: 'PRESSURE LIMIT',
    }),
    pressure: Object.freeze({
        pump: 'pressure', targetKey: 'pressure', targetRange: 'pressureTarget', seed: 6.0,
        numpadTitle: 'PRESSURE',
        limiterRange: 'stepFlowLimit', limiterTitle: 'FLOW LIMIT',
    }),
    power: Object.freeze({
        pump: 'power', targetKey: 'power', targetRange: 'powerTarget', seed: 2.0,
        numpadTitle: 'POWER',
        limiterRange: 'powerPressureCap', limiterTitle: 'PRESSURE CAP',
        limiterForced: true,
    }),
    lever: Object.freeze({
        // The lever's target is P0, stored in the existing pressure key.
        pump: 'lever', targetKey: 'pressure', targetRange: 'leverP0', seed: 9.0,
        numpadTitle: 'PRESSURE (P0)',
        limiterRange: 'leverFlowCap', limiterTitle: 'FLOW CAP',
    }),
});

/** The four offerable pump modes, in cycle order. */
export const PUMP_MODE_CYCLE = Object.freeze(['flow', 'pressure', 'power', 'lever']);

export const PUMP_MODE_DISPLAY_ORDER = Object.freeze(['pressure', 'flow', 'power', 'lever']);
export const PUMP_MODE_LABEL = Object.freeze({
    flow: 'Flow', pressure: 'Pressure', power: 'Power', lever: 'Lever',
});

export const DEFAULT_IMPORTED_PUMP = 'flow';

export function getModeConfig(pump) {
    const cfg = MODE_TABLE[pump];
    if (!cfg) {
        throw new Error(
            `profile-modes: "${pump}" is not a pump mode (${PUMP_MODE_CYCLE.join(', ')}). `
            + 'Foreign JSON is coerced by normalizeImportedStep at the import boundary; '
            + 'A7 forbids reading an unrecognised mode as flow here.',
        );
    }
    return cfg;
}

export function modeRanges(pump, machineClass = null) {
    const cfg = getModeConfig(pump);
    return {
        target: authoringRange(cfg.targetRange, machineClass),
        limiter: authoringRange(cfg.limiterRange, machineClass),
    };
}

export function pumpChipsFor(step, offered) {
    if (offered) return PUMP_MODE_DISPLAY_ORDER.slice();
    const base = ['pressure', 'flow'];
    const pump = step && step.pump;
    if (pump && !base.includes(pump)) {
        return PUMP_MODE_DISPLAY_ORDER.filter((p) => base.includes(p) || p === pump);
    }
    return base;
}

export const LEVER_PRESETS = Object.freeze({
    CLASSIC: Object.freeze({ leverSpring: 0.9, leverGive: 1.5 }),  // traditional strong-then-easing
    GENTLE: Object.freeze({ leverSpring: 0.6, leverGive: 2.5 }),   // high give — forgiving of prep
    FIRM: Object.freeze({ leverSpring: 0.4, leverGive: 0.8 }),     // low give — precise, dialed-in
});

/** Human feel-word for a preset (used by the review sentence). */
export const LEVER_FEEL_WORD = Object.freeze({ CLASSIC: 'classic', GENTLE: 'gentle', FIRM: 'firm' });

export function inferLeverPreset(step) {
    if (!step) return 'CUSTOM';
    // A step with no feel legs at all cannot match a named preset.
    if (!('leverSpring' in step) || !('leverGive' in step)) return 'CUSTOM';
    for (const [name, preset] of Object.entries(LEVER_PRESETS)) {
        if (nEq(step.leverSpring, preset.leverSpring) && nEq(step.leverGive, preset.leverGive)) {
            return name;
        }
    }
    return 'CUSTOM';
}

export const POWER_CAP_DEFAULT = Object.freeze({ value: 9.0, range: 0.6 });

/** A fresh copy of the default cap (the step owns its limiter object). */
function powerCapDefault() {
    return { value: POWER_CAP_DEFAULT.value, range: POWER_CAP_DEFAULT.range };
}

export const NEW_STEP = Object.freeze({
    name: '',
    pump: 'pressure',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 85,
    sensor: 'coffee',
    pressure: 8,
    limiter: Object.freeze({ value: 8, range: POWER_CAP_DEFAULT.range }),
});

export const NEW_STEP_NAME_KEY = 'New step';

export function newStep({ name = '' } = {}) {
    return {
        ...NEW_STEP,
        name: typeof name === 'string' ? name : '',
        limiter: { value: NEW_STEP.limiter.value, range: NEW_STEP.limiter.range },
    };
}

export function seedStepForPump(step, newPump) {
    const cfg = MODE_TABLE[newPump];
    if (!step || !cfg) return step;
    const keep = cfg.targetKey;
    step.pump = newPump;

    // Delete the sibling target keys. Note lever and pressure share 'pressure'.
    for (const k of ['flow', 'pressure', 'power']) {
        if (k !== keep && (k in step)) delete step[k];
    }
    // Lever-only params are stale on any non-lever mode.
    if (newPump !== 'lever') {
        delete step.leverSpring;
        delete step.leverGive;
    }

    if (newPump === 'lever') {
        // A mode SWITCH seeds a fresh lever step: P0 = the lever seed and the
        // CLASSIC feel. (A preset PICK later never re-touches P0 — the preset
        // invariant — but the switch itself is a reset, so it seeds P0.)
        step.pressure = cfg.seed;
        step.leverSpring = LEVER_PRESETS.CLASSIC.leverSpring;
        step.leverGive = LEVER_PRESETS.CLASSIC.leverGive;
        // LEVER defines its own P0 − spring·V − give·F trajectory, so the
        // frame-spanning JUMP/RAMP/HOLD transition does not apply: force JUMP at
        // switch time. Lever is the ONLY mode that seeds a forced transition.
        step.transition = 'fast';
    } else {
        // Seed the target if absent or zero (preserve a shared key's prior value).
        if (!num(step[keep])) step[keep] = cfg.seed;
        if (newPump === 'power') {
            // The transition is deliberately NOT forced: the firmware honours a
            // watts-domain ramp, so an authored Ramp must survive a switch into
            // Power exactly like flow/pressure.
            //
            // The pressure cap is soft-mandatory. Force the default when unset OR
            // zeroed — the same value>0 test `normalizeImportedStep` uses, not a
            // truthy guard that would let a carried-over {value: 0} limiter through.
            const cap = authoringRange('powerPressureCap');
            if (!step.limiter || !(num(step.limiter.value) > 0)) {
                step.limiter = powerCapDefault();
            } else {
                // A carried-over limiter (a flow step's mL/s soft-knee, say) must not
                // survive as a sub-min or over-ceiling bar cap, so a 0.5 mL/s flow
                // limit cannot become a 0.5 bar pressure cap.
                step.limiter.value = clamp(num(step.limiter.value), cap.min, cap.max);
            }
        }
    }
    return step;
}

export function limiterOnClear(pump) {
    if (pump === 'power') return powerCapDefault();
    return { value: 0, range: POWER_CAP_DEFAULT.range };
}

export function normalizeImportedStep(step) {
    if (!step || typeof step !== 'object') return step;
    // THE ONE SITE where an unrecognised pump becomes a known one, and it is a
    // WRITE on the step so the coercion is visible in the record afterwards. The
    // source did this implicitly on every read instead (`MODE_TABLE[pump] ||
    // MODE_TABLE.flow`), which re-typed the step differently on different surfaces
    // and left nothing behind to see. A7: coerce at the boundary, once, or not at all.
    if (!MODE_TABLE[step.pump]) step.pump = DEFAULT_IMPORTED_PUMP;
    const cfg = MODE_TABLE[step.pump];
    {
        const keep = cfg.targetKey;
        for (const k of ['flow', 'pressure', 'power']) {
            if (k !== keep && (k in step)) delete step[k];
        }
        if (step.pump !== 'lever') {
            delete step.leverSpring;
            delete step.leverGive;
        }
    }
    // Power's pressure cap is mandatory and must never be 0.
    if (step.pump === 'power') {
        if (!step.limiter || !(num(step.limiter.value) > 0)) {
            step.limiter = powerCapDefault();
        }
    } else if (step.limiter && step.limiter.value === 0) {
        step.limiter = null;
    }
    // A power exit ROUND-TRIPS on load, so a profile authored on a capable machine
    // stays full-fidelity everywhere: degrade visibly, never silently.
    if (step.exit && !REA_EXIT_TYPES.includes(step.exit.type)) {
        step.exit = null;
    }
    return step;
}

export function describeModeParts(step) {
    const pump = step && step.pump;
    if (pump === 'power') {
        const cap = num(step.limiter && step.limiter.value);
        const target = authoringRange('powerTarget');
        const capRange = authoringRange('powerPressureCap');
        return {
            main: [
                { t: 'text', text: 'to a constant hydraulic power of' },
                { t: 'num', field: 'power', value: num(step.power), step: target.step, unit: target.unit, min: target.min, max: target.max },
                { t: 'text', text: '— pressure and flow find their own balance on the puck' },
            ],
            limiter: cap > 0 ? [
                { t: 'text', text: '. Never exceed' },
                { t: 'num', field: 'limiter', value: cap, step: capRange.step, unit: capRange.unit, min: capRange.min, max: capRange.max },
                { t: 'text', text: '(hard pressure cap)' },
            ] : null,
        };
    }
    if (pump === 'lever') {
        const preset = inferLeverPreset(step);
        const cap = num(step.limiter && step.limiter.value);
        const p0 = authoringRange('leverP0');
        const spring = authoringRange('leverSpring');
        const give = authoringRange('leverGive');
        const capRange = authoringRange('leverFlowCap');
        let main;
        if (preset === 'CUSTOM') {
            main = [
                // No leading "to " — the review prepends "Engage" (lever carries no
                // transition verb): "Engage a custom spring-lever source…".
                { t: 'text', text: 'a custom spring-lever source: start at' },
                { t: 'num', field: 'pressure', value: num(step.pressure), step: p0.step, unit: p0.unit, min: p0.min, max: p0.max },
                { t: 'text', text: ', dropping' },
                { t: 'num', field: 'leverSpring', value: num(step.leverSpring), step: spring.step, unit: 'bar per 10 mL delivered', min: spring.min, max: spring.max },
                { t: 'text', text: 'with' },
                { t: 'num', field: 'leverGive', value: num(step.leverGive), step: give.step, unit: 'bar per mL/s of give', min: give.min, max: give.max },
            ];
        } else {
            const feel = LEVER_FEEL_WORD[preset] || 'classic';
            main = [
                { t: 'text', text: `a ${feel} spring-lever feel, starting near` },
                { t: 'num', field: 'pressure', value: num(step.pressure), step: p0.step, unit: p0.unit, min: p0.min, max: p0.max },
                { t: 'text', text: 'and easing as the shot pours' },
            ];
        }
        return {
            main,
            limiter: cap > 0 ? [
                { t: 'text', text: '. Cap flow at' },
                { t: 'num', field: 'limiter', value: cap, step: capRange.step, unit: capRange.unit, min: capRange.min, max: capRange.max },
            ] : null,
        };
    }
    return null;
}

/** 4+ options are sized to their labels; 2–3 stay equal, which reads as a toggle. */
export const PROPORTIONAL_FROM = 4;

export function segmentGeometry(labels, totalW, { pad = 4, equal = false, measure = null, gutter = null } = {}) {
    const n = labels.length;
    const inner = totalW - pad * 2;
    const proportional = !equal && n >= PROPORTIONAL_FROM;

    let weights;
    if (proportional) {
        if (typeof measure !== 'function' || !Number.isFinite(gutter) || gutter < 0) {
            throw new Error(
                `profile-modes: segmentGeometry needs a text measurer and a pixel gutter for ${n} `
                + 'segments — pass { measure, gutter } from the component that owns the face. '
                + 'Sizing by character count truncates the moment the labels are translated.',
            );
        }
        weights = labels.map((label) => {
            const width = measure(String(label));
            if (!Number.isFinite(width) || width < 0) {
                throw new Error(`profile-modes: measure("${label}") returned ${width}; expected a pixel width`);
            }
            return width + gutter;
        });
    } else {
        weights = labels.map(() => 1);
    }

    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const widths = weights.map((w) => (w / wSum) * inner);
    const offsets = widths.reduce(
        (acc, _w, i) => (acc.push(i ? acc[i - 1] + widths[i - 1] : 0), acc), []);
    return {
        pad, inner, weights, widths, offsets, proportional, tightFont: n >= PROPORTIONAL_FROM,
        indicatorLeft: (i) => pad + (offsets[Math.max(0, i)] || 0),
        indicatorWidth: (i) => widths[Math.max(0, i)] || 0,
    };
}

export function transitionSegments(step, index, holdOffered) {
    const isLever = (step && step.pump) === 'lever';
    const isHold = (step && step.transition) === 'hold';
    const holdShown = !!holdOffered || isHold;
    const options = [
        { label: 'Fast', value: 'fast' },
        { label: 'Smooth', value: 'smooth' },
    ];
    if (holdShown) options.push({ label: 'Hold', value: 'hold', disabled: index === 0 });
    return {
        options,
        readOnly: isLever || (isHold && !holdOffered),
        active: isLever ? 'fast' : ((step && step.transition) || 'fast'),
    };
}

export function reviewStepSpec(step, { machineRanges, machineClass = null } = {}) {
    const temperature = machineRanges && machineRanges.temperature;
    if (!temperature || !Number.isFinite(temperature.min) || !Number.isFinite(temperature.max)) {
        throw new Error(
            'profile-modes: reviewStepSpec needs { machineRanges: { temperature } } — the brew '
            + 'temperature is a MACHINE limit (machine-limits.js `brewTemp`), and B2 allows '
            + 'exactly one table per field, so this module declares no range for it.',
        );
    }

    const lines = [];
    // A7: the mode is taken as given or REFUSED — never re-typed. The source
    // defaulted to flow here and then worded an unrecognised step as a PRESSURE
    // step below, so the same unknown mode read as two different steps. The branches
    // that follow are exhaustive because this throws for anything outside the table.
    const pump = getModeConfig(step && step.pump).pump;
    const isRamp = step.transition === 'smooth';
    const isHold = step.transition === 'hold';
    const probe = step.sensor === 'water' ? 'water' : 'coffee';

    // Line 1 — temperature. The step is the machine range's own, so integers read
    // clean ("93") while a 92.5 stays accurate.
    lines.push([
        ['t', 'Set '],
        ['tog', 'probe', probe],
        ['t', ' temperature to '],
        ['num', 'temperature', num(step.temperature), temperature.step, '°C', temperature.min, temperature.max],
    ]);

    // Exit mapping: TIME folds into the rate line and the pressure/flow condition
    // plus volume/weight combine into one "Move on if…" line.
    const secondsRange = authoringRange('seconds');
    const seconds = num(step.seconds);
    const volume = num(step.volume);
    const weight = num(step.weight);
    const exit = step.exit && step.exit.type !== 'off' ? step.exit : null;
    const exitVal = exit ? num(exit.value) : 0;
    const timeClause = seconds > 0
        ? [['t', isRamp ? ' over ' : ' for '],
           ['num', 'seconds', seconds, secondsRange.step, secondsRange.unit, secondsRange.min, secondsRange.max]]
        : [];

    // Line 2 — the rate, with time and limiter appended as one string so
    // punctuation attaches with no gap.
    const rate = [];
    const lim = num(step.limiter && step.limiter.value);
    if (isHold) {
        // DEVIATION (documented): the base template's held word is
        // flow ? 'flow rate' : 'pressure'; a HOLD-power step says "power" because
        // the firmware latches watts for it.
        const what = pump === 'flow' ? 'flow rate' : pump === 'power' ? 'power' : 'pressure';
        rate.push(['tog', 'trans', 'Hold'], ['t', ' the previous '], ['tog', 'pumpword', what], ...timeClause);
    } else if (pump === 'power') {
        const target = authoringRange('powerTarget');
        rate.push(
            ['tog', 'trans', isRamp ? 'Ramp' : 'Jump'], ['t', ' to a constant '],
            ['tog', 'pumpword', 'hydraulic power'], ['t', ' of '],
            ['num', 'power', num(step.power), target.step, target.unit, target.min, target.max],
            ['t', ' — pressure and flow find their own balance on the puck'], ...timeClause);
    } else if (pump === 'lever') {
        const preset = inferLeverPreset(step);
        const p0 = authoringRange('leverP0');
        const spring = authoringRange('leverSpring');
        const give = authoringRange('leverGive');
        if (preset === 'CUSTOM') {
            rate.push(
                ['t', 'Engage a '], ['tog', 'pumpword', 'custom spring-lever source'], ['t', ': start at '],
                ['lev', `${revFmt(num(step.pressure), p0.step)} ${p0.unit}`], ['t', ', dropping '],
                ['lev', `${revFmt(num(step.leverSpring), spring.step)} bar per 10 mL delivered`], ['t', ' with '],
                ['lev', `${revFmt(num(step.leverGive), give.step)} ${give.unit}`], ['t', ' of give'], ...timeClause);
        } else {
            const feel = LEVER_FEEL_WORD[preset] || 'classic';
            rate.push(
                ['t', 'Engage a '], ['lev', feel], ['t', ' '], ['tog', 'pumpword', 'spring-lever'],
                ['t', ' feel, starting near '], ['lev', `${revFmt(num(step.pressure), p0.step)} ${p0.unit}`],
                ['t', ' and easing as the shot pours'], ...timeClause);
        }
    } else {
        // flow or pressure — the only modes left, because getModeConfig refused
        // anything outside the table above. One rule for the word, the unit and the bound.
        const target = authoringRange(pump === 'flow' ? 'flowTarget' : 'pressureTarget', machineClass);
        const pumpWord = pump === 'flow' ? 'flow rate' : 'pressure';
        const field = pump === 'flow' ? 'flow' : 'pressure';
        rate.push(
            ['tog', 'trans', isRamp ? 'Ramp' : 'Jump'], ['t', ' to a '],
            ['tog', 'pumpword', pumpWord], ['t', ' of '],
            ['num', field, num(step[field]), target.step, target.unit, target.min, target.max], ...timeClause);
    }
    if (lim > 0) {
        // Every limiter slot reads the SAME entry its stepper does — this is where
        // the Review path used to carry its own, larger ceilings (16 bar / 15 mL/s).
        const limiter = authoringRange(MODE_TABLE[pump].limiterRange, machineClass);
        if (pump === 'power') {
            rate.push(['t', '. Never exceed '],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max],
                ['t', ' (hard pressure cap)']);
        } else if (pump === 'lever') {
            rate.push(['t', '. Cap flow at '],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max]);
        } else {
            const targetKind = pump === 'flow' ? 'flow' : 'pressure';
            const limiterKind = pump === 'flow' ? 'pressure' : 'flow';
            rate.push(['t', `. Limit ${targetKind} if ${limiterKind} approaches `],
                ['num', 'limiter', lim, limiter.step, limiter.unit, limiter.min, limiter.max]);
        }
    }
    lines.push(rate);

    // Line 3 — the combined exit conditions ("Move on if …, or if we reach …").
    const triggerParts = [];
    const exitBounds = exit ? exitRange(exit.type) : null;
    if (exit && exitVal > 0 && exitBounds) {
        const dir = exit.condition === 'under' ? 'falls below' : 'rises above';
        triggerParts.push([
            ['t', `${exit.type} `], ['tog', 'exitcmp', dir], ['t', ' '],
            ['num', 'exitValue', exitVal, exitBounds.step, exitBounds.unit, exitBounds.min, exitBounds.max],
        ]);
    }
    const reachParts = [];
    const volumeRange = authoringRange('volume');
    const weightRange = authoringRange('weight');
    if (volume > 0) reachParts.push(['num', 'volume', volume, volumeRange.step, volumeRange.unit, volumeRange.min, volumeRange.max]);
    if (weight > 0) reachParts.push(['num', 'weight', weight, weightRange.step, weightRange.unit, weightRange.min, weightRange.max]);
    if (reachParts.length) {
        const reach = [['t', 'we reach ']];
        reachParts.forEach((part, i) => { if (i) reach.push(['t', ' or ']); reach.push(part); });
        triggerParts.push(reach);
    }
    if (triggerParts.length) {
        const line = [['t', 'Move on if ']];
        triggerParts.forEach((part, i) => { if (i) line.push(['t', ', or if ']); line.push(...part); });
        lines.push(line);
    }

    return lines;
}

/** Integers show bare ("9", "93"); fractions take one decimal when the step is < 1. */
export function revFmt(v, step) {
    if (v === null || v === undefined) return '';
    return Number.isInteger(v) ? String(v) : v.toFixed(step < 1 ? 1 : 0);
}

/**
 * Flatten one `reviewStepSpec` line to its plain-text sentence (segments carry
 * their own spacing). For the wording pin; never for app rendering.
 */
export function reviewLineText(line) {
    return line.map((seg) => {
        if (seg[0] === 't') return seg[1];
        if (seg[0] === 'num') return `${revFmt(seg[2], seg[3])} ${seg[4]}`;
        return seg[2] !== undefined && seg[0] === 'tog' ? seg[2] : seg[1];
    }).join('');
}

export function stepGraphValues(step) {
    const pump = step && step.pump;
    const cap = num(step && step.limiter && step.limiter.value);
    switch (pump) {
        case 'pressure': return { pressure: num(step.pressure), flow: 0, power: 0 };
        case 'flow': return { pressure: 0, flow: num(step.flow), power: 0 };
        case 'power': return { pressure: cap, flow: 0, power: num(step.power) };
        case 'lever': return { pressure: num(step.pressure), flow: cap, power: 0 };
        default: return { pressure: 0, flow: 0, power: 0 };
    }
}

export function stepTargetOverlay(step) {
    const pump = step && step.pump;
    if (pump === 'pressure') return { pressure: num(step.pressure), flow: null };
    if (pump === 'flow') return { pressure: null, flow: num(step.flow) };
    if (pump === 'power' || pump === 'lever') {
        const g = stepGraphValues(step);
        return { pressure: g.pressure, flow: g.flow > 0 ? g.flow : null };
    }
    return { pressure: null, flow: null };
}

export function leverDeclineP1(step) {
    return Math.max(0, num(step && step.pressure) - 3 * num(step && step.leverSpring));
}

/** True when any step in the list is a Power step (gates the power trace). */
export function anyPowerStep(steps) {
    return Array.isArray(steps) && steps.some((s) => s && s.pump === 'power');
}
