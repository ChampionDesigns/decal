/**
 * A minimal RFC 6455 client, enough to speak CDP and nothing more.
 */

import net from 'node:net';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

/**
 * A connected client. Emits:
 *   'message' (string)  — one complete text message, reassembled across fragments
 *   'close'   (code, reason)
 *   'error'   (Error)
 */
export class WebSocketClient extends EventEmitter {
    #socket;
    #buf = Buffer.alloc(0);
    #fragments = [];
    #fragmentOpcode = null;
    #closed = false;

    constructor(socket, leftover) {
        super();
        this.#socket = socket;
        this.#buf = leftover ?? Buffer.alloc(0);

        socket.on('data', (chunk) => {
            this.#buf = this.#buf.length ? Buffer.concat([this.#buf, chunk]) : chunk;
            try {
                this.#drain();
            } catch (err) {
                this.emit('error', err);
                this.destroy();
            }
        });
        socket.on('error', (err) => {
            if (!this.#closed) this.emit('error', err);
        });
        socket.on('close', () => {
            if (!this.#closed) {
                this.#closed = true;
                this.emit('close', 1006, 'socket closed');
            }
        });

        if (this.#buf.length) {
            setImmediate(() => {
                if (this.#closed || !this.#buf.length) return;
                try {
                    this.#drain();
                } catch (err) {
                    this.emit('error', err);
                    this.destroy();
                }
            });
        }
    }

    get closed() {
        return this.#closed;
    }

    /**
     * Open a connection. `url` is ws://host:port/path — the shape CDP hands back in
     * `webSocketDebuggerUrl`.
     */
    static connect(url, { timeout = 20000 } = {}) {
        const u = new URL(url);
        if (u.protocol !== 'ws:') {
            return Promise.reject(new Error(`ws.js speaks ws: only, got ${u.protocol}`));
        }

        return new Promise((resolve, reject) => {
            const key = crypto.randomBytes(16).toString('base64');
            const expect = crypto
                .createHash('sha1')
                .update(key + GUID)
                .digest('base64');

            const socket = net.connect({
                host: u.hostname,
                port: Number(u.port || 80),
            });
            socket.setNoDelay(true);

            const timer = setTimeout(() => {
                socket.destroy();
                reject(new Error(`websocket handshake to ${url} timed out after ${timeout}ms`));
            }, timeout);

            const fail = (err) => {
                clearTimeout(timer);
                socket.destroy();
                reject(err);
            };

            socket.once('error', fail);

            socket.on('connect', () => {
                const req =
                    `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
                    `Host: ${u.host}\r\n` +
                    'Upgrade: websocket\r\n' +
                    'Connection: Upgrade\r\n' +
                    `Sec-WebSocket-Key: ${key}\r\n` +
                    'Sec-WebSocket-Version: 13\r\n' +
                    '\r\n';
                socket.write(req);
            });

            let head = Buffer.alloc(0);
            const onData = (chunk) => {
                head = Buffer.concat([head, chunk]);
                const end = head.indexOf('\r\n\r\n');
                if (end === -1) {
                    if (head.length > 65536) fail(new Error('websocket handshake headers too large'));
                    return;
                }

                socket.off('data', onData);
                socket.off('error', fail);
                clearTimeout(timer);

                const header = head.subarray(0, end).toString('latin1');
                const leftover = head.subarray(end + 4);
                const status = header.split('\r\n', 1)[0];

                if (!/^HTTP\/1\.1 101\b/.test(status)) {
                    socket.destroy();
                    reject(new Error(`websocket handshake failed: ${status}`));
                    return;
                }
                const accept = /sec-websocket-accept:\s*(\S+)/i.exec(header)?.[1];
                if (accept !== expect) {
                    socket.destroy();
                    reject(new Error('websocket handshake: Sec-WebSocket-Accept mismatch'));
                    return;
                }

                resolve(new WebSocketClient(socket, leftover));
            };
            socket.on('data', onData);
        });
    }

    /** Send one text message as a single masked frame. */
    send(text) {
        if (this.#closed) throw new Error('websocket is closed');
        this.#socket.write(frame(OP_TEXT, Buffer.from(text, 'utf8')));
    }

    close() {
        if (this.#closed) return;
        this.#closed = true;
        try {
            this.#socket.write(frame(OP_CLOSE, Buffer.alloc(0)));
        } catch { /* peer already gone */ }
        this.#socket.destroy();
        this.emit('close', 1000, 'client closed');
    }

    destroy() {
        if (this.#closed) return;
        this.#closed = true;
        this.#socket.destroy();
    }

    #drain() {
        for (;;) {
            const parsed = readFrame(this.#buf);
            if (!parsed) return;
            this.#buf = parsed.rest;
            const { fin, opcode, payload } = parsed;

            switch (opcode) {
                case OP_TEXT:
                case OP_BINARY:
                case OP_CONTINUATION: {
                    if (opcode !== OP_CONTINUATION) {
                        this.#fragmentOpcode = opcode;
                        this.#fragments = [];
                    }
                    this.#fragments.push(payload);
                    if (!fin) break;
                    const whole = Buffer.concat(this.#fragments);
                    this.#fragments = [];
                    const op = this.#fragmentOpcode;
                    this.#fragmentOpcode = null;
                    if (op === OP_BINARY) {
                        this.emit('error', new Error('unexpected binary websocket frame (CDP is text-only)'));
                    } else {
                        this.emit('message', whole.toString('utf8'));
                    }
                    break;
                }
                case OP_PING:
                    this.#socket.write(frame(OP_PONG, payload));
                    break;
                case OP_PONG:
                    break;
                case OP_CLOSE: {
                    const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
                    const reason = payload.length > 2 ? payload.subarray(2).toString('utf8') : '';
                    if (!this.#closed) {
                        this.#closed = true;
                        try {
                            this.#socket.write(frame(OP_CLOSE, payload));
                        } catch { /* peer already gone */ }
                        this.#socket.destroy();
                        this.emit('close', code, reason);
                    }
                    return;
                }
                default:
                    throw new Error(`unknown websocket opcode 0x${opcode.toString(16)}`);
            }
        }
    }
}

/** Build one masked client frame. Exported for the unit test, not for callers. */
export function frame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.alloc(2);
        header[1] = 0x80 | len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[1] = 0x80 | 127;
        header.writeUInt32BE(0, 2);
        header.writeUInt32BE(len, 6);
    }
    header[0] = 0x80 | opcode; // FIN + opcode; this client never fragments

    const mask = crypto.randomBytes(4);
    const masked = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
    return Buffer.concat([header, mask, masked]);
}

export function readFrame(buf) {
    if (buf.length < 2) return null;

    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let offset = 2;

    if (len === 126) {
        if (buf.length < offset + 2) return null;
        len = buf.readUInt16BE(offset);
        offset += 2;
    } else if (len === 127) {
        if (buf.length < offset + 8) return null;
        const hi = buf.readUInt32BE(offset);
        const lo = buf.readUInt32BE(offset + 4);
        if (hi !== 0) throw new Error('websocket frame larger than 4 GiB');
        len = lo;
        offset += 8;
    }

    if (masked) throw new Error('server sent a masked websocket frame (protocol error)');
    if (buf.length < offset + len) return null;

    const payload = buf.subarray(offset, offset + len);
    return { fin, opcode, payload, rest: buf.subarray(offset + len) };
}
