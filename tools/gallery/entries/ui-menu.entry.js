/**
 * ui-menu.entry.js — the gallery entry for Wave 3 item #21, the menu / popover.
 *
 * WHY THIS IS A FILE AND NOT A DIFF TO entries.js. `tools/gallery/entries.js` is a
 * single hand-written array and its README still says "Edit entries.js. That is the
 * whole procedure" — true for one author, false for parallel builders under a
 * whole-file-write rule: the last write wins and the other entries vanish silently,
 * which the gallery cannot detect because a missing entry is just a shorter list. So
 * this builder owns this file, and one cross-cutting writer adds the single import
 * line and the single array slot, serially, once.
 *
 * SHAPE is the one entries.js documents: `module` is relative to `tools/gallery/`,
 * `hostStyle` sizes the STAGE and not the component, and the full state id is
 * `ui-menu--<state.id>` — a capture-battery filename, so these ids are identifiers
 * and renaming one is a re-baseline.
 *
 * `module` IS THE .demo.js SHIM, NOT THE COMPONENT, and that is load-bearing. gallery.js
 * does one `import()` per entry (gallery.js:46-51, :78) and then waits on
 * `customElements.whenDefined()` for every hyphenated tag on the stage (gallery.js:86-88).
 * Six of the seven states below slot `<ui-button slot="trigger">`, so pointing `module`
 * straight at `ui-menu.js` left those six waiting forever on a tag nothing would define:
 * no error, no `gallerySettled`, and 45 s of battery timeout per state, per theme, per
 * geometry. `./entries/ui-menu.demo.js` imports both modules; its header carries the
 * measurement. Same shape as `seams.demo.js`, `ui-sheet-header.demo.js` and
 * `ui-stat-tile.demo.js`.
 *
 * EVERY OPEN STATE'S STAGE CARRIES `contain: layout`, AND THAT IS NOT DECORATION.
 * A menu is `position: fixed`; `contain: layout` makes the stage the containing block
 * for it (MEASURED, ui-menu.js's header table), so the menu both positions and CLAMPS
 * inside its own stage. Without it every open state on this page would compute its
 * clamp against the window and eight menus would pile into one corner as you scroll.
 * With it, each state is a self-contained coordinate space — which is also the claim
 * the component makes about transformed and contained ancestors, on screen.
 *
 * FOR THE GATE:  import { entry as uiMenu } from './entries/ui-menu.entry.js';
 *                export const entries = [ …, uiMenu ];
 */

/** Items travel through the attribute, JSON-parsed by Lit — the static-markup path. */
const items = (list) => JSON.stringify(list).replaceAll('"', '&quot;');

const PROFILE_ACTIONS = items([
    { id: 'rename', label: 'Rename' },
    { id: 'duplicate', label: 'Duplicate' },
    { id: 'share', label: 'Share code' },
    { separator: true },
    { id: 'delete', label: 'Delete', danger: true },
]);

const WITH_STATES = items([
    { id: 'rename', label: 'Rename' },
    { id: 'locked', label: 'Locked by the machine', disabled: true },
    { id: 'duplicate', label: 'Duplicate' },
    { separator: true },
    { id: 'reset', label: 'Reset to factory', danger: true },
    { id: 'delete', label: 'Delete', danger: true, disabled: true },
]);

const LONG = items(Array.from({ length: 14 }, (_, i) => ({
    id: `shot-${i}`,
    label: `Shot ${String(i + 1).padStart(2, '0')} — 18.0 g in, 36.4 g out`,
})));

/** A stage that owns its coordinate space. See the header. */
const stage = (height) => ({
    contain: 'layout',
    position: 'relative',
    'block-size': height,
});

export const entry = {
    id: 'ui-menu',
    title: 'Menu / popover',
    module: './entries/ui-menu.demo.js',
    notes:
        'Wave 3 #21. Slate builds this twice — context-menu.css (a fixed, JS-positioned '
        + 'context menu) and .pe-chip-add-menu (an absolutely positioned popover in the editor) — '
        + 'and the first is half-overridden by an unscoped block in slate-shell.css that sets '
        + 'box-shadow: none, so the app ships a floating menu with no elevation (bug O2). The '
        + 'other filed bug is quieter: a menu taller than the window keeps its top clamped and '
        + 'has no overflow rule, so its LAST items are simply unreachable (O11). Here the '
        + 'elevation is --ui-elev-2, declared once inside a shadow root nothing can reach, and '
        + 'the height is capped to the room beside the anchor with the list scrolling inside it. '
        + 'Positioning is Slate\'s own arithmetic on the token scale: centred on the anchor, one '
        + '--ui-space-2 gap, flip above when below will not hold it, --ui-space-3 of edge '
        + 'padding. No oracle answer exists for any of it — all three of the classes above return '
        + '"0 elements in 0 states", because no captured state has a menu open.',
    states: [
        {
            id: 'closed',
            title: 'Closed — the trigger is all there is',
            notes: 'The resting state, and the whole of it: a slotted trigger (#1\'s ui-button) '
                + 'carrying aria-haspopup and aria-expanded=false, and no surface, no backdrop and '
                + 'no rows in the DOM at all. The menu builds itself on open and takes itself apart '
                + 'on close.',
            hostStyle: { 'block-size': '96px' },
            html: '<ui-menu label="Profile actions" items="' + PROFILE_ACTIONS + '">'
                + '<ui-button slot="trigger">Actions</ui-button>'
                + '</ui-menu>',
        },
        {
            id: 'open-below',
            title: 'Open, anchored below its trigger',
            notes: 'The default placement. The surface hangs one --ui-space-2 below the anchor and '
                + 'is centred on it, with the arrow pointing back at the anchor\'s centre. The '
                + 'elevation is --ui-elev-2 — bug O2 is that the shipped app has none — and the '
                + 'radius is --ui-radius-xl, which the token sheet\'s own comment reserves for "a '
                + 'floating SURFACE: modal, sheet, menu".',
            hostStyle: stage('420px'),
            html: '<ui-menu open label="Profile actions" items="' + PROFILE_ACTIONS + '">'
                + '<ui-button slot="trigger">Actions</ui-button>'
                + '</ui-menu>',
        },
        {
            id: 'open-above',
            title: 'Flipped above — no room below',
            notes: 'placement="above" shows what the automatic flip does when the anchor is near '
                + 'the bottom of the window: the surface sits one gap ABOVE the trigger and the '
                + 'arrow moves to the bottom edge. Slate computes the same flip '
                + '(context-menu.js:35) and this keeps its test — prefer below, flip only when '
                + 'below cannot hold the menu and above has more room.',
            hostStyle: stage('420px'),
            html: '<div style="position:absolute; inset-block-end: 16px">'
                + '<ui-menu open placement="above" label="Profile actions" items="' + PROFILE_ACTIONS + '">'
                + '<ui-button slot="trigger">Actions</ui-button>'
                + '</ui-menu></div>',
        },
        {
            id: 'row-states',
            title: 'Danger, disabled, and a separator',
            notes: 'Three row states in one menu. Danger takes --ui-status-danger for its ink only '
                + '— a resting danger row is not a filled row — and highlights in a 12% mix of the '
                + 'same token rather than the neutral fill, so the one row you want to be sure '
                + 'about does not look like every other. Disabled is the base\'s single dial at '
                + '--ui-opacity-disabled, and the keyboard walk steps over it. The separator is a '
                + 'seam: a 1px grid gap over --ui-line, not the bordered divider element Slate '
                + 'draws (context-menu.css:118-122).',
            hostStyle: stage('520px'),
            html: '<ui-menu open label="Profile actions" items="' + WITH_STATES + '">'
                + '<ui-button slot="trigger">Actions</ui-button>'
                + '</ui-menu>',
        },
        {
            id: 'bounded-scrolling',
            title: 'Fourteen rows — bounded and scrollable (O11)',
            notes: 'The bug this component exists to kill, at a stage too short to hold the list. '
                + 'The cap comes from the room beside the anchor, the list scrolls inside it with '
                + 'a visible scrollbar, and the last row is reachable by End. Slate clamps the top '
                + 'edge, declares no overflow anywhere, and cannot scroll the page — so its last '
                + 'rows are painted below the window and can never be pressed.',
            hostStyle: stage('420px'),
            html: '<ui-menu open label="Recent shots" items="' + LONG + '">'
                + '<ui-button slot="trigger">Recent shots</ui-button>'
                + '</ui-menu>',
        },
        {
            id: 'plain-trigger',
            title: 'A plain button as the trigger',
            notes: 'The trigger is a slot, so it takes whatever the screen already has — #1\'s '
                + 'ui-button above, a bare button here, an icon button in a list row. The ARIA is '
                + 'written to the slotted element and, when it publishes one, to its inner control, '
                + 'so the announcement lands on the thing that has the button role either way.',
            hostStyle: stage('380px'),
            html: '<ui-menu open label="Row actions" items="' + PROFILE_ACTIONS + '">'
                + '<button slot="trigger" style="min-block-size: 48px">Row actions</button>'
                + '</ui-menu>',
        },
        {
            id: 'popover-content',
            title: 'The popover half — slotted content, no rows',
            notes: 'With no items the surface carries no role=menu and no rows; whatever is slotted '
                + 'into it is the popover\'s body. This is the shape #41\'s add-slot popover needs '
                + '(Slate\'s .pe-chip-add-menu, the second of the two implementations this '
                + 'component replaces), and it keeps the same anchoring, elevation, clamp and '
                + 'dismissal contract as the list form.',
            hostStyle: stage('340px'),
            html: '<ui-menu open>'
                + '<ui-button slot="trigger">Add exit</ui-button>'
                + '<div style="padding: var(--ui-space-3); max-inline-size: 26ch">'
                + 'Any content can go in the surface. The anchoring, the elevation, the clamp and '
                + 'the dismissal contract are the same.'
                + '</div>'
                + '</ui-menu>',
        },
    ],
};

export default entry;
