/**
 * led-colour.js — the 16-bit <-> 8-bit LED channel convention, and nothing else.
 * Wave 5.4, row `d7-led-live-preview`.
 *
 * SCOPE Part 6, the `led-color.js` row (51 -> ~25 lines): "port the four 16-bit<->8-bit
 * colour converters; do NOT port `ledPreviewComposite` or its two API wrappers".
 * Four functions came across, three did not, and the three that did not are named at the
 * bottom of this comment with the reason — a port that silently drops a function is
 * indistinguishable from a port that forgot one.
 *
 * ===========================================================================
 * THE WIRE FORMAT, VERIFIED ON BOTH SIDES AT THE PIN
 * ===========================================================================
 *
 * ReaPrime `lib/src/models/device/led_strip.dart` at 2b047d02:
 *
 *   class Color16 { final int red, green, blue; }              // 0..65535 each
 *   String toJson() => '${_hex4(red)}${_hex4(green)}${_hex4(blue)}';
 *   static String _hex4(int v) => v.toRadixString(16).padLeft(4, '0').toUpperCase();
 *   static Color16 fromJson(dynamic hex) {                     // < 12 chars -> off
 *       if (hex is! String || hex.length < 12) return off; ... }
 *
 * So a channel is FOUR uppercase hex digits and a colour is TWELVE — 'RRRRGGGGBBBB' —
 * and anything shorter is black on the server side too.
 *
 * ===========================================================================
 * WHICH 16-BIT SPELLING OF A BYTE, AND THE ANSWER CHANGED ON 29 AUGUST 2026
 * ===========================================================================
 *
 * There are two ways to widen an 8-bit channel to 16 and they are one part in 257 apart:
 * REPLICATE the byte (0xFF -> 0xFFFF) or SHIFT it (0xFF -> 0xFF00). This module replicated,
 * on the strength of the recorded fixture `tools/rea-fixtures/api__v1__machine__ledStrip
 * .json`, whose channels are '4A4A', '2B2B', 'FFFF', 'C1C1', '8080'.
 *
 * THE RUNNING MACHINE DISAGREES WITH THAT FIXTURE, and the machine is the truth teller (O2).
 * Measured on Ben's tablet, 29 August 2026 (`_audit/e2e-2026-08-29/settings-B-e2e.md` §3.5,
 * audit F-044): every colour the device was already holding is SHIFTED —
 * `frontStrip.awake` `FF00D900A000`, `backStrip` `FF00D3008E00` — and when the skin sent
 * the replicated `FFFF22220000`, ReaPrime stored and served back **`FF0022000000`**.
 *
 * SO A WRITE AND ITS READ-BACK WERE NEVER EQUAL. No colour was harmed — both forms decode
 * to the same `#ff2200` and the leaf read it back correctly — but any check comparing the
 * document sent with the document stored (a dirty flag, a test, a future `commit` guard)
 * sees a difference that is not one. The skin now sends the form the server keeps, so
 * `encode(decode(x))` is the identity on anything the machine serves.
 *
 * WHAT IT COSTS: at full brightness a channel is 65280 rather than 65535, which is 0.4 %
 * and is what ReaPrime writes for its own colours anyway. A skin that insisted on the last
 * 0.4 % would be the only writer on the machine using a different convention.
 *
 * THE FIXTURE IS NOT EDITED. It is a recording, and a recording is evidence; that it shows
 * the other form is a fact about whatever wrote those colours, not a licence to rewrite it.
 * `decode` ignores the low byte, so a replicated colour still reads correctly — it is only
 * re-encoded into canonical form on the way back out.
 *
 * THE ROUND TRIP IS LOSSLESS IN THE DIRECTION THAT MATTERS. 8 bits map UP by shifting and
 * 16 bits map DOWN by taking the HIGH byte, so 8 -> 16 -> 8 is the identity. 16 -> 8 -> 16
 * is the identity too for a CANONICAL colour, and is NOT for one in any other spelling: a
 * machine holding 0xABCD reads out as 0xAB and would write back as 0xAB00. The low byte is
 * unreachable from an 8-bit picker, which is why the preview writes only the colour the
 * user picked and never a re-encoded read-back.
 *
 * ===========================================================================
 * WHAT DID NOT COME ACROSS
 * ===========================================================================
 *
 *   ledPreviewComposite   composed a `{front, back}` payload for `previewLedStrip`.
 *   previewLedStrip       POST /machine/ledStrip/preview
 *   clearLedStripPreview  POST /machine/ledStrip/preview/clear
 *
 * The last two ROUTES DO NOT EXIST IN REAPRIME and were re-verified on the day this file
 * was written: `grep -rn 'ledStrip/preview\|previewLedStrip\|preview/clear' lib/` over
 * the worktree at 2b047d02 returns nothing, against 30 hits for 'ledStrip'. They are on
 * `src/data/EXCLUDED.md:28` as an UPSTREAM ask, not skin work. `ledPreviewComposite`
 * existed only to feed them, so porting it would leave a function whose only caller
 * could not exist — the "dead surface" shape the audit spends a section on.
 *
 * NO DOM, NO NETWORK, NO TOKEN, NO COMPONENT. `src/lib`'s rule (SCOPE Part 2 §2), and
 * here it is also what makes the D7 drill possible: the store's write path can be
 * instrumented without a browser because the colour maths is not in it.
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

/**
 * ONE — an 8-bit channel (0..255) to its 4-char 16-bit hex, SHIFTED into the high byte.
 *
 * `byte << 8` is the server's own spelling: 0xAB -> 0xAB00. It was `(byte << 8) | byte`
 * — 0xAB -> 0xABAB — until 29 August 2026; read the "WHICH 16-BIT SPELLING" section at the
 * top of this file before changing it back, and in particular the measured
 * `FFFF22220000` -> `FF0022000000` (audit F-044).
 *
 * Out-of-range and non-numeric input clamps to the byte rather than throwing, because the
 * caller is a colour picker and a picker that can crash a settings page is worse than one
 * that saturates.
 */
export function led8to16(value) {
    const byte = Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0;
    return ((byte << 8) >>> 0).toString(16).padStart(4, '0').toUpperCase();
}

/**
 * TWO — an `{r, g, b}` triple (0..255 each) to the 12-char wire colour.
 *
 * The old skin's parameter was iro.js's `{r,g,b}` object; iro is not ported (the wheel is
 * not on the 57-item inventory) but the SHAPE is the natural one for a triple and it is
 * what `ledHexToRgb` below returns, so the two compose.
 */
export function ledRgbToColour16({ r, g, b } = {}) {
    return led8to16(r) + led8to16(g) + led8to16(b);
}

/**
 * THREE — the 12-char wire colour to '#RRGGBB', taking the HIGH byte of each channel.
 *
 * INVALID READS AS BLACK, and that is the server's own rule rather than a convenience:
 * `Color16.fromJson` returns `off` for anything under 12 characters, so a malformed
 * colour is black at both ends and the two sides cannot disagree about what a bad string
 * means. The caller that needs "absent" rather than "black" must ask whether the field
 * was there at all — which is the address layer's question, not this module's.
 */
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

/* ===========================================================================
 * Two conveniences that are the four composed, not a fifth conversion.
 * =========================================================================== */

/** '#RRGGBB' straight to the 12-char wire colour. `ledRgbToColour16(ledHex8ToRgb(h))`. */
export const ledHex8ToColour16 = (hex) => ledRgbToColour16(ledHex8ToRgb(hex));

/** True when a string is a colour ReaPrime would accept verbatim. */
export const isColour16 = (wire) => typeof wire === 'string' && COLOUR16_HEX.test(wire);

/** True when a string is one readable 16-bit channel. Used by the suite, not the screen. */
export const isChannel16 = (hex) => typeof hex === 'string' && CHANNEL_HEX.test(hex);

/**
 * A COLOUR IN THE FORM THE SERVER KEEPS — `encode(decode(x))`, and nothing else.
 * (Audit F-044, 29 August 2026.)
 *
 * WHAT IT IS FOR: comparing a document the skin is about to send with one the server
 * already holds. Before this, the two were never byte-equal even when they meant the same
 * colour, so a dirty flag built on string equality reported a change that did not exist.
 * Running BOTH sides through this makes the comparison mean what it says.
 *
 * IT IS NOT A VALIDATOR. An unreadable colour canonicalises to black, because that is
 * exactly what `Color16.fromJson` does with it at the other end — the two sides agree
 * about what a bad string means, which is the property `ledColour16ToHex8` was written to
 * keep. Ask `isColour16` if the question is "is this readable at all".
 */
export const canonicalColour16 = (wire) => ledHex8ToColour16(ledColour16ToHex8(wire));
