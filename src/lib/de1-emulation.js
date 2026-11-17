export const DE1_EMULATION_KEY = 'de1_emulation';

export const DE1_EMULATION_BLOCK = Object.freeze({
    NONE: null,
    POWER: 'power',
    LEVER: 'lever',
    HOLD: 'hold',
});

export function de1EmulationOf(profile) {
    return Boolean(profile) && profile[DE1_EMULATION_KEY] === true;
}

export function withDe1Emulation(profile, on) {
    return { ...(profile ?? {}), [DE1_EMULATION_KEY]: on === true };
}

export function de1EmulationBlockOf(steps) {
    if (!Array.isArray(steps)) return DE1_EMULATION_BLOCK.NONE;
    for (const step of steps) {
        if (!step) continue;
        if (step.pump === 'power') return DE1_EMULATION_BLOCK.POWER;
        if (step.pump === 'lever') return DE1_EMULATION_BLOCK.LEVER;
        if (step.transition === 'hold') return DE1_EMULATION_BLOCK.HOLD;
    }
    return DE1_EMULATION_BLOCK.NONE;
}

export function de1EmulationSupported(capabilities) {
    const answer = capabilities?.de1Emulation?.() ?? null;
    return answer === true;
}
