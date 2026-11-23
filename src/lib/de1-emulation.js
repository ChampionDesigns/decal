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

export function nativeShapingShown(profile, capabilities) {
    return de1EmulationSupported(capabilities) && !de1EmulationOf(profile);
}

export const DE1_EMULATION_PREFIX = 'B-DE1 · ';

export const DE1_EMULATION_SHOT_KEY = 'de1Emulation';

export function profileRunsAsDe1(profile, capabilities) {
    return de1EmulationOf(profile)
        && de1EmulationSupported(capabilities)
        && de1EmulationBlockOf(profile.steps) === DE1_EMULATION_BLOCK.NONE;
}

export function shotRanAsDe1(shot) {
    return Boolean(shot) && typeof shot === 'object' && shot[DE1_EMULATION_SHOT_KEY] === true;
}

export function de1EmulationName(title, emulated) {
    if (typeof title !== 'string' || title === '') return title;
    if (emulated !== true || title.startsWith(DE1_EMULATION_PREFIX)) return title;
    return `${DE1_EMULATION_PREFIX}${title}`;
}
