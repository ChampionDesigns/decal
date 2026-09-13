/** The A/B encoding for a comparison, shared by the plot and every comparison swatch.
 *  Colour stays CSS-owned; widths and dash lengths are layout CSS pixels. */
import { channelNameFor } from './chart-tokens.js';

export const COMPARISON_STROKES = Object.freeze({
    a: Object.freeze({
        measured: Object.freeze({ width: 4.5, dash: null, alpha: 1 }),
        target: Object.freeze({ width: 3.5, dash: 'compare-target-a', alpha: 1 }),
    }),
    b: Object.freeze({
        measured: Object.freeze({ width: 1.35, dash: null, alpha: 1 }),
        target: Object.freeze({ width: 1.05, dash: 'compare-target-b', alpha: 1 }),
    }),
});

export function comparisonStyle(key, group = 'a') {
    const channel = channelNameFor(String(key).replace(/^b:/, ''));
    const target = channel.startsWith('target-');
    const measured = target ? channel.slice('target-'.length) : channel;
    const slot = group === 'b' ? 'b' : 'a';
    return {
        ...COMPARISON_STROKES[slot][target ? 'target' : 'measured'],
        token: slot === 'b' ? `compare-b-${measured}` : measured,
    };
}
