

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The pinned reference worktree. Override for a differently-placed checkout. */
export const REA_ROOT = process.env.REA_ROOT || '/home/ben/bengle/_port/worktrees/rea-reanchor-v3';

export const PINNED_COMMIT = '2b047d02e42e29bf2d96a2aa964ef94e4a4daba3';

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
