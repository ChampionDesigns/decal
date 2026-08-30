/**
 * Every authored module parses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

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
