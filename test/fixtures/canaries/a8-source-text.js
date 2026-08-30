/**
 * CANARY - deliberately violates A8 (scripts/a8-source-text.js).
 * A guard that does not fail on this file is not covering its target.
 *
 * This is what the 29 text-scan test files did, and what §7.4 E1 records: a suite that
 * regex-matches a stylesheet's SOURCE TEXT for a geometry literal. The assertion below
 * would pass against a canvas nobody renders and fail the day the lock is removed -
 * "tests that made the defects UNREMOVABLE".
 *
 * THREE SHAPES, one per hop the scanner resolves, so a regression in any one of them
 * turns this file green and the canary red-flags it:
 *
 *   1. a literal in the read's own arguments;
 *   2. a local READ HELPER, with the path at the call site;
 *   3. a local PATH BINDING handed to a read by name, and the same list walked by a
 *      for-of loop.
 *
 * Node-safe shape - see README.md, "the node-safe shape". Node's test runner treats
 * every .js file under test/ as a test file, so the body is a no-op under `node --test`
 * and the code stays exactly where a static scanner can read it.
 */

export let canaryA8;

if (typeof HTMLElement !== 'undefined') {

const { readFileSync } = await import('node:fs');
const { readFile } = await import('node:fs/promises');

/* 1. the literal, in the read's own arguments. */
const sheet = readFileSync('styles/tokens.css', 'utf8');

/* 2. a read helper - the path is at the CALL SITE, not at the read. */
const repoFile = (relative) => readFileSync(relative, 'utf8');
const component = repoFile('src/components/ui-stepper.js');

/* 3. a path binding, and the same list walked. */
const SOURCE = new URL('../../../src/screens/editor-screen.js', import.meta.url);
const SHEETS = ['styles/tokens.css', 'styles/document.css'];

canaryA8 = async () => {
    const screen = await readFile(SOURCE, 'utf8');
    const all = [];
    for (const file of SHEETS) all.push(await readFile(file, 'utf8'));

    /* THE ASSERTION A8 EXISTS TO KILL: a claim about a file's text, standing in for a
     * claim about a rendered box. */
    return {
        locked: /width:\s*1920px/.test(sheet),
        cap: /64px/.test(component),
        grid: /grid-template-rows/.test(screen),
        sheets: all.length,
    };
};

}
