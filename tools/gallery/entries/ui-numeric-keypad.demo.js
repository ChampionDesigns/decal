/**
 * ui-numeric-keypad.demo.js — the gallery's loader for component #53, the numpad body.
 *
 * WHY A DEMO SIDECAR AND NOT A BARE `module`. Two reasons, both structural.
 *
 * 1. gallery.js does one `import(entry.module)` per entry (gallery.js:46-51, :78), and
 *    it then waits on `customElements.whenDefined()` for EVERY hyphenated tag it finds
 *    on the mounted stage (gallery.js:86-88). A state that puts `<ui-button>` or
 *    `<ui-keycap>` on the stage without their modules imported does not fail — it hangs
 *    forever with no error, which `ui-menu.demo.js` measured in full. #53 imports all
 *    three itself, so this file's job is really reason 2.
 *
 * 2. THE LIMITS TABLE IS A PROPERTY, NEVER AN ATTRIBUTE, and a gallery state is a
 *    string of HTML. B2 says there is ONE limits table in the skin and it lives behind
 *    the R2 adapter; a `limits='{"dose":{"min":1,…}}'` attribute in a gallery state
 *    would be the second hand-written copy that decision exists to forbid. So the
 *    states mount thin SUBCLASSES that set `limits` from the port itself — the same
 *    shape `ui-data-grid.demo.js` uses for its rows.
 *
 * `limitsFor()` is imported here and nowhere in `src/`: a screen gets the table from
 * `capabilitiesStore.machineLimits().value`, which is the R2 envelope, and the gallery
 * has no store. The gallery is scaffolding, not shipping surface
 * (tools/gallery/README.md), and this import is the whole of the difference.
 *
 * THE STEAM STATES ARE THE POINT OF THE FILE. B3: Slate's steam row was 130..170 and
 * 130 °C is inside the dead band where the heater is off, so its clamp snapped users
 * onto a temperature the machine does not hold. `steam-bengle` and `steam-de1` below
 * are the corrected row on the two machine classes — floor 135, ceiling 165 and 160
 * (`doc/Skins.md:573`) — and `steam-unknown` is what an unresolved machine class looks
 * like: no row, no keypad, no invented ceiling (A7).
 */

import { limitsFor } from '../../../src/lib/machine-limits.js';
import { UiNumericKeypad } from '../../../src/components/ui-numeric-keypad.js';

/** The Bengle table. The steam row is present because the class is known. */
const BENGLE = limitsFor('bengle');

/** The DE1 table — every row identical except the steam ceiling. */
const DE1 = limitsFor('de1');

/** No machine class yet: the machine-independent rows only, and NO steam row. */
const UNKNOWN = limitsFor(null);

/** Dose in — an integer step, so the decimal key is off, and a history of recents. */
class UiNumericKeypadDose extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Dose in';
        this.limitKey = 'dose';
        this.unit = 'g';
        this.value = '18';
        this.limits = BENGLE;
        this.previous = ['18', '18.5', '20', '17'];
    }
}

/** Drink out — the same shape with a four-digit ceiling and no recents. */
class UiNumericKeypadDrink extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Drink out';
        this.limitKey = 'drinkWeight';
        this.unit = 'g';
        this.value = '40';
        this.limits = BENGLE;
    }
}

/** Steam flow — a fractional step, so the decimal key is live. */
class UiNumericKeypadFlow extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Steam flow';
        this.limitKey = 'steamFlow';
        this.unit = 'mL/s';
        this.value = '1.2';
        this.limits = BENGLE;
    }
}

/** Steam temperature on a Bengle: 0 or 135–165. The hole is in the hint. */
class UiNumericKeypadSteamBengle extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Steam temperature';
        this.limitKey = 'steamTemp';
        this.unit = '°C';
        this.value = '155';
        this.limits = BENGLE;
    }
}

/** The same field on a DE1: 0 or 135–160. One number apart, from one table. */
class UiNumericKeypadSteamDe1 extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Steam temperature';
        this.limitKey = 'steamTemp';
        this.unit = '°C';
        this.value = '150';
        this.limits = DE1;
    }
}

/** The machine class has not arrived, so the table carries no steam row. */
class UiNumericKeypadSteamUnknown extends UiNumericKeypad {
    constructor() {
        super();
        this.heading = 'Steam temperature';
        this.limitKey = 'steamTemp';
        this.unit = '°C';
        this.value = '';
        this.limits = UNKNOWN;
    }
}

customElements.define('ui-numeric-keypad-dose', UiNumericKeypadDose);
customElements.define('ui-numeric-keypad-drink', UiNumericKeypadDrink);
customElements.define('ui-numeric-keypad-flow', UiNumericKeypadFlow);
customElements.define('ui-numeric-keypad-steam-bengle', UiNumericKeypadSteamBengle);
customElements.define('ui-numeric-keypad-steam-de1', UiNumericKeypadSteamDe1);
customElements.define('ui-numeric-keypad-steam-unknown', UiNumericKeypadSteamUnknown);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
export { BENGLE, DE1, UNKNOWN };
