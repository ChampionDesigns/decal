/**
 * The gallery's loader for.
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
