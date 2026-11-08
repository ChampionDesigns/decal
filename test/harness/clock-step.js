export function clockStep(env = process.env) {
    const raw = env.DECAL_RENDER_CLOCK_STEP;
    if (raw === undefined || raw === '') return null;
    const match = /^(-?\d+)@(\d+)$/.exec(raw);
    const stepMs = match ? Number(match[1]) : NaN;
    const everyMs = match ? Number(match[2]) : NaN;
    if (!match || stepMs === 0 || everyMs <= 0) {
        throw new Error(`DECAL_RENDER_CLOCK_STEP must be <step ms>@<every ms>, for example -1500@2000, got ${JSON.stringify(raw)}`);
    }
    return { stepMs, everyMs };
}

export function clockStepSource({ stepMs, everyMs }) {
    return `(() => {
    const RealDate = Date;
    const start = performance.now();
    const now = () => RealDate.now() + ${stepMs} * Math.floor((performance.now() - start) / ${everyMs});
    function SteppedDate(...args) {
        if (!new.target) return new RealDate(now()).toString();
        return args.length === 0 ? new RealDate(now()) : new RealDate(...args);
    }
    SteppedDate.prototype = RealDate.prototype;
    SteppedDate.now = now;
    SteppedDate.parse = RealDate.parse;
    SteppedDate.UTC = RealDate.UTC;
    Object.defineProperty(RealDate.prototype, 'constructor', { value: SteppedDate, configurable: true, writable: true });
    globalThis.Date = SteppedDate;
})();
`;
}
