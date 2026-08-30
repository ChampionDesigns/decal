/**
 * Launch headless Chrome and speak CDP to it.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { WebSocketClient } from './ws.js';

const CHROME_CANDIDATES = [
    process.env.DECAL_CHROME,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
].filter(Boolean);

const liveProfiles = new Set();
const liveGroups = new Set();
let exitHookInstalled = false;

function installExitHook() {
    if (exitHookInstalled) return;
    exitHookInstalled = true;
    const sweep = () => {
        for (const pid of liveGroups) {
            try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
        }
        liveGroups.clear();
        for (const dir of liveProfiles) {
            try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* nothing useful to do at exit */ }
        }
        liveProfiles.clear();
    };
    process.on('exit', sweep);
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => { sweep(); process.exit(1); });
    }
}

export function chromePath() {
    for (const candidate of CHROME_CANDIDATES) {
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
        } catch { /* try the next one */ }
    }
    throw new Error(
        `no Chrome found. Tried: ${CHROME_CANDIDATES.join(', ')}. ` +
        'Set DECAL_CHROME to an executable.',
    );
}

/**
 * Launch Chrome, wait for its DevToolsActivePort file, and connect.
 * Returns a Connection plus the teardown that kills the browser and removes the
 * profile directory.
 */
export async function launchChrome({
    windowSize = { width: 1281, height: 801 },
    extraArgs = [],
    timeout = 30000,
} = {}) {
    installExitHook();

    const profileDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'decal-gateA-'));
    liveProfiles.add(profileDir);

    const args = [
        '--headless=new',
        // Ephemeral by construction. See the note at the top of this file.
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDir}`,
        `--window-size=${windowSize.width},${windowSize.height}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-search-engine-choice-screen',
        '--mute-audio',
        '--password-store=basic',
        '--use-mock-keychain',
        // NOT --hide-scrollbars: the scroll-floor assertion measures the gutter.
        'about:blank',
        ...extraArgs,
    ];

    const proc = spawn(chromePath(), args, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });
    liveGroups.add(proc.pid);
    let stderr = '';
    proc.stderr.on('data', (d) => {
        stderr = (stderr + d.toString()).slice(-4000);
    });

    let exited = null;
    proc.on('exit', (code, signal) => {
        exited = { code, signal };
    });

    const portFile = path.join(profileDir, 'DevToolsActivePort');
    const deadline = Date.now() + timeout;
    let wsPath = null;
    let port = null;

    while (Date.now() < deadline) {
        if (exited) {
            await cleanupProfile(profileDir);
            throw new Error(
                `Chrome exited before opening a debug port (code=${exited.code} signal=${exited.signal})\n${stderr}`,
            );
        }
        try {
            const text = await fsp.readFile(portFile, 'utf8');
            const [portLine, pathLine] = text.split('\n');
            // The file is written in two steps; a half-written file has no second line.
            if (portLine && pathLine && pathLine.startsWith('/devtools/')) {
                port = Number(portLine.trim());
                wsPath = pathLine.trim();
                break;
            }
        } catch { /* not written yet */ }
        await sleep(25);
    }

    if (!wsPath) {
        proc.kill('SIGKILL');
        await cleanupProfile(profileDir);
        throw new Error(`Chrome never wrote ${portFile} within ${timeout}ms\n${stderr}`);
    }

    const ws = await WebSocketClient.connect(`ws://127.0.0.1:${port}${wsPath}`);
    const connection = new Connection(ws);

    connection.browser = {
        port,
        profileDir,
        pid: proc.pid,
        stderr: () => stderr,
        async kill() {
            if (!exited) {
                try {
                    await Promise.race([connection.send('Browser.close'), sleep(2000)]);
                } catch { /* the signals below are the fallback */ }
            }
            connection.dispose();

            const waitExit = (ms) => Promise.race([
                new Promise((r) => proc.once('exit', () => r(true))),
                sleep(ms).then(() => false),
            ]);

            if (!exited && !(await waitExit(2000))) {
                killGroup(proc.pid, 'SIGTERM');
                if (!(await waitExit(3000))) killGroup(proc.pid, 'SIGKILL');
            }
            killGroup(proc.pid, 'SIGKILL'); // sweep any child that outlived its leader
            liveGroups.delete(proc.pid);

            await cleanupProfile(profileDir);
        },
    };

    return connection;
}

function killGroup(pid, signal) {
    try {
        process.kill(-pid, signal); // negative pid: the whole process group
    } catch {
        try { process.kill(pid, signal); } catch { /* already gone */ }
    }
}

async function cleanupProfile(dir, attempts = 5) {
    for (let i = 0; i < attempts; i++) {
        try {
            await fsp.rm(dir, { recursive: true, force: true, maxRetries: 2 });
            liveProfiles.delete(dir);
            return true;
        } catch {
            await sleep(50 * (i + 1));
        }
    }
    return false; // left in liveProfiles on purpose — the exit hook gets another go
}

/**
 * One WebSocket, many sessions — CDP's "flat" mode. Every page attaches with
 * `flatten: true` and carries its sessionId on each message, so a browser with four
 * pages open needs one socket, not four.
 */
export class Connection extends EventEmitter {
    #ws;
    #nextId = 0;
    #pending = new Map();
    #disposed = false;

    constructor(ws) {
        super();
        this.#ws = ws;
        ws.on('message', (text) => this.#onMessage(text));
        ws.on('close', () => this.#failAll(new Error('CDP connection closed')));
        ws.on('error', (err) => this.#failAll(err));
    }

    #onMessage(text) {
        let msg;
        try {
            msg = JSON.parse(text);
        } catch (err) {
            this.emit('error', err);
            return;
        }
        if (msg.id !== undefined && this.#pending.has(msg.id)) {
            const { resolve, reject, method } = this.#pending.get(msg.id);
            this.#pending.delete(msg.id);
            if (msg.error) {
                const err = new Error(`${method}: ${msg.error.message}${msg.error.data ? ` — ${msg.error.data}` : ''}`);
                err.cdp = msg.error;
                reject(err);
            } else {
                resolve(msg.result);
            }
            return;
        }
        if (msg.method) this.emit('event', msg);
    }

    #failAll(err) {
        for (const { reject } of this.#pending.values()) reject(err);
        this.#pending.clear();
        if (!this.#disposed) this.emit('disconnect', err);
    }

    send(method, params = {}, sessionId = undefined) {
        if (this.#disposed) return Promise.reject(new Error('CDP connection disposed'));
        const id = ++this.#nextId;
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        return new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject, method });
            try {
                this.#ws.send(JSON.stringify(payload));
            } catch (err) {
                this.#pending.delete(id);
                reject(err);
            }
        });
    }

    dispose() {
        this.#disposed = true;
        this.#failAll(new Error('CDP connection disposed'));
        this.#ws.close();
    }
}

export function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
