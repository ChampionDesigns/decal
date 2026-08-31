/**
 * the render harness's four standing assertions, as helpers every component suite reuses.
 */

import assert from 'node:assert/strict';

/** A colour no palette would ever pick, so a drill can never coincide with a real value. */
export const DRILL_COLOUR = 'rgb(255, 0, 170)';
export const DRILL_LENGTH = '37px';
export const DRILL_WEIGHT = '800';

export async function assertTokenDrill(page, {
    token,
    value = DRILL_COLOUR,
    selector,
    property,
    pseudo = null,
    read = null,
    expected = null,
    expectLanding = true,
    expectMove = true,
    prepare = null,
    scope = null,
}) {
    const turn = scope
        ? (v) => page.setStyle(scope, { [token]: v })
        : (v) => page.setToken(token, v);
    const readValue = read
        ? () => read(page)
        : () => page.prop(selector, property, { pseudo });

    const where = read ? `${token} → custom reader` : `${token} → ${selector} { ${property} }`;

    if (prepare) await prepare(page);
    const before = await readValue();

    /* A DIAL THAT MUST NOT MOVE HAS NO LANDING. `expectMove: false` says the value is a
     * stated literal; asking where the token would have put it is asking about a path the
     * value deliberately does not take. */
    const target = expected
        ?? ((read || !expectLanding || !expectMove) ? null : await page.resolveValue(value, property));

    await turn(value);
    if (prepare) await prepare(page);
    const after = await readValue();

    await turn(null);
    if (prepare) await prepare(page);
    const restored = await readValue();

    if (expectMove) {
        assert.notDeepEqual(
            after, before,
            `token drill did not move anything — ${where}\n` +
            `  set ${token} to ${value} and the rendered value stayed ${JSON.stringify(before)}.\n` +
            '  Either the value is hard-coded (the failure this assertion exists for) or ' +
            'the selector/property pair does not read that token.',
        );
    } else {
        assert.deepEqual(
            after, before,
            `the value FOLLOWED a token it is meant to be independent of — ${where}\n` +
            `  set ${token} to ${value} and the rendered value moved to ${JSON.stringify(after)}.\n` +
            '  This value is a stated literal by decision; if that has changed, the caller ' +
            'is the place to argue it, not this dial.',
        );
    }

    if (target !== null) {
        assert.deepEqual(
            after, target,
            `token drill moved the value but not to the token — ${where}\n` +
            `  expected ${JSON.stringify(target)}, got ${JSON.stringify(after)}.`,
        );
    }

    assert.deepEqual(
        restored, before,
        `token drill did not restore — ${where}\n` +
        `  before ${JSON.stringify(before)}, after removing the override ${JSON.stringify(restored)}.\n` +
        '  Something other than the token is contributing to this value.',
    );

    return { token, before, after, restored, expected: target };
}

const SELECTION_STATE_SELECTOR =
    '[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [aria-current="true"], .is-selected, [selected]';

export function shadowSegments(value) {
    const out = [];
    let depth = 0;
    let start = 0;
    const text = String(value);
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
            out.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    out.push(text.slice(start).trim());
    return out.filter((segment) => segment.length > 0);
}

/** The segment `selectionSurface` itself contributes: always the last one. */
const dialSegment = (value) => shadowSegments(value).at(-1) ?? '';

export async function assertOneSelectionTreatment(
    page, { selected, unselected = null, weightDial = true, scope = null, contrast = 'face' },
) {
    const isSelected = await page.evalFn(
        (s, states) => window.__h.need(s).matches(states),
        selected, SELECTION_STATE_SELECTOR,
    );
    assert.ok(
        isSelected,
        `one-selection-treatment: ${selected} carries no selection state.\n` +
        `  Expected one of: ${SELECTION_STATE_SELECTOR}\n` +
        '  Selection is expressed as the aria state so accessibility state and visual ' +
        'state cannot drift (spec Appendix 15).',
    );

    const face = await page.resolveToken('--ui-selected-face', 'background-color', scope);
    const ink = await page.resolveToken('--ui-selected-ink', 'color', scope);

    const got = await page.computed(selected, ['background-color', 'color', 'box-shadow', 'text-shadow']);

    assert.equal(
        got['background-color'], face,
        `one-selection-treatment: ${selected} does not paint --ui-selected-face.\n` +
        `  --ui-selected-face resolves to ${face}; the element computes ${got['background-color']}.\n` +
        '  A component that paints its resting state with an ID selector (1,0,0) silently ' +
        'never turns selected — see base.js, usage rule 2.',
    );
    assert.equal(
        got.color, ink,
        `one-selection-treatment: ${selected} does not paint --ui-selected-ink.\n` +
        `  --ui-selected-ink resolves to ${ink}; the element computes ${got.color}.`,
    );

    const led = await assertTokenDrill(page, {
        token: '--ui-selected-led',
        value: DRILL_LENGTH,
        selector: selected,
        property: 'box-shadow',
        scope,
        // A length is not itself a box-shadow; the shape checks below own the landing.
        expectLanding: false,
    });
    const ledSegment = dialSegment(led.after);
    assert.match(
        ledSegment, /inset/,
        `one-selection-treatment: ${selected} does not draw the LED strip as an inset shadow.\n` +
        `  With --ui-selected-led at ${DRILL_LENGTH} the dial's box-shadow segment was ${ledSegment}\n` +
        `  (whole computed value: ${led.after}).`,
    );
    assert.match(
        ledSegment, new RegExp(`-?${parseFloat(DRILL_LENGTH)}px`),
        `one-selection-treatment: ${selected}'s LED shadow does not carry the dial's length.\n` +
        `  Expected ${DRILL_LENGTH} in ${ledSegment} (whole computed value: ${led.after}).`,
    );

    const glow = await assertTokenDrill(page, {
        token: '--ui-selected-glow',
        value: '60%',
        selector: selected,
        property: 'text-shadow',
        scope,
        expectLanding: false,
    });
    const glowSegment = dialSegment(glow.after);
    assert.ok(
        !/rgba\([^)]*,\s*0\)|\/\s*0\s*\)/.test(glowSegment),
        `one-selection-treatment: ${selected}'s glow stayed fully transparent at 60%.\n` +
        `  dial segment: ${glowSegment}\n` +
        `  whole computed text-shadow: ${glow.after}`,
    );

    let weight = null;
    if (weightDial) {
        weight = await assertTokenDrill(page, {
            token: '--ui-selected-weight',
            value: DRILL_WEIGHT,
            selector: selected,
            property: 'font-weight',
        });
    }

    const contrastProperty = contrast === 'led' ? 'box-shadow' : 'background-color';
    const contrastToken = contrast === 'led' ? '--ui-selected-led' : '--ui-selected-face';
    const contrastValue = contrast === 'led' ? DRILL_LENGTH : DRILL_COLOUR;

    let unselectedBefore = null;
    if (unselected) {
        unselectedBefore = await page.prop(unselected, contrastProperty);
        if (contrast === 'led') {
            assert.ok(
                !/-\d/.test(dialSegment(unselectedBefore)),
                `one-selection-treatment: the unselected element ${unselected} already draws the ` +
                `LED strip (${dialSegment(unselectedBefore)}), so nothing about the selected ` +
                'state is visible.',
            );
        } else {
            assert.notEqual(
                unselectedBefore, face,
                `one-selection-treatment: the unselected element ${unselected} is already painted ` +
                'with --ui-selected-face, so nothing about the selected state is visible.',
            );
        }
    }

    const drill = await assertTokenDrill(page, {
        token: contrastToken,
        value: contrastValue,
        selector: selected,
        property: contrastProperty,
        expectLanding: contrast !== 'led',
        scope,
    });

    if (unselected) {
        const restore = scope
            ? (v) => page.setStyle(scope, { [contrastToken]: v })
            : (v) => page.setToken(contrastToken, v);
        await restore(contrastValue);
        const unselectedDuring = await page.prop(unselected, contrastProperty);
        await restore(null);
        assert.equal(
            unselectedDuring, unselectedBefore,
            `one-selection-treatment: moving ${contrastToken} changed the UNSELECTED element ` +
            `${unselected} too (${unselectedBefore} → ${unselectedDuring}).\n` +
            '  The selection dials must only reach the selected state.',
        );
    }

    return { face, ink, led, glow, weight, faceDrill: drill };
}

export async function assertScrollFloor(page, {
    selector,
    squeeze = { 'block-size': '120px' },
    squeezeSelector = null,
    minBlockSize = null,
    axis = 'block',
}) {
    const target = squeezeSelector ?? selector;
    const restore = Object.fromEntries(Object.keys(squeeze).map((k) => [k, null]));

    await page.setStyle(target, squeeze);
    let m;
    try {
        m = await page.metrics(selector);
    } finally {
        await page.setStyle(target, restore);
    }

    const overflow = axis === 'inline' ? m.overflowX : m.overflowY;
    const scrollExtent = axis === 'inline' ? m.scrollWidth : m.scrollHeight;
    const clientExtent = axis === 'inline' ? m.clientWidth : m.clientHeight;
    const gutter = axis === 'inline' ? m.scrollbarBlock : m.scrollbarInline;

    assert.ok(
        scrollExtent > clientExtent + 0.5,
        `scroll-floor: ${selector} does not overflow at ${JSON.stringify(squeeze)} ` +
        `(scroll ${scrollExtent} vs client ${clientExtent}).\n` +
        '  The assertion would pass vacuously — squeeze harder or give it more content.',
    );

    assert.notEqual(
        overflow, 'hidden',
        `scroll-floor: ${selector} clips silently — overflow-${axis === 'inline' ? 'x' : 'y'} is hidden ` +
        `while content overflows by ${(scrollExtent - clientExtent).toFixed(1)}px.\n` +
        '  "The old app\'s default answer everywhere but the numpad was hidden" (Part 8 §2).',
    );

    assert.ok(
        gutter > 0,
        `scroll-floor: ${selector} overflows and scrolls but shows no scrollbar ` +
        `(gutter ${gutter}px, overflow ${overflow}).\n` +
        '  A region the user cannot tell is scrollable is the same defect one step later. ' +
        '(If this fails everywhere, check the harness is not launching Chrome with ' +
        '--hide-scrollbars — see cdp.js.)',
    );

    if (minBlockSize !== null) {
        const floor = parseFloat(minBlockSize);
        const measured = axis === 'inline' ? m.rect.width : m.rect.height;
        assert.ok(
            measured >= floor - 0.5,
            `scroll-floor: ${selector} shrank past its floor — ${measured.toFixed(1)}px against ` +
            `a stated minimum of ${floor}px.`,
        );
    }

    return m;
}

export async function assertFocusUnclipped(page, selector, { tolerance = 0.5 } = {}) {
    await page.focusVisible(selector);
    const g = await page.focusGeometry(selector);

    assert.ok(
        g.focusVisible,
        `focus-geometry: ${selector} does not match :focus-visible after a keyboard focus.\n` +
        '  Anchor: ' + g.anchor,
    );

    const expectWidth = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
    const expectColour = await page.resolveValue('var(--ui-steel)', 'outline-color');
    const offsetOutset = await page.resolveValue('var(--ui-focus-offset)', 'outline-offset');
    const offsetInset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');

    assert.notEqual(
        g.outlineStyle, 'none',
        `focus-geometry: ${selector} paints no focus ring at all (outline-style: none).\n` +
        '  Anchor: ' + g.anchor,
    );
    assert.equal(
        g.outlineWidth, expectWidth,
        `focus-geometry: ${selector}'s ring is not --ui-focus-w.\n` +
        `  token ${expectWidth}, computed ${g.outlineWidth}. One treatment, from the tokens (spec §3.6).`,
    );
    assert.equal(
        g.outlineColor, expectColour,
        `focus-geometry: ${selector}'s ring is not --ui-steel.\n` +
        `  token ${expectColour}, computed ${g.outlineColor}.`,
    );
    assert.ok(
        g.outlineOffset === offsetOutset || g.outlineOffset === offsetInset,
        `focus-geometry: ${selector}'s outline-offset is ${g.outlineOffset}, which is neither ` +
        `--ui-focus-offset (${offsetOutset}) nor --ui-focus-offset-inset (${offsetInset}).\n` +
        '  One ring treatment in exactly two offsets — a third is the sixth focus look starting.',
    );

    const clipped = [];
    for (const c of g.clippers) {
        const sides = [];
        if (g.ringRect.top < c.top - tolerance) sides.push('top');
        if (g.ringRect.left < c.left - tolerance) sides.push('left');
        if (g.ringRect.bottom > c.bottom + tolerance) sides.push('bottom');
        if (g.ringRect.right > c.right + tolerance) sides.push('right');
        if (sides.length) clipped.push({ ...c, sides });
    }

    assert.deepEqual(
        clipped, [],
        `focus-geometry: ${selector}'s ring is clipped — bug L24's class.\n` +
        `  ring   ${fmtRect(g.ringRect)}\n` +
        clipped
            .map((c) => `  clipped ${c.sides.join('+')} by ${c.anchor} ` +
                `(overflow ${c.overflowX}/${c.overflowY}) ${fmtRect(c)}`)
            .join('\n') +
        '\n  Either the clipping ancestor needs room, or this element needs ' +
        '--ui-focus-offset-inset (as .band does in the base fixture).',
    );

    return g;
}

function fmtRect(r) {
    return `[${r.left.toFixed(1)}, ${r.top.toFixed(1)} → ${r.right.toFixed(1)}, ${r.bottom.toFixed(1)}]`;
}

export async function assertHitFloor(page, selector, { mode = 'overlay', axes = ['inline', 'block'] } = {}) {
    const floor = parseFloat(await page.resolveValue('var(--ui-hit-min)', 'width'));
    const measured = mode === 'overlay'
        ? await page.computed(selector, ['width', 'height'], { pseudo: '::before' })
        : await page.computed(selector, ['width', 'height']);

    const got = { inline: parseFloat(measured.width), block: parseFloat(measured.height) };
    for (const axis of axes) {
        assert.ok(
            got[axis] >= floor - 0.5,
            `hit-floor: ${selector}'s ${axis} hit extent is ${got[axis]}px against a ` +
            `--ui-hit-min of ${floor}px (mode: ${mode}).\n` +
            '  Bugs P4 and L22 are exactly this — a floor the comment claims and the box does not have.',
        );
    }
    return { floor, ...got };
}

export async function pressBackdrop(page, native) {
    const card = await page.box(native);
    const vp = await page.evalFn(() => ({ w: window.innerWidth, h: window.innerHeight }));

    /* The four bands the centred card leaves free; press in the widest one. */
    const bands = [
        { x: card.left / 2, y: vp.h / 2, gap: card.left },
        { x: (card.right + vp.w) / 2, y: vp.h / 2, gap: vp.w - card.right },
        { x: vp.w / 2, y: card.top / 2, gap: card.top },
        { x: vp.w / 2, y: (card.bottom + vp.h) / 2, gap: vp.h - card.bottom },
    ].sort((a, b) => b.gap - a.gap);
    const point = bands[0];

    assert.ok(
        point.gap > 8,
        `pressBackdrop: the card ${fmtRect(card)} leaves no band inside ${vp.w}×${vp.h} to press in — `
        + 'a press that lands on the card is not a backdrop press at all',
    );
    assert.ok(
        point.x < card.left || point.x > card.right || point.y < card.top || point.y > card.bottom,
        `pressBackdrop: computed point (${point.x}, ${point.y}) is inside the card ${fmtRect(card)}`,
    );

    /* A press AND a release at the same outside point: `#onPointerDown`
     * (`ui-dialog.js:1116-1118`) latches where the gesture started, so a dismissal is
     * two points and not one. */
    await page.mouse('mousePressed', point.x, point.y, { button: 'left', clickCount: 1 });
    await page.mouse('mouseReleased', point.x, point.y, { button: 'left', clickCount: 1 });
    await page.settle(3);
    return point;
}
