/**
 * overlay-hygiene.test.mjs — wave 5.2, ITEMS rows `overlay-style-hygiene` and the static
 * half of `screensaver-d10`.
 *
 * "One overlay, one sheet, one name, no literals — O1/O2/O15, O13, O16", and the row's own
 * note is the whole brief: "O1/O2/O15 … are structurally impossible under Shadow DOM,
 * which is the point of A8's 'the platform enforces it' … The guard is built in w0a; this
 * phase must not re-implement it, only be CLEAN UNDER IT." So nothing here is a second
 * guard. Every check is either (a) Gate C's own guards, aimed at the nine overlay files
 * and asked whether they are actually looking at them, or (b) a claim about the tree that
 * Gate C does not make.
 *
 * THE FAILURE MODE THIS FILE IS WRITTEN AGAINST is Gate C's own: "All three old-guard
 * failures were guards that silently stopped covering their target" (SCOPE Part 8 §2).
 * `guards.test.mjs` proves the guards fire on the canary FIXTURES; it cannot prove they
 * ever opened `ui-dialog.js`. A `css` template the collector fails to extract — a nested
 * interpolation, a rename, a file moved out of a scan root — reports PASS forever. So each
 * of the nine overlay files is copied, broken on purpose in its own `css` block, and the
 * guard is required to fail AT THAT FILE.
 *
 *   O16  — "Literal colours in two sheets whose own headers claim they have none"
 *          (`time-picker-modal.css:192`, `help-overlay.css:12,53`). The header claim is
 *          exactly what a canary replaces with a measurement.
 *   O1   — one file deletes the notes header, another silently puts it back
 *          (`slate-shell.css:961-965` vs `notes-modal.css:45-50`).
 *   O2   — the context menu re-declared unscoped and later, `box-shadow: none`.
 *   O15  — a THIRD sheet styles the numpad through `body:has(.slate-profile-editor)`.
 *          All three need one thing: a second sheet that can name the first's box. §2
 *          below asserts no such sheet exists and no such selector is written.
 *   O13  — "`.slate-sheet-actions` means two different things — a header cluster in the
 *          library, a dialog footer in the shell." §3 pins one name to one meaning.
 *
 * D10's static half is §4: two pieces of software entitled to blank a screen is a bug
 * generator, and the second one usually arrives as a second consumer of the blackout
 * token, not as a second component. The behavioural half — fully black, and it stays
 * black — is `test/render/overlay-surfaces.render.test.mjs`, on a real frame.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { runGuards, formatReport, GUARDS } from '../scripts/guards.js';
import {
    collectAuthoredCss, listAuthoredFiles, stripCssComments, REPO_ROOT, DEFAULT_SCAN_ROOTS,
} from '../scripts/lib/authored-css.js';

/* The nine surfaces this wave integrates: #18's shell, its five bodies, #16's header,
 * #21, #22 and #57. Every one of them is authored CSS inside a `css` template in a .js
 * file, which is the half of the scan a file-extension-driven guard misses. */
const OVERLAY_FILES = [
    'src/components/ui-dialog.js',
    'src/components/ui-confirm-dialog.js',
    'src/components/ui-sheet.js',
    'src/components/ui-sheet-header.js',
    'src/components/ui-numeric-keypad.js',
    'src/components/ui-time-picker.js',
    'src/components/ui-notes-editor.js',
    'src/components/ui-menu.js',
    'src/components/ui-toast.js',
    'src/components/ui-screensaver.js',
];

const OVERLAY_TAGS = OVERLAY_FILES.map((f) => path.basename(f, '.js'));

const read = (rel) => fsp.readFile(path.join(REPO_ROOT, rel), 'utf8');

/* ===========================================================================
 * 1. Gate C actually opens these files — and fails on them when they are wrong
 * ========================================================================= */

describe('O16 / A8: Gate C covers the overlay surfaces', () => {
    test('every overlay file is in the scanned set, with real declarations in it', async () => {
        const { blocks, files } = await collectAuthoredCss({});
        for (const file of OVERLAY_FILES) {
            assert.ok(files.includes(file), `${file} is not in Gate C's file list`);
            const mine = blocks.filter((b) => b.file === file);
            assert.ok(mine.length > 0, `${file} contributed no CSS block — the css\`\` template was not extracted`);
            const declarations = mine.reduce((n, b) => n + b.declarations.length, 0);
            /* A per-file floor of three rather than a big number: #19 is a thin body that
             * owns almost nothing (its card is #18's), and a floor tuned to the fattest
             * sheet is a floor that gets lowered later. The total below is the real
             * "is it looking at something" check. */
            assert.ok(declarations >= 3,
                `${file} parsed to ${declarations} declarations, which is too few to be its real sheet`);
        }
        const total = blocks
            .filter((b) => OVERLAY_FILES.includes(b.file))
            .reduce((n, b) => n + b.declarations.length, 0);
        assert.ok(total >= 400,
            `the nine overlay sheets parsed to ${total} declarations in total — the extractor has stopped `
            + 'reading most of them and every guard below would pass on nothing');
    });

    test('and none of them is exempt from any guard', () => {
        // An exemption is how coverage dies quietly; the overlay sheets are exactly the
        // ones whose old-app headers claimed a cleanliness they did not have (O16).
        for (const guard of GUARDS) {
            for (const exempt of guard.exempt) {
                assert.ok(!OVERLAY_FILES.includes(exempt),
                    `${guard.id} exempts ${exempt} — an overlay sheet must be under the guard, not beside it`);
            }
        }
    });

    test('the shipping overlay files raise no violation of any kind', async () => {
        const report = await runGuards({});
        const mine = report.violations.filter((v) => OVERLAY_FILES.includes(v.file));
        assert.deepEqual(mine, [], `\n${formatReport(report)}`);
    });

    /**
     * THE CANARY, per file. Each overlay's own `css` block is broken in a temp copy of the
     * tree and the guard is required to name that file. This is the assertion that the
     * scan REACHES the sheet, which "no violations" cannot make on its own.
     */
    describe('each guard fires on each overlay file when it is broken', () => {
        /** `:host {` opens every one of these components' sheets — the base's convention. */
        const INJECT = {
            'colour-literal': ['color: #ff00ff;', /colour literal/],
            important: ['color: var(--ui-ink) !important;', /!important/],
            'private-palette': ['--ui-ink: red;', /re-declares the public token/],
            /* Closed and re-opened around the at-rule: @font-face is a top-level rule and
             * the point is to prove the scan reads this file's block, not to test CSS
             * nesting. */
            'font-face': ['} @font-face { font-family: Probe; src: local("Probe"); } :host {', /@font-face declared outside/],
        };

        for (const file of OVERLAY_FILES) {
            test(file, async () => {
                const source = await read(file);
                const at = source.indexOf(':host {');
                assert.ok(at > 0, `${file} has no ":host {" to inject into — update this canary, do not delete it`);

                for (const [guard, [snippet, message]] of Object.entries(INJECT)) {
                    const dir = await fsp.mkdtemp(path.join(tmpdir(), 'overlay-canary-'));
                    try {
                        const target = path.join(dir, file);
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        const broken = `${source.slice(0, at + ':host {'.length)}\n${snippet}\n${source.slice(at + ':host {'.length)}`;
                        await fsp.writeFile(target, broken);

                        const report = await runGuards({
                            root: dir,
                            roots: [path.dirname(file)],
                            only: [guard],
                            checkExemptions: false,
                        });
                        const hits = report.violations.filter((v) => v.file === file);
                        assert.ok(hits.length > 0,
                            `${guard} did not fire on a broken ${file} — Gate C is not reading this sheet`);
                        assert.match(hits[0].message, message);
                    } finally {
                        await fsp.rm(dir, { recursive: true, force: true });
                    }
                }
            });
        }
    });
});

/* ===========================================================================
 * 2. O1 / O2 / O15 — there is no second sheet to fight with
 * ========================================================================= */

/**
 * What a parent may say about a child element's HOST box: where it sits and how big it is
 * in the parent's own flow. Everything else — ground, edge, shadow, ink, layer — belongs
 * to the component, and is the list O2's seven-property override table is drawn from.
 */
const HOST_LAYOUT = /^(display|(inline|block)-size|width|height|(min|max)-(inline-size|block-size|width|height)|margin(-\w+)*|flex(-\w+)*|grid-\w+|order|(align|justify|place)-self)$/;

describe('O1 / O2 / O15: one overlay, one sheet', () => {
    /** Selector preludes only, comments stripped — a class name in prose is not a rule. */
    const preludes = (block) => stripCssComments(block.text)
        .split('{')
        .slice(0, -1)
        .map((chunk) => chunk.split('}').pop().trim())
        .filter(Boolean);

    /** Every (prelude, body) pair in a block, at any nesting depth. */
    const rules = (block) => {
        const text = stripCssComments(block.text);
        const out = [];
        let depth = 0;
        let start = 0;
        const opens = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                opens.push({ prelude: text.slice(start, i).split('}').pop().split(';').pop().trim(), at: i });
                depth += 1;
                start = i + 1;
            } else if (text[i] === '}') {
                const open = opens.pop();
                depth -= 1;
                if (open) out.push({ prelude: open.prelude, body: text.slice(open.at + 1, i) });
                start = i + 1;
            }
        }
        assert.equal(depth, 0, `${block.file}: unbalanced braces, the scan below would be wrong`);
        return out;
    };

    test('no sheet names another component\'s element for anything but a custom property', async () => {
        const { blocks } = await collectAuthoredCss({});
        const offences = [];
        for (const block of blocks) {
            for (const { prelude, body } of rules(block)) {
                for (const tag of OVERLAY_TAGS) {
                    if (block.file === `src/components/${tag}.js`) continue;
                    if (!new RegExp(`(^|[^\\w-])${tag}([^\\w-]|$)`).test(prelude)) continue;
                    /* TWO SANCTIONED CHANNELS, and neither can reach inside a shadow root:
                     *   - a CUSTOM PROPERTY — "tokens in, nothing out" (CONVENTIONS §7).
                     *     `ui-numeric-keypad` setting `--_ui-dialog-inline` on the shell it
                     *     lives in is #18's own knob, turned by its body.
                     *   - LAYING OUT THE HOST BOX in the parent's own flow, which is what a
                     *     host box is for (`ui-exit-sentence` telling a shrink-wrapping
                     *     #21 to fill its slot row — CONVENTIONS §2's shadow-host
                     *     precedence route, no !important anywhere).
                     * PAINTING it is the other thing entirely, and it is O2's whole
                     * mechanism: `box-shadow: none` on somebody else's floating surface. */
                    const painted = body
                        .split(';')
                        .map((d) => d.split(':')[0].trim())
                        .filter((p) => p && !p.startsWith('--') && !p.includes('{'))
                        .filter((p) => !HOST_LAYOUT.test(p));
                    if (painted.length) {
                        offences.push(`${block.file}: ${prelude.replace(/\s+/g, ' ').slice(0, 60)} { ${painted.join(', ')} }`);
                    }
                }
            }
        }
        assert.deepEqual(offences, [],
            'O1 is one file undoing another file\'s fix and O2 is one file re-declaring another\'s component; '
            + 'both need a sheet that paints another component\'s box from outside it');
    });

    /**
     * THE DAY CAME, AND THIS IS THE ARGUMENT.
     *
     * The old assertion was `deepEqual(parts, [])` with a note saying "Nothing needs it
     * yet, and the day something does, O2 becomes expressible again and this test is where
     * that gets argued". Two consumers arrived on 25 August 2026, both of them Ben pinning
     * this skin to a Slate measurement that lives on a box inside another component:
     *
     *   editor-screen.js  the editor's tabs — "make them all caps same font size as slate,
     *                     also make the button width match slates". Slate's tab is
     *                     16px/1.76px/uppercase in a 142.7px cell; ui-bank's own item is
     *                     neither, and every OTHER bank in the skin is right as it is.
     *   step-matrix.js    the Pump row's chips — "The PUMP row, pressure is being clipped
     *                     with Press... this didn't happen on slate". Measured: Slate's
     *                     chip is 86.8px wide with 5px insets at 16px, leaving 76px for
     *                     the word; ours was 8px at 17px, leaving 71px.
     *
     * WHY A PART AND NOT A CUSTOM PROPERTY. A custom property is the right seam for a
     * VALUE the component already reads, and both files use one where that fits — the
     * insets travel as `--_ui-item-inset`. What cannot travel that way is a property the
     * component does not read at all: `ui-bank` states no `font-size` hook on its item,
     * and adding a `--_ui-item-font-size` for two call sites would be inventing a token
     * per property, which is O2 wearing a different hat.
     *
     * WHAT KEEPS THIS FROM BECOMING THE DEFECT O2 NAMES. A part is an EXPORTED surface:
     * the component chose to expose it, so the reach-in is a contract rather than a sheet
     * guessing at another file's class names. The allowlist below is the whole of it — a
     * third file appearing here fails, and has to argue its own case in this comment.
     */
    const PART_CONSUMERS = Object.freeze([
        'src/screens/editor-screen.js',
        'src/screens/step-matrix.js',
    ]);

    test('only the two argued files reach in through a ::part', async () => {
        const { blocks } = await collectAuthoredCss({});
        const parts = [...new Set(
            blocks.filter((b) => /::part\s*\(/.test(stripCssComments(b.text))).map((b) => b.file),
        )].sort();
        assert.deepEqual(parts, [...PART_CONSUMERS],
            '::part is the ONE way an outside sheet can style a shadow box. Two files are argued for it '
            + 'in the comment above this test; a third has to be argued there before it is added here');
    });

    test('O15: no document-level :has() reaches down into a component', async () => {
        // `profile-editor-v3.css:1391-1401` is `body:has(.slate-profile-editor) …` at
        // (0,2,1) — a third sheet styling the numpad, invisible to anyone reading
        // numpad-modal.css. The mechanism is a :has() anchored above the component.
        const { blocks } = await collectAuthoredCss({});
        const offences = [];
        for (const block of blocks) {
            for (const prelude of preludes(block)) {
                if (!/:has\s*\(/.test(prelude)) continue;
                if (/^\s*(html|body|:root)\b/.test(prelude)) {
                    offences.push(`${block.file}: ${prelude.replace(/\s+/g, ' ').slice(0, 80)}`);
                }
            }
        }
        assert.deepEqual(offences, [], 'a :has() anchored on the document is O15\'s exact mechanism');
    });

    test('the guarded scan roots still include everywhere a second sheet could live', () => {
        // A sheet outside the scan roots is a sheet nothing above can see. Pinned so the
        // day someone adds an app/ or a themes/ directory, this fails rather than passes.
        assert.deepEqual([...DEFAULT_SCAN_ROOTS], ['src', 'styles', 'tools', 'index.html']);
    });

    test('no authored CSS file exists outside those roots', async () => {
        const files = await listAuthoredFiles();
        const css = files.filter((f) => f.endsWith('.css'));
        for (const file of css) {
            assert.match(file, /^styles\//, `${file} is a stylesheet outside styles/ — three sheets start as two`);
        }
        assert.ok(css.length >= 3, `only ${css.length} stylesheets found; the collector is not looking`);
    });
});

/* ===========================================================================
 * 3. O13 — one name, one meaning
 * ========================================================================= */

describe('O13: sheet-actions means one thing, and it is not two', () => {
    test('the name that meant two things is not used for anything', async () => {
        for (const file of OVERLAY_FILES) {
            const source = await read(file);
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
            assert.ok(!/sheet-actions/.test(code),
                `${file} uses the name "sheet-actions" outside a comment — it is the one name §7.7 O13 `
                + 'names as broken, and it is kept only as a citation');
        }
    });

    test('exactly one overlay declares an `actions` slot, and it is the dialog', async () => {
        const declared = [];
        for (const file of OVERLAY_FILES) {
            const source = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            for (const match of source.matchAll(/<slot\s[^>]*name=["']([\w-]+)["']/g)) {
                declared.push({ file, name: match[1] });
            }
        }
        const actions = declared.filter((d) => d.name === 'actions').map((d) => d.file);
        assert.deepEqual(actions, ['src/components/ui-dialog.js'],
            'the footer is #18\'s slot and only #18\'s: a body that declared its own `actions` is the shell '
            + 'and the library meaning the same word differently, which is O13');

        /* And the header cluster has its own word. #16 is where Slate's second meaning
         * lived (`.slate-sheet-actions` as a header cluster); it is `trail` here. */
        const header = declared.filter((d) => d.file === 'src/components/ui-sheet-header.js').map((d) => d.name);
        assert.deepEqual(header, ['trail'], `#16's cluster slot is ${JSON.stringify(header)}`);
    });

    test('no two overlay components declare the same slot name', async () => {
        /* The general form of O13: a name that two components define is a name a reader
         * has to disambiguate by context, which is how `.slate-sheet-actions` came to be
         * a header cluster in one file and a dialog footer in another. Bodies fill #18's
         * slots (`slot="actions"` on their own buttons) and declare their own — the
         * declarations are what must not collide. */
        const owner = new Map();
        const collisions = [];
        for (const file of OVERLAY_FILES) {
            const source = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            for (const match of source.matchAll(/<slot\s[^>]*name=["']([\w-]+)["']/g)) {
                const name = match[1];
                if (owner.has(name) && owner.get(name) !== file) {
                    collisions.push(`${name}: ${owner.get(name)} and ${file}`);
                }
                owner.set(name, file);
            }
        }
        assert.deepEqual(collisions, []);

        /* And #18's four are #18's. A body re-declaring `body` or `actions` would be the
         * same word meaning "the shell's region" and "my own region" at once. */
        for (const name of ['header', 'header-trail', 'body', 'actions']) {
            assert.equal(owner.get(name), 'src/components/ui-dialog.js',
                `"${name}" is declared by ${owner.get(name)}, not by the one dialog`);
        }
    });
});

/* ===========================================================================
 * 4. D10 — one owner, and one path to a dark screen
 * ========================================================================= */

describe('D10: the skin is the single owner of screen blanking', () => {
    const srcFiles = async () => (await listAuthoredFiles(['src'])).filter((f) => f.endsWith('.js'));

    test('exactly one file consumes the blackout ground and the blackout layer', async () => {
        const blackout = [];
        const layer = [];
        for (const file of await srcFiles()) {
            const source = await read(file);
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
            if (/var\(\s*--ui-blackout/.test(code)) blackout.push(file);
            if (/var\(\s*--ui-z-blackout/.test(code)) layer.push(file);
        }
        assert.deepEqual(blackout, ['src/components/ui-screensaver.js'],
            'a second consumer of --ui-blackout is a second blanker with a different name');
        assert.deepEqual(layer, ['src/components/ui-screensaver.js']);
    });

    test('the blanking policy has one home and one consumer', async () => {
        const importers = [];
        for (const file of await srcFiles()) {
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
            if (/from\s+['"][^'"]*screensaver-policy(\.js)?['"]/.test(code)) importers.push(file);
        }
        /**
         * THE SLEEP BUTTON CAME BACK, AND ITS TWO READERS ARE ARGUED HERE.
         *
         * The rule this assertion protects is unchanged and is worth restating: the policy
         * RETURNS paint instructions and commands, and is structurally incapable of sending
         * one. That is what closed the bug it was written for — one tap on the old sleep
         * button slept the machine and woke it again 46 ms later, because the overlay's own
         * teardown emitted the wake. A second thing DECIDING when the screen goes dark is
         * still refused.
         *
         * Neither new importer decides that.
         *
         *   app-root.js    asks `deriveSleepButtonAction` what a Sleep press means for the
         *                  machine's confirmed state, and sends the command it is handed.
         *                  This is the function's INTENDED caller: it is named for a sleep
         *                  button, and until Ben asked for one back on 25 August 2026 there
         *                  was no button to call it. A shell that decided sleep-versus-wake
         *                  itself would be the second decider this test refuses.
         *   live-screen.js asks `isMachineAsleep` whether to label that button Sleep or
         *                  Wake. It reads a state and paints a word.
         *
         * A FOURTH IMPORTER HAS TO BE ARGUED HERE FIRST, which is the whole of the guard.
         */
        assert.deepEqual(importers, [
            'src/components/app-root.js',
            'src/components/ui-screensaver.js',
            'src/screens/live-screen.js',
        ], 'the port returns paint instructions and is incapable of asking for a machine command '
            + '(SCOPE:2755); an importer not argued in the comment above is a second thing '
            + 'deciding when the screen goes dark');
    });

    test('only the slider\'s own path names the brightness command', async () => {
        const senders = [];
        for (const file of await srcFiles()) {
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            if (/setBrightness/.test(code)) senders.push(file);
        }
        /**
         * THE RULE IS ABOUT THE WAKE EDGE, AND IT IS UNCHANGED.
         *
         * Q13: ReaPrime restores brightness autonomously when it sees an awake machine at
         * requested brightness 0 (`display_controller.dart:276-285`). With a black
         * screensaver that makes two restore paths on that edge and exactly one side may
         * drive it — the skin drives the DIM and stands back on the RESTORE
         * (`ui-screensaver.js`'s header states the decision and its three reasons). The
         * RESTORE is what is refused here.
         *
         * THIS ASSERTION USED TO REFUSE THE DIM AS WELL, AND THAT WAS THE DEFECT (26 August
         * 2026). It enforced Q13 "by ABSENCE: no screensaver file, no policy file and no
         * boot path is on the list" — which forbids the DIM from ever reaching the panel,
         * and so forbids exactly half of the decision it exists to protect. The half it
         * forbade was the half that was missing: `ui-screensaver.js` emitted
         * `ui-screensaver-dim` and a grep of `src/` returned the emitter and NO consumer,
         * so the overlay went black and the panel stayed lit — and because the panel never
         * reached 0, ReaPrime's restore was never armed either. A guard written against one
         * error can hold the opposite error in place; this is what that looks like.
         *
         * SO THE SHELL IS ON THE LIST NOW, and it is on it under a stricter condition than
         * membership: the second assertion below pins WHERE in `app-root.js` the name may
         * appear and what it may pass. A brightness the shell CHOSE, or one it sent from
         * anywhere but the component's own dim event, still fails.
         *
         * WHAT CHANGED ON 26 AUGUST 2026 is that the Brightness SLIDER started working.
         * Settings › Display › Brightness had written `lastBrightness` into machine-scoped
         * KV since the settings screen was built; nothing read the key, nothing sent this
         * command, and dragging the slider changed a number on the page and nothing else.
         * Found by sweeping every settings row for something on the other end.
         *
         * A PERSON MOVING A CONTROL IS NOT A WAKE EDGE. It is the one moment the skin
         * unambiguously owns the panel: an explicit act, at a time the person chose, with
         * no competing restore in flight. Standing back there would mean the control cannot
         * exist at all.
         *
         * EACH FILE ON THIS LIST, and why it is not a second decider:
         *
         *   rea-ws-channels.js       the channel table. Names the command and owns its
         *                            shape check; sends nothing.
         *   live-stores.js           holds the display channel `attachAll()` already opened
         *                            and exposes one function on it. No policy: it rounds,
         *                            clamps and reports a refusal.
         *   settings-model.js        hands that function to the row model as the panel's
         *                            `setBrightness`, or null.
         *   settings-leaf-model.js   the slider's own write path since 28 August 2026,
         *                            through `PANEL_SETTINGS.brightness`. It fires on the
         *                            row's `@change` — a person, not an edge. It was
         *                            `settings-bespoke-leaf.js` until `ARCHETYPE.SLIDER`
         *                            turned that hand-written page into a registry row;
         *                            the OWNER moved, the rule did not.
         *   app-root.js              the shell's `#onSaverDim`, which forwards the DIM the
         *                            screensaver asked for. Not a decision: the brightness
         *                            is the port's own `SCREENSAVER_BRIGHTNESS`, carried on
         *                            the event, and the handler chooses nothing. Pinned by
         *                            the next assertion.
         *
         * A SIXTH FILE HAS TO BE ARGUED HERE FIRST, which is the whole of the guard. A BOOT
         * path appearing on this list is Q13 walking back in: one lived in `app-boot.js` for
         * about an hour on 26 August 2026, putting the stored value back when the display
         * socket opened, and this assertion is what caught it. That is still caught — the
         * shell's entry buys `app-boot.js` nothing.
         */
        assert.deepEqual(senders, [
            'src/components/app-root.js',
            'src/data/rea-ws-channels.js',
            'src/screens/settings-model.js',
            'src/stores/live-stores.js',
            'src/stores/settings-leaf-model.js',
        ], 'Q13: only one side may drive brightness on the WAKE EDGE, and the skin stands '
            + 'back there. A file on this list that is neither the slider\'s own path nor the '
            + 'screensaver\'s dim — a boot path, a policy — is that decision being reversed '
            + 'by accident');
    });

    test('the shell FORWARDS the dim and never picks a brightness of its own', async () => {
        /* THE SHELL IS ON THE LIST ABOVE, so membership alone no longer says enough. What
         * makes `app-root.js` safe is not that it sends a brightness — it is that it sends
         * the one it was HANDED. Q13's residual risk is a restore, and a restore needs a
         * VALUE: `brightnessBeforeDim ?? rememberedBrightness ?? 100` is the three-deep
         * fallback ladder A7 refuses and the exact shape the old skin had. A shell that
         * read a stored level, or spelled a number, would be that ladder coming back
         * through the one door this guard now leaves open. */
        const code = (await read('src/components/app-root.js'))
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        /* `?.(` IS THE CALL SHAPE HERE — the shell reaches through two optionals, because a
         * boot with no live stores is a state (a fixture, a gallery page) and not an error. */
        const calls = [...code.matchAll(/setBrightness\??\.?\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
        assert.deepEqual(calls, ['brightness'],
            'one call, and its argument is the value the dim event carried');
        assert.match(code, /#onSaverDim\s*=\s*\(event\)\s*=>\s*\{[^}]*event\?\.detail\?\.brightness/,
            'the value comes off the event and from nowhere else');
        assert.doesNotMatch(code, /lastBrightness/,
            'the shell reads no remembered brightness — a restore needs a value, and this is where it would come from');
    });

    test('the display route is on the Gate D table with the handler\'s own command set', async () => {
        const table = JSON.parse(await read('src/data/CONTRACTS.json'));
        const row = table.sockets.find((r) => r.path === '/ws/v1/display');
        assert.ok(row, '/ws/v1/display has no contract-table row');
        assert.equal(row.handlerFile, 'lib/src/services/webserver/display_handler.dart');
        assert.equal(row.handlerSymbol, 'DisplayHandler._handleWebSocket');
        assert.equal(row.status, 'consumed');
        assert.deepEqual([...row.commands], ['setBrightness', 'requestWakeLock', 'releaseWakeLock'],
            're-read against the handler at the pinned commit: the switch in _handleWebSocket has exactly '
            + 'these three cases and drops a bad setBrightness with a log line and no reply');
        assert.equal(row.checkedCommit, table.pinnedCommit);
    });

    /* D10 IS PARTLY REVERSED, AND THE HALF THAT SURVIVES IS THE HALF THIS TEST IS ABOUT.
     *
     * Ben, 26 August 2026: "screen saver type — Black / Image / Clock", with Slate's image
     * set restored. So `screensaverImages` is a live device-scoped key again and this test
     * no longer forbids it.
     *
     * `blackScreenSaver` STAYS RETIRED, and for a reason the reversal does not touch: it
     * was a BOOLEAN, and the question now has three answers. A two-state key beside a
     * three-state one is the second store for one setting that the routing table exists to
     * prevent — which is why `screensaverType` replaced it rather than joining it. The
     * same argument retires `screensaverClock`, added on 24 August as a switch over the
     * blank and folded into the type on the 26th.
     *
     * WHAT D10 STILL OWNS is the other half of this file: the skin, and only the skin,
     * blanks the screen. Nothing here re-opens that. */
    test('the retired screensaver booleans stay retired, and nothing reads them', async () => {
        const routes = await read('src/lib/storage-routes.js');
        for (const key of ['blackScreenSaver', 'screensaverClock', 'screensaverImages']) {
            assert.ok(routes.includes(key), `${key} is not even named in storage-routes.js`);
        }
        for (const file of await srcFiles()) {
            if (file === 'src/lib/storage-routes.js') continue;
            const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            assert.ok(!/blackScreenSaver|screensaverClock/.test(code),
                `${file} still reads a retired screensaver setting — the type row carries all three `
                + 'answers, and a boolean beside it would be a second store for one question');
        }
    });
});
