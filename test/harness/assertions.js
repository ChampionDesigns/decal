/**
 * assertions.js — Gate A's four standing assertions, as helpers every component
 * suite reuses.
 *
 * SCOPE Part 8 §2 lists them, "each answering a recorded failure":
 *
 *   1. Tokens are consumed, not copied — set a token on :root, assert the rendered
 *      value moves. "The drill is literally what Radian will do." Chart colour is
 *      included: retargeting --ui-channel-pressure must move the drawn trace (A6),
 *      which the old inline-style-on-<html> mechanism made impossible to even test.
 *   2. One selection treatment — every selectable component renders its selected
 *      state from the four selection dials (slate-tokens.css:188-191, spec §3.9).
 *      "The old skin had six treatments across thirteen implementations; the test is
 *      what stops the seventh."
 *   3. Scroll floors and stated overflow (spec §2.4) — shrink the container, assert
 *      the region stops at its min-height and shows a visible scrollbar rather than
 *      silently clipping. "The old app's default answer everywhere but the numpad
 *      was hidden."
 *   4. Focus geometry from --ui-focus-*, unclipped — bug L24's class (rings clipped
 *      on all four sides by the component they sit inside) as a computed-style
 *      assertion.
 *
 * THE COMMON SHAPE. Each takes the page and a description of what to look at, does
 * the poking itself, restores whatever it changed, and returns the numbers it
 * measured so a caller can assert something extra. Each fails with the measurement
 * in the message — a Gate A failure should be readable without re-running it.
 *
 * WHY EACH ONE RESTORES. Suites open one page per test but a fixture-heavy suite may
 * not; a drill that leaves --ui-steel overridden turns the next assertion into a
 * mystery. Restoration is also load-bearing evidence: a value that moves on the
 * drill and comes back on the restore was READ from the token, not coincidentally
 * equal to it.
 */

import assert from 'node:assert/strict';

/** A colour no palette would ever pick, so a drill can never coincide with a real value. */
export const DRILL_COLOUR = 'rgb(255, 0, 170)';
export const DRILL_LENGTH = '37px';
/** A weight no type scale in the register carries — §3.5 names 300/400/500/600/700. */
export const DRILL_WEIGHT = '800';

/* ===========================================================================
 * 1. TOKENS ARE CONSUMED, NOT COPIED
 * =========================================================================== */

/**
 * Set a token on :root and assert the rendered value moves — and moves back.
 *
 * @param page      a harness Page
 * @param opts.token      e.g. '--ui-steel'
 * @param opts.value      the drill value, e.g. DRILL_COLOUR
 * @param opts.selector   deep selector for the element to read
 * @param opts.property   the rendered property, e.g. 'outline-color'
 * @param opts.pseudo     optional pseudo-element
 * @param opts.read       optional custom reader `async (page) => value`, for
 *                        anything getComputedStyle cannot see — a canvas pixel, for
 *                        the A6 chart-channel drill. With a custom reader the
 *                        assertion checks movement and restoration but not the exact
 *                        landing value, unless `expected` is supplied.
 * @param opts.expected   optional expected post-drill value
 * @param opts.expectLanding  default true: as well as moving, the rendered value
 *                        must land on what the engine computes for the drill value.
 *                        Set false when the token is only a COMPONENT of the
 *                        property — a length inside a box-shadow, a percentage
 *                        inside a color-mix — where `37px` is not itself a legal
 *                        box-shadow and resolving it yields `none`. The caller then
 *                        owns the shape check.
 * @param opts.prepare    optional `async (page) => {}` run before each read (to
 *                        re-establish focus, hover, a selected state …)
 */
export async function assertTokenDrill(page, {
    token,
    value = DRILL_COLOUR,
    selector,
    property,
    pseudo = null,
    read = null,
    expected = null,
    expectLanding = true,
    /**
     * Does turning this dial MOVE the value?
     *
     * True is the ordinary claim and the reason this helper exists: a rendered value that
     * does not follow its token is hard-coded, and that is the failure it hunts.
     *
     * FALSE IS THE INVERSE CLAIM AND IT IS NOT A WAY OUT OF THE FIRST. Some values are
     * deliberately literals — Ben has ruled that way more than once, choosing a measured
     * Slate number the scale cannot express ("Use slates 14": the unit is exactly half the
     * 27px value beside it, and the scale has 12 and 15 and nothing between). A test that
     * simply stopped drilling would leave nothing at all watching that number. With
     * `expectMove: false` the assertion INVERTS: turning the dial must change nothing, so
     * the literal cannot quietly become a token again without this failing.
     */
    expectMove = true,
    prepare = null,
    scope = null,
}) {
    /* `scope` TURNS THE DIAL WHERE THE ELEMENT READS IT. setToken writes on :root, and
     * a :root override cannot reach past a more specific declaration — styles/tokens.css
     * aims three selection dials at `ui-preset-bank` for Slate's underlined-number
     * preset idiom (Ben, 23 Aug 2026). Drilling at :root there moves nothing and reads
     * as "the value is hard-coded", which is the opposite of the truth. An inline
     * property on the scope element beats both, so the drill still proves the only
     * thing it is for: the rendered value follows the dial. */
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

/* ===========================================================================
 * 2. ONE SELECTION TREATMENT
 * =========================================================================== */

const SELECTION_STATE_SELECTOR =
    '[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [aria-current="true"], .is-selected, [selected]';

/**
 * Split a computed `box-shadow` / `text-shadow` into its segments.
 *
 * Depth-aware, because a naive `split(',')` cuts `rgba(0, 0, 0, 0)` into four pieces
 * and `color(srgb 0 0 0 / 0)` into one — so the two colour serialisations Chrome uses
 * would behave differently in the same assertion.
 *
 * WHY THE SEGMENTS MATTER. `selectionSurface` composes rather than replaces: each
 * shadow declaration is `var(--_ui-rest-shadow, 0 0 transparent), <the dial's own>`,
 * so a component can keep a resting inset seam (--ui-seam-ink, the one-piece bank)
 * through selection. The dial's segment is therefore the LAST one, and an assertion
 * that matched the whole string would be satisfied — or defeated — by the component's
 * own resting paint sitting in front of it.
 */
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

/**
 * Assert a selected element is painted by the five dials and nothing else.
 *
 * Checks, in order:
 *   a. the element actually carries a selection state — otherwise the whole
 *      assertion is vacuous, which is how a treatment check quietly stops covering
 *      its target;
 *   b. face and ink equal the resolved --ui-selected-face / --ui-selected-ink;
 *   c. the LED length, the glow percentage and the WEIGHT are the dials' — proved by
 *      moving them, because reading a 0px LED off a 0px token proves nothing, and
 *      because a weight that happens to match is not a weight the dial reaches;
 *   d. an unselected sibling, if given, is NOT painted with the face — the
 *      treatment is state-driven rather than always-on;
 *   e. moving --ui-selected-face moves the selected element and leaves the
 *      unselected one alone.
 *
 * THE WEIGHT DIAL IS SKIPPABLE, and exactly one component uses the escape: a
 * component whose RESTING weight is already an emphasis declares --_ui-rest-weight
 * (base.js) and keeps it through selection, which is Slate's own behaviour for
 * .hv-pick-btn (600 selected and resting alike). Pass `weightDial: false` there.
 */
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

    /* `scope` RESOLVES THE DIALS WHERE THE ELEMENT READS THEM. A dial is not always a
     * :root value: styles/tokens.css aims the three selection dials at `ui-preset-bank`
     * so that one row wears Slate's underlined-number idiom (Ben, 23 Aug 2026). Without
     * a scope this helper would compare the :root value against an element that never
     * reads it and report "does not paint --ui-selected-face" — which would be false,
     * and worse, would push the next reader toward writing the private look this whole
     * assertion exists to forbid. Default is unchanged for every other caller. */
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

    // (c) The LED dial. 0px in Slate, so the only honest proof is that moving it moves the shadow.
    const led = await assertTokenDrill(page, {
        token: '--ui-selected-led',
        value: DRILL_LENGTH,
        selector: selected,
        property: 'box-shadow',
        scope,
        // A length is not itself a box-shadow; the shape checks below own the landing.
        expectLanding: false,
    });
    // Read the LAST segment, not the whole value: anything in front of it is the
    // component's own resting shadow arriving through --_ui-rest-shadow.
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

    // (c) The glow dial. 0% in Slate — a fully transparent text-shadow — so again, move it.
    const glow = await assertTokenDrill(page, {
        token: '--ui-selected-glow',
        value: '60%',
        selector: selected,
        property: 'text-shadow',
        scope,
        expectLanding: false,
    });
    // At 0% the glow's colour is fully transparent — the dial is off, and Slate ships
    // it off. Moving it must make the shadow's colour opaque enough to see. Again the
    // LAST segment: the composition slot in front of it is a transparent no-op by
    // design, so testing the whole string would fail on every component, always.
    const glowSegment = dialSegment(glow.after);
    assert.ok(
        !/rgba\([^)]*,\s*0\)|\/\s*0\s*\)/.test(glowSegment),
        `one-selection-treatment: ${selected}'s glow stayed fully transparent at 60%.\n` +
        `  dial segment: ${glowSegment}\n` +
        `  whole computed text-shadow: ${glow.after}`,
    );

    // (c) The weight dial (parity surface 2). Slate carries a selected weight in three
    // rules and no token — slate-components.css:392 and :265, slate-shell.css:310 — and
    // renders 500 on every element painted with the face across all 49 baseline states.
    // Moving the dial is the only proof that the weight is a VALUE here rather than a
    // rule: a rule would survive a fork turning every dial off, which is the founding
    // defect (SCOPE Part 10 §12).
    let weight = null;
    if (weightDial) {
        weight = await assertTokenDrill(page, {
            token: '--ui-selected-weight',
            value: DRILL_WEIGHT,
            selector: selected,
            property: 'font-weight',
        });
    }

    /* (d) + (e) the state half — WHICH DIAL CARRIES THE CONTRAST.
     *
     * The face is the differentiator for every filled selection in the skin, and this
     * check is what catches "the resting state already looks selected". One row does
     * not use the face at all: styles/tokens.css aims the dials at `ui-preset-bank` so
     * a selected preset is an underlined number on the rail's own ground (Ben, 23 Aug
     * 2026), which means BOTH cells are transparent and a face comparison proves
     * nothing about either. There the LED is the differentiator, so the caller names it.
     * The claim is identical in both spellings: one dial separates the two states, and
     * moving it must not reach the resting one. */
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

/* ===========================================================================
 * 3. SCROLL FLOORS AND STATED OVERFLOW
 * =========================================================================== */

/**
 * Squeeze a region and assert it scrolls rather than clipping.
 *
 * @param opts.selector   the scrolling region
 * @param opts.squeeze    inline styles to apply to `squeezeSelector` to force
 *                        overflow, e.g. { 'block-size': '120px' }
 * @param opts.squeezeSelector  defaults to `selector`
 * @param opts.minBlockSize     optional floor the region must not go below, in px
 * @param opts.axis       'block' (default) or 'inline'
 */
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

/* ===========================================================================
 * 4. FOCUS GEOMETRY, UNCLIPPED  (bug L24's class)
 * =========================================================================== */

/**
 * Focus an element the way a keyboard does, then assert the ring is the token ring
 * and that nothing clips it.
 *
 * The clipping half walks THROUGH shadow boundaries: L24 is rings clipped by the
 * component they sit inside, and in this architecture "inside" usually means another
 * shadow root.
 */
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
    // c.top/left/bottom/right are the clipper's SCROLLPORT — its padding box, minus any
    // scrollbar gutter — not the border box getBoundingClientRect returns; page-helpers'
    // clipRect() explains why (finding rig-4). c.borderBox carries the outer rect.
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

/* ===========================================================================
 * A convenience the other four lean on
 * =========================================================================== */

/**
 * Assert an element's hit box reaches the --ui-hit-min floor on both axes while its
 * ink stays where it was — the one shared hit-area utility's contract (spec §2.3,
 * Appendix 5). Not one of the four standing assertions, but the same shape, and the
 * three components that used to carry their own copy (#15, #23, #35) all need it.
 */
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

/* ===========================================================================
 * A press that is provably on the ::backdrop
 * =========================================================================== */

/**
 * Press the `::backdrop` of an open modal dialog at a point COMPUTED to be outside
 * the card, and assert it is outside before pressing.
 *
 * WHY THIS IS NOT `page.click('#outside')` — finding c-modality-1. Whether a press
 * aimed at a background control is a backdrop dismissal is an accident of geometry,
 * because `#pointInCard` (`ui-dialog.js:1095-1100`) asks only whether the POINT is
 * inside the card's border box, and the card is centred. MEASURED, both Gate A
 * geometries, the page fixture both dialog suites use (`#outside` centre at 192, 74):
 *
 *   bench 1281×801   every card clears the point — the press dismisses
 *   floor 1000×600   a card ≥ ~478px tall covers it (#20 552, #53 478, #54 552,
 *                    #55 480) and the press is NOT a dismissal, while #19's 291px
 *                    card still is
 *
 * So a test that presses at a background control and then asserts on what closed is
 * proving a different thing at each geometry, silently. The point here is derived
 * from the card's own box instead, so the press means one thing everywhere.
 *
 * @param page      a harness Page
 * @param native    deep selector for the native `<dialog>` (the card)
 * @returns the pressed point, `{ x, y, gap }`
 */
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
