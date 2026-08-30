/**
 * The 16-bit <-> 8-bit LED channel convention, and nothing else.
 */

/** Four uppercase hex digits per channel — the format `Color16.toJson` writes. */
const CHANNEL_HEX = /^[0-9A-Fa-f]{4}$/;

/** Twelve hex digits, 'RRRRGGGGBBBB'. `Color16.fromJson` accepts nothing shorter. */
const COLOUR16_HEX = /^[0-9A-Fa-f]{12}$/;

/** '#RRGGBB', with the hash optional on the way in. */
const HEX8 = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/;

/** The 16-bit spelling of black. What ReaPrime's `Color16.off` serialises to. */
export const COLOUR16_OFF = '000000000000';

/** The 8-bit spelling of black. What an unreadable colour reads as. */
export const HEX8_BLACK = '#000000';

export function led8to16(value) {
    const byte = Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;
    return ((byte << 8) >>> 0).toString(16).padStart(4, '0').toUpperCase();
}

export function ledRgbToColour16({ r, g, b } = {}) {
    return led8to16(r) + led8to16(g) + led8to16(b);
}

export function ledColour16ToHex8(wire) {
    if (typeof wire !== 'string' || !COLOUR16_HEX.test(wire)) return HEX8_BLACK;
    const high = (offset) => wire.slice(offset, offset + 2).toLowerCase();
    return `#${high(0)}${high(4)}${high(8)}`;
}

/**
 * FOUR — '#RRGGBB' (hash optional) to an `{r, g, b}` triple. Invalid reads as black.
 */
export function ledHex8ToRgb(hex) {
    const match = HEX8.exec(typeof hex === 'string' ? hex.trim() : '');
    if (!match) return Object.freeze({ r: 0, g: 0, b: 0 });
    return Object.freeze({
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
    });
}

/** '#RRGGBB' straight to the 12-char wire colour. `ledRgbToColour16(ledHex8ToRgb(h))`. */
export const ledHex8ToColour16 = (hex) => ledRgbToColour16(ledHex8ToRgb(hex));

/** True when a string is a colour ReaPrime would accept verbatim. */
export const isColour16 = (wire) => typeof wire === 'string' && COLOUR16_HEX.test(wire);

/** True when a string is one readable 16-bit channel. Used by the suite, not the screen. */
export const isChannel16 = (hex) => typeof hex === 'string' && CHANNEL_HEX.test(hex);

export const canonicalColour16 = (wire) => ledHex8ToColour16(ledColour16ToHex8(wire));
