/**
 * The pure half of #18's modality (src/lib/focus-trap.js).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    NON_RENDERED_TAGS,
    deepActiveElement,
    firstAutofocus,
    flatChildren,
    flatTabbables,
    isRendered,
    isTabbable,
    trapTarget,
} from '../src/lib/focus-trap.js';

/** A plain element. `tabIndex` defaults to -1, which is what a <div> reports. */
const el = (tagName, props = {}, children = []) => ({
    tagName,
    tabIndex: -1,
    children,
    getClientRects: () => [{}],
    hasAttribute: () => false,
    getAttribute: () => null,
    focus() { this.focused = true; },
    ...props,
});

/** A focusable control: what a <button> reports. */
const control = (id, props = {}) => el('BUTTON', { id, tabIndex: 0, ...props });

/** A slot with an assignment. */
const slot = (assigned, fallback = []) => ({
    tagName: 'SLOT',
    tabIndex: -1,
    children: fallback,
    assignedElements: () => (assigned.length ? assigned : fallback),
});

/** A shadow host: light children are reachable ONLY through the slots inside. */
const host = (tagName, shadowChildren, lightChildren = []) => el(tagName, {
    shadowRoot: { children: shadowChildren },
    children: lightChildren,
});

describe('flatChildren — three cases, in the order they must be tested', () => {
    test('a slot yields its assigned elements, not its own children', () => {
        const assigned = control('slotted');
        const fallbackOnly = control('fallback');
        assert.deepEqual(flatChildren(slot([assigned], [fallbackOnly])), [assigned]);
    });

    test('an EMPTY slot yields its fallback content — where #18 keeps its default header', () => {
        const fallback = control('fallback');
        assert.deepEqual(flatChildren(slot([], [fallback])), [fallback]);
    });

    test('a shadow host yields its shadow children and NOT its light children', () => {
        const shadow = control('inner');
        const light = control('outer');
        const node = host('UI-BUTTON', [shadow], [light]);
        assert.deepEqual(flatChildren(node), [shadow],
            'light children are rendered where a slot assigns them; yielding both visits them twice');
    });

    test('anything else yields its element children', () => {
        const kid = control('kid');
        assert.deepEqual(flatChildren(el('DIV', {}, [kid])), [kid]);
    });

    test('a missing node is an empty list rather than a throw', () => {
        assert.deepEqual(flatChildren(null), []);
        assert.deepEqual(flatChildren(undefined), []);
    });
});

describe('isTabbable — tabIndex is the discriminator, with four vetoes', () => {
    test('a control with tabIndex 0 is tabbable', () => {
        assert.equal(isTabbable(control('ok')), true);
    });

    test('a div (tabIndex -1) is not', () => {
        assert.equal(isTabbable(el('DIV')), false);
    });

    test('a DISABLED control still reports tabIndex 0 and must be skipped anyway', () => {
        const button = control('off', { disabled: true });
        assert.equal(button.tabIndex, 0, 'the fake models the platform: disabled does not change tabIndex');
        assert.equal(isTabbable(button), false);
    });

    test('inert, hidden and aria-hidden are each a veto', () => {
        assert.equal(isTabbable(control('a', { inert: true })), false);
        assert.equal(isTabbable(control('b', { hidden: true })), false);
        assert.equal(isTabbable(control('c', { getAttribute: (n) => (n === 'aria-hidden' ? 'true' : null) })), false);
    });

    test('an unrendered control is not tabbable — no client rects', () => {
        assert.equal(isTabbable(control('gone', { getClientRects: () => [] })), false);
    });

    test('checkVisibility wins when the element has it, and is NOT asked about opacity', () => {
        const asked = [];
        const fading = control('fading', {
            checkVisibility: (opts) => { asked.push(opts); return true; },
        });
        assert.equal(isTabbable(fading), true);
        assert.equal(asked.length, 1);
        assert.equal('checkOpacity' in asked[0], false,
            '#18 fades its dialog in over --ui-dur; a trap that went blind for 120ms has a door in it');
        assert.equal('opacityProperty' in asked[0], false);
    });

    test('a host custom element without delegatesFocus is skipped; its inner control is not', () => {
        const inner = control('control');
        const button = host('UI-BUTTON', [inner]);
        assert.equal(isTabbable(button), false, 'the ui-button host reports tabIndex -1');
        assert.deepEqual(flatTabbables(el('DIV', {}, [button])), [inner]);
    });
});

describe('isRendered', () => {
    test('falls back to client rects, then to true', () => {
        assert.equal(isRendered({ getClientRects: () => [] }), false);
        assert.equal(isRendered({ getClientRects: () => [{}] }), true);
        assert.equal(isRendered({}), true);
        assert.equal(isRendered(null), false);
    });
});

describe('flatTabbables — the dialog shape', () => {
    const buildDialog = () => {
        const closeButton = control('close');
        const slotted1 = control('slotted-1');
        const slotted2 = control('slotted-2');
        const cancel = control('cancel');
        const confirm = control('confirm');
        const dialog = el('DIALOG', {}, [
            el('DIV', { id: 'head' }, [closeButton]),
            el('DIV', { id: 'body' }, [slot([slotted1, slotted2])]),
            el('DIV', { id: 'actions' }, [slot([cancel, confirm])]),
        ]);
        return { dialog, order: [closeButton, slotted1, slotted2, cancel, confirm] };
    };

    test('slotted body content is found, in flat-tree order, between header and footer', () => {
        const { dialog, order } = buildDialog();
        assert.deepEqual(flatTabbables(dialog).map((n) => n.id), order.map((n) => n.id));
    });

    test('a DOM-tree walk would miss the body entirely — the reason this module exists', () => {
        const { dialog } = buildDialog();
        const domOnly = [];
        (function walk(node) {
            for (const child of node.children ?? []) { if (isTabbable(child)) domOnly.push(child); walk(child); }
        })(dialog);
        assert.deepEqual(domOnly.map((n) => n.id), ['close'],
            'querySelectorAll on the dialog finds the header and misses every slotted control');
    });

    test('an inert subtree is not entered at all', () => {
        const hidden = control('behind');
        const pane = el('DIV', { inert: true }, [hidden]);
        const live = control('live');
        assert.deepEqual(flatTabbables(el('DIV', {}, [pane, live])).map((n) => n.id), ['live']);
    });

    test('script and style are skipped without descending into them', () => {
        const inside = control('inside-a-template');
        const templates = NON_RENDERED_TAGS.map((tag) => el(tag, {}, [inside]));
        assert.deepEqual(flatTabbables(el('DIV', {}, templates)), []);
    });

    test('no element is visited twice, however many slots point at it', () => {
        const shared = control('shared');
        const tree = el('DIV', {}, [slot([shared]), slot([shared])]);
        assert.deepEqual(flatTabbables(tree).map((n) => n.id), ['shared']);
    });

    test('a control that is itself a container still contributes its own children', () => {
        const inner = control('inner');
        const outer = control('outer', { children: [inner] });
        assert.deepEqual(flatTabbables(el('DIV', {}, [outer])).map((n) => n.id), ['outer', 'inner']);
    });

    test('an empty dialog has an empty list — the case the component focuses itself for', () => {
        assert.deepEqual(flatTabbables(el('DIALOG', {}, [el('P')])), []);
    });
});

describe('firstAutofocus', () => {
    test('finds an autofocus control in the SLOTTED body, which showModal cannot', () => {
        const wanted = control('wanted', { autofocus: true });
        const dialog = el('DIALOG', {}, [
            el('DIV', {}, [control('close')]),
            el('DIV', {}, [slot([control('first'), wanted])]),
        ]);
        assert.equal(firstAutofocus(dialog), wanted);
    });

    test('reads the attribute form too', () => {
        const wanted = control('wanted', { hasAttribute: (n) => n === 'autofocus' });
        assert.equal(firstAutofocus(el('DIALOG', {}, [control('a'), wanted])), wanted);
    });

    test('an autofocus that is not tabbable is not honoured', () => {
        const disabled = control('nope', { autofocus: true, disabled: true });
        assert.equal(firstAutofocus(el('DIALOG', {}, [disabled])), null);
    });

    test('nothing asking for focus is null, not the first control', () => {
        assert.equal(firstAutofocus(el('DIALOG', {}, [control('a'), control('b')])), null);
    });
});

describe('trapTarget — the two wrap steps, and nothing else', () => {
    const items = ['a', 'b', 'c'];

    test('forward from the last wraps to the first', () => {
        assert.equal(trapTarget(items, 'c'), 'a');
    });

    test('backward from the first wraps to the last', () => {
        assert.equal(trapTarget(items, 'a', { backwards: true }), 'c');
    });

    test('an interior step returns null — the browser owns it', () => {
        assert.equal(trapTarget(items, 'a'), null);
        assert.equal(trapTarget(items, 'b'), null);
        assert.equal(trapTarget(items, 'b', { backwards: true }), null);
        assert.equal(trapTarget(items, 'c', { backwards: true }), null);
    });

    test('from outside the list the caret is pulled in — first, or last going backwards', () => {
        assert.equal(trapTarget(items, null), 'a');
        assert.equal(trapTarget(items, 'elsewhere'), 'a');
        assert.equal(trapTarget(items, null, { backwards: true }), 'c');
    });

    test('a single control cycles to itself in both directions', () => {
        assert.equal(trapTarget(['only'], 'only'), 'only');
        assert.equal(trapTarget(['only'], 'only', { backwards: true }), 'only');
    });

    test('an empty list is null, both directions — the component focuses the dialog instead', () => {
        assert.equal(trapTarget([], null), null);
        assert.equal(trapTarget([], 'a', { backwards: true }), null);
        assert.equal(trapTarget(null, 'a'), null);
    });
});

describe('deepActiveElement', () => {
    test('walks through nested shadow roots to the leaf', () => {
        const leaf = control('leaf');
        const inner = { shadowRoot: { activeElement: leaf } };
        const outer = { shadowRoot: { activeElement: inner } };
        assert.equal(deepActiveElement({ activeElement: outer }), leaf);
    });

    test('stops where the chain does', () => {
        const plain = control('plain');
        assert.equal(deepActiveElement({ activeElement: plain }), plain);
        assert.equal(deepActiveElement({ activeElement: null }), null);
        assert.equal(deepActiveElement(null), null);
    });
});
