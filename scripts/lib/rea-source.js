

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The ReaPrime checkout the contract is generated from. Set REA_ROOT to point at one. */
export const REA_ROOT = process.env.REA_ROOT || '../reaprime';

export const PINNED_COMMIT = '42f67f69334197a08cc0f4138ca05302616e977a';

/**
 * Whether REA_ROOT resolves to a checkout. The suites that read Dart source are a
 * maintainer's freshness check; without a checkout they skip rather than fail.
 */
export const REA_SOURCE_PRESENT = existsSync(join(REA_ROOT, 'pubspec.yaml'));

export class ReaSourceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReaSourceError';
    }
}

/** Read a file from the pinned worktree by its repo-relative path. */
export function readReaFile(relative, { reaRoot = REA_ROOT } = {}) {
    const path = join(reaRoot, relative);
    if (!existsSync(path)) {
        throw new ReaSourceError(
            `ReaPrime source not found at ${path}. This artifact is generated from the pinned ` +
            `reference worktree; set REA_ROOT to a checkout of ReaPrime at ${PINNED_COMMIT}.`,
        );
    }
    return { path, relative, text: readFileSync(path, 'utf8') };
}

export function resolveReaCommit({ reaRoot = REA_ROOT, require: requirePin = true } = {}) {
    let head;
    try {
        head = execFileSync('git', ['-C', reaRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch (e) {
        throw new ReaSourceError(`cannot resolve HEAD of ${reaRoot} (${e.message})`);
    }
    if (requirePin && head !== PINNED_COMMIT) {
        throw new ReaSourceError(
            `${reaRoot} is at ${head}, not the pinned ${PINNED_COMMIT}. Wave 0b stamps every ` +
            'contract entry with the pinned commit. Re-pin the worktree, or update ' +
            'PINNED_COMMIT deliberately and re-run every contract check with it.',
        );
    }
    return head;
}
