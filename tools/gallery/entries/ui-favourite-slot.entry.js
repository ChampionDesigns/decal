/**
 * The gallery entry for one favourite slot. Its states separate occupancy from selection,
 * show the same rules with the theme dials moved, put the ink and the hit floor apart,
 * draw the focus ring at both offsets, and cover disabled, hidden, and a host smaller than
 * the slot itself.
 */

export const entry = {
    id: 'ui-favourite-slot',
    title: 'Favourite slot',
    module: '../../src/components/ui-favourite-slot.js',
    notes:
        'Component #35, the square profile shortcut (SCOPE L1547; spec §5.2 #35, '
        + 'two old rules). Bug P4 is this row\'s whole job, and '
        + 'P4 is NOT "the target is too small": the reference skin\'s slots measure 64x64, which is '
        + 'LARGER than the 48px floor. The defect is a dimension with two owners - '
        + '`width: var(--slate-hit-min)` in one rule and `min-width: 64px` in another '
        + '1300 lines away, a different property, clamping the used value without ever '
        + 'losing a cascade fight. Here geometry and paint are eleven lines apart in one '
        + 'shadow root, the box IS --ui-hit-min, there is no min-* anywhere, and the hit '
        + 'floor is the ONE shared utility (Appendix 5). Occupancy is --ui-primary; '
        + 'selection is the four dials and nothing else.',
    states: [
        {
            id: 'default',
            title: 'The profile-selector row, as the oracle measured it',
            notes:
                'Five slots, the first three occupied. CITE prov_query.py find --cls '
                + 'ps-fav-slot -> "found 5 element(s) in 1 state(s)", profile-selector, '
                + 'rects [207,1112,64,64] ... [551,1112,64,64] - quoted as what the reference skin does, '
                + 'never as the target: that geometry is P4 itself and the corpus banner '
                + 'says so. Paint is exact in both themes: empty is transparent over '
                + '--ui-muted ink and a --ui-line-strong hairline; filled is --ui-primary '
                + 'over --ui-on-primary with the reference skin\'s own 72%-primary/steel rim. The reference skin\'s '
                + 'comment for the occupancy fix, kept: "The five favourite slots were '
                + 'pixel-identical whatever they held, so tapping one was a blind '
                + 'overwrite."',
            html:
                '<div style="display:flex; gap:var(--ui-space-3); align-items:center">'
                + '<ui-favourite-slot index="1" filled label="Cremina"></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled label="Londinium"></ui-favourite-slot>'
                + '<ui-favourite-slot index="3" filled label="Flair 58"></ui-favourite-slot>'
                + '<ui-favourite-slot index="4" label="Favourite 4, empty"></ui-favourite-slot>'
                + '<ui-favourite-slot index="5" label="Favourite 5, empty"></ui-favourite-slot>'
                + '</div>',
        },
        {
            id: 'selected',
            title: 'Occupancy is not selection',
            notes:
                'Left to right: empty, filled, filled AND selected, selected but empty. '
                + 'A filled slot says "something lives here" (--ui-primary, the primary '
                + 'action fill); a selected slot says "this one is current" '
                + '(--ui-selected-face = --ui-steel). Two different facts, two different '
                + 'tokens, and the dials win when a slot is both - selection is a state '
                + 'treatment and beats the resting paint. This is the wave\'s founding '
                + 'defect made visible: Live\'s favourites bank bypasses the dials '
                + 'entirely today (L8/BUG-12), which is why re-skinning selection changes '
                + 'the tabs and leaves the favourites alone.',
            html:
                '<div style="display:flex; gap:var(--ui-space-3); align-items:center">'
                + '<ui-favourite-slot index="1"></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled label="Cremina"></ui-favourite-slot>'
                + '<ui-favourite-slot index="3" filled selected label="Londinium, current"></ui-favourite-slot>'
                + '<ui-favourite-slot index="4" selected label="Favourite 4, current"></ui-favourite-slot>'
                + '</div>',
        },
        {
            id: 'dials-radian',
            title: 'The same rules, two values moved',
            notes:
                'The reference skin ships --ui-selected-led at 0px and --ui-selected-glow at 0% '
                + '(styles/tokens.css:819-822). Radian moves those two; this component\'s '
                + 'CSS does not change, which is the entire claim of spec §3.9 - "four '
                + 'values, zero rule changes", and it only holds because there is ONE '
                + 'selection treatment. The right-hand group carries led 4px and glow 55% '
                + 'as inline properties on the wrapper, so the difference is the dials and '
                + 'nothing else.',
            html:
                '<div style="display:flex; gap:var(--ui-space-7); align-items:center">'
                + '<div style="display:flex; gap:var(--ui-space-3); align-items:center">'
                + '<ui-favourite-slot index="1" filled></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled selected></ui-favourite-slot>'
                + '</div>'
                + '<div style="display:flex; gap:var(--ui-space-3); align-items:center;'
                + ' --ui-selected-led:var(--ui-toggle-led); --ui-selected-glow:55%">'
                + '<ui-favourite-slot index="1" filled></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled selected></ui-favourite-slot>'
                + '</div></div>',
        },
        {
            id: 'compact',
            title: 'Ink separate from the hit floor',
            notes:
                'Appendix 5: "Hit area is separate from ink ... Good patterns; make them '
                + 'ONE utility rather than three copies" - the three being #15 keycap, '
                + '#23 slider and this. The right-hand disc sets --_ui-fav-slot-size to '
                + '--ui-control-sm (44px), which is the reference skin\'s own .ps-fav-badge for the '
                + 'list row: "THE SAME disc, one size down ... so the two cannot drift '
                + 'apart". The 32px one is deliberately below '
                + 'the floor. All three still accept a 48px press, because the transparent '
                + '::before holds --ui-hit-min on both axes - a floor the box HAS rather '
                + 'than one a comment claims. The press boxes are invisible here by '
                + 'construction and are measured in the rendering suite instead.',
            html:
                '<div style="display:flex; gap:var(--ui-space-5); align-items:center">'
                + '<ui-favourite-slot index="1" filled></ui-favourite-slot>'
                + '<div style="--_ui-fav-slot-size:var(--ui-control-sm)">'
                + '<ui-favourite-slot index="2" filled></ui-favourite-slot></div>'
                + '<div style="--_ui-fav-slot-size:32px">'
                + '<ui-favourite-slot index="3" filled></ui-favourite-slot></div>'
                + '<span style="font-size:var(--ui-text-2xs); color:var(--ui-muted)">'
                + '48 / 44 / 32 ink, one 48px floor</span>'
                + '</div>',
        },
        {
            id: 'focusable',
            title: 'One ring, both offsets',
            notes:
                'The disc is a real button, so it takes the ONE ring from the base '
                + '(spec §3.6 - the reference skin ships five treatments and the component layer\'s '
                + 'ring reaches four classes). The right-hand pair sits in an '
                + 'overflow:hidden row and carries focus-ring="inset", which is bug L24\'s '
                + 'class - "focus rings clipped on all four sides by the components they '
                + 'sit inside" - and a favourites bank is exactly such a row. Tab through '
                + 'this state to see both, including on the selected disc: selection '
                + 'paints face, ink and two shadows, and must not eat the outline.',
            html:
                '<div style="display:flex; gap:var(--ui-space-5); align-items:center">'
                + '<ui-favourite-slot index="1"></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled selected></ui-favourite-slot>'
                + '<div style="overflow:hidden; display:flex; gap:var(--ui-space-2);'
                + ' inline-size:112px">'
                + '<ui-favourite-slot index="3" focus-ring="inset"></ui-favourite-slot>'
                + '<ui-favourite-slot index="4" filled focus-ring="inset"></ui-favourite-slot>'
                + '</div></div>',
        },
        {
            id: 'disabled',
            title: 'Disabled, and hidden',
            notes:
                'Two base behaviours with almost no code here. [disabled] on the host dims '
                + 'once through --ui-opacity-disabled (.38, one dial against the reference skin\'s three '
                + 'live values) and the native attribute on the inner button refuses the '
                + 'press; one line stops the dial multiplying by itself (.38 x .38 = .14). '
                + '[hidden] really hides even though this component sets `display` on '
                + ':host, because the base rule is (0,2,0) and wins with zero !important - '
                + 'the old sheet\'s bug fixed by specificity instead of by '
                + 'force.',
            html:
                '<div style="display:flex; gap:var(--ui-space-3); align-items:center">'
                + '<ui-favourite-slot index="1" filled></ui-favourite-slot>'
                + '<ui-favourite-slot index="2" filled disabled></ui-favourite-slot>'
                + '<ui-favourite-slot index="3" disabled></ui-favourite-slot>'
                + '<ui-favourite-slot index="4" hidden></ui-favourite-slot>'
                + '<span style="font-size:var(--ui-text-2xs); color:var(--ui-muted)">'
                + 'fourth one is [hidden]</span>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 36px container',
            notes:
                'Ergonomics is physical (spec §2.2: "Control heights, touch targets, '
                + 'hairlines | Fixed token. Never fluid"), so the disc OVERFLOWS its '
                + 'container rather than shrinking below the floor. The oracle has no vote '
                + 'here - the reference skin is frozen at 1920x1200 and never meets a narrow container - '
                + 'so the layout spec governs, and it says the small window is exactly when '
                + 'a shrunken target hurts most.',
            hostStyle: { 'inline-size': '36px' },
            html: '<ui-favourite-slot index="1" filled></ui-favourite-slot>',
        },
    ],
};

export default entry;
