import { de1EmulationName, profileRunsAsDe1 } from './de1-emulation.js';

export function shownProfileName(profile, capabilities, fallback = '') {
    const title = profile && typeof profile.title === 'string' && profile.title !== ''
        ? profile.title : fallback;
    return de1EmulationName(title, profileRunsAsDe1(profile, capabilities));
}
