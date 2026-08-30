/**
 * module-parses.test.mjs — EVERY AUTHORED MODULE PARSES.
 *
 * WHY THIS EXISTS, and it is one defect wearing four faces in a single session.
 *
 * A backtick inside a `css` or `html` tagged template CLOSES IT. What follows is read as
 * JavaScript, and the failure is almost never a message about backticks: it is
 * "Unexpected identifier 'position'", pointing at the middle of a prose comment. This
 * tree's comments are long and quote CSS and code by name, so the trap is loaded on every
 * edit — and it has fired on `ui-chart-card.js`, `history-screen.js`, a test fixture,
 * `ui-button.js`, `selector-screen.js` and `live-screen.js`.
 *
 * WHAT WAS ALREADY THERE AND WHY IT WAS NOT ENOUGH. Gate C's `lost-stylesheet` rule counts
 * comment openers against closers inside each `css` block, which catches the case where
 * the stray backtick lands inside a comment that then swallows the rest of the sheet. It
 * cannot catch the case where the counts stay balanced — and two of the six did. A
 * SYNTAX check catches all six, costs one child process per file, and cannot be argued
 * with.
 *
 * IT IS NOT A STYLE RULE AND MAKES NO CLAIM ABOUT CONTENT. A file either parses as an ES
 * module or it does not.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every authored .js under a root, depth-first. `vendor/` is somebody else's build.
 *
 * AND `test/fixtures/canaries/` IS SKIPPED, WHICH IS NOT AN EXCEPTION TO THIS TEST BUT
 * THE OTHER HALF OF IT. Every guard in Gate C ships a canary: a fixture that deliberately
 * breaks the rule, so the day a guard stops covering its target the canary stops failing
 * and somebody is told. On 27 August 2026 the `parses` guard joined them — it spawns
 * `node --check` over every authored file, and it exists because the backtick trap inside
 * an `html` tagged template is invisible to `lost-stylesheet` (the block scanner only
 * extracts `css` templates). Its canary is therefore a file that DOES NOT PARSE. That is
 * the only shape that canary can take.
 *
 * So this walk and that fixture want opposite things from the same bytes, and the split
 * is by intent rather than by content: everything under `canaries/` is a deliberate
 * violation of something, held there to be violated. Nothing imports them; the guards
 * read them as text and Gate C's own scan roots (src, styles, tools, index.html) exclude
 * them, so a real run never meets one either.
 */
function walk(root, out = []) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
        if (entry.name === 'canaries') continue;
        const path = join(root, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(path);
    }
    return out;
}

test('every authored module parses as an ES module', () => {
    const files = [
        ...walk(join(REPO, 'src')),
        ...walk(join(REPO, 'scripts')),
        ...walk(join(REPO, 'test')),
    ];
    assert.ok(files.length > 200, `the walk found ${files.length} files — it is looking in the wrong place`);

    const broken = [];
    for (const file of files) {
        try {
            execFileSync(process.execPath, ['--input-type=module', '--check'], {
                input: readFileSync(file, 'utf8'),
                stdio: ['pipe', 'ignore', 'pipe'],
            });
        } catch (error) {
            const said = String(error.stderr ?? error.message).split('\n')
                .find((line) => line.includes('Error')) ?? String(error.message);
            broken.push(`${relative(REPO, file)} — ${said.trim()}`);
        }
    }
    assert.deepEqual(broken, [],
        'a module does not parse. The usual cause is a backtick inside a css`` or html`` '
        + 'comment, which closes the template early; the error points at the prose, not at '
        + 'the backtick.');
});
