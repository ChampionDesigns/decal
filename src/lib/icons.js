/**
 * The drawn marks this skin uses more than once, as Lit templates.
 */

import { html, svg } from 'lit';

export function penIcon() {
    return html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    ><path d="M12 20h9"></path><path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
    ></path></svg>`;
}

export function historyIcon() {
    return html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    ><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path
        d="M3 3v5h5"
    ></path><path d="M12 7v5l3 2"></path></svg>`;
}

export function backIcon() {
    return html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    ><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>`;
}

const weatherSvg = (paths) => html`<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>${paths}</svg>`;

/** The cloud every wet mark hangs its weather under. */
const cloudPath = svg`<path d="M17.5 19H9a4.5 4.5 0 1 1 1.6-8.7A5.5 5.5 0 0 1 21 12.5a3.3 3.3 0 0 1-3.5 6.5Z"></path>`;

export function clearIcon() {
    return weatherSvg(svg`<circle cx="12" cy="12" r="4"></circle><path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
    ></path>`);
}

export function clearNightIcon() {
    return weatherSvg(svg`<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5Z"></path>`);
}

export function partlyIcon() {
    return weatherSvg(svg`<path
        d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4M20 12h2"
    ></path><path d="M16 8.5A4.5 4.5 0 1 0 8.2 11"></path>${cloudPath}`);
}

export function partlyNightIcon() {
    return weatherSvg(svg`<path
        d="M18.5 8.5A6 6 0 0 1 11 3a5 5 0 1 0 6 7"
    ></path>${cloudPath}`);
}

export function overcastIcon() {
    return weatherSvg(svg`<path
        d="M17.5 19H9a5.5 5.5 0 1 1 1.6-10.8A6 6 0 0 1 22 11.5a3.8 3.8 0 0 1-4.5 7.5Z"
    ></path>`);
}

export function fogIcon() {
    return weatherSvg(svg`<path
        d="M16.5 14H9a4.5 4.5 0 1 1 1.4-8.8A5.4 5.4 0 0 1 20.5 8a3.4 3.4 0 0 1-4 6Z"
    ></path><path d="M6 18h12M8 21h8"></path>`);
}

export function drizzleIcon() {
    return weatherSvg(svg`<path
        d="M16.5 13H9a4.5 4.5 0 1 1 1.4-8.8A5.4 5.4 0 0 1 20.5 7a3.4 3.4 0 0 1-4 6Z"
    ></path><path d="M8 17v1.5M12 17v2.5M16 17v1.5"></path>`);
}

export function rainIcon() {
    return weatherSvg(svg`<path
        d="M16.5 13H9a4.5 4.5 0 1 1 1.4-8.8A5.4 5.4 0 0 1 20.5 7a3.4 3.4 0 0 1-4 6Z"
    ></path><path d="M8 16.5 7 20M12 16.5 11 20M16 16.5 15 20"></path>`);
}

export function snowIcon() {
    return weatherSvg(svg`<path
        d="M16.5 13H9a4.5 4.5 0 1 1 1.4-8.8A5.4 5.4 0 0 1 20.5 7a3.4 3.4 0 0 1-4 6Z"
    ></path><path d="M8 17h.01M12 19h.01M16 17h.01M10 20h.01M14 20h.01"></path>`);
}

export function thunderIcon() {
    return weatherSvg(svg`<path
        d="M16.5 13H9a4.5 4.5 0 1 1 1.4-8.8A5.4 5.4 0 0 1 20.5 7a3.4 3.4 0 0 1-4 6Z"
    ></path><path d="m13 16-3 4h4l-3 4"></path>`);
}

/** A dropped pin, for the corner that has no location yet. */
export function placeIcon() {
    return weatherSvg(svg`<path
        d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"
    ></path><circle cx="12" cy="10" r="2.6"></circle>`);
}

const WEATHER_MARKS = Object.freeze({
    clear: clearIcon,
    clearNight: clearNightIcon,
    partly: partlyIcon,
    partlyNight: partlyNightIcon,
    overcast: overcastIcon,
    fog: fogIcon,
    drizzle: drizzleIcon,
    rain: rainIcon,
    snow: snowIcon,
    thunder: thunderIcon,
});

/** The drawing for a mark name, or the overcast cloud for a name nothing draws. */
export function weatherIcon(mark) {
    return (WEATHER_MARKS[mark] || overcastIcon)();
}

export function gearIcon() {
    return html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
    >${svg`<path d="M20 7h-9M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle
        cx="7" cy="7" r="3"
    ></circle>`}</svg>`;
}
