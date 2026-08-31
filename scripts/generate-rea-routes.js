#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './lib/yaml-subset.js';
import { REA_ROOT, PINNED_COMMIT, readReaFile, resolveReaCommit, ReaSourceError } from './lib/rea-source.js';

export const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const OUT_FILE = join(REPO_ROOT, 'src', 'data', 'rea-routes.generated.js');

export const REST_REL = 'assets/api/rest_v1.yml';
export const WS_REL = 'assets/api/websocket_v1.yml';

/** ReaPrime's REST prefix. Routes are also emitted relative to it, as the transport takes them. */
export const API_PREFIX = '/api/v1';

/** HTTP methods a path item may carry. Anything else in the source document is a hard failure. */
const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

export const SPEC_EXCEPTIONS = Object.freeze([
    Object.freeze({
        id: 'shots-orderBy-not-read',
        kind: 'drop-query-param',
        path: '/api/v1/shots',
        method: 'GET',
        param: 'orderBy',
        handlerFile: 'lib/src/services/webserver/shots_handler.dart',
        handlerSymbol: 'ShotsHandler._getShots',
        handlerEvidence: "params['order'] at ~:73 and ~:89; no occurrence of 'orderBy' in the handler directory",
        why: 'documented parameter that no handler reads — emitting it would publish a capability the server does not have',
        upstreamAsk: 'Two new upstream asks the count produced',
        stillNeeded: (spec) => hasQueryParam(spec, '/api/v1/shots', 'get', 'orderBy'),
        goneMessage:
            'rest_v1.yml no longer documents the /api/v1/shots orderBy parameter. The upstream fix has landed: '
            + 'DELETE the shots-orderBy-not-read exception from scripts/generate-rea-routes.js and regenerate.',
    }),
    Object.freeze({
        id: 'plugins-passthrough-any-method',
        kind: 'add-methods',
        path: '/api/v1/plugins/{id}/{endpoint}',
        from: 'get',
        add: Object.freeze(['post']),
        handlerFile: 'lib/src/services/webserver/plugins_handler.dart',
        handlerSymbol: 'PluginsHandler._handlePluginApiEndpoint',
        handlerEvidence: "app.all('/api/v1/plugins/<id>/<endpoint>', …) at :90; final method = req.method at :184; "
            + 'the body is read with req.readAsString() and forwarded to the plugin verbatim',
        why: 'documented GET-only against an app.all handler — a spec-faithful client loses the POST passthrough',
        upstreamAsk: 'Two new upstream asks the count produced',
        marks: Object.freeze({ anyMethod: true }),
        stillNeeded: (spec) => {
            const item = spec.paths['/api/v1/plugins/{id}/{endpoint}'];
            if (!item) return false;
            return METHODS.filter((m) => item[m]).join(',') === 'get';
        },
        goneMessage:
            'rest_v1.yml now documents more than GET on /api/v1/plugins/{id}/{endpoint}. The upstream fix has '
            + 'landed: DELETE the plugins-passthrough-any-method exception from scripts/generate-rea-routes.js '
            + 'and regenerate.',
    }),
    Object.freeze({
        id: 'sensors-list-key-is-id',
        kind: 'rename-response-key',
        path: '/api/v1/sensors',
        method: 'GET',
        inItems: true,
        from: 'name',
        to: 'id',
        handlerFile: 'lib/src/services/webserver/sensors_handler.dart',
        handlerSymbol: "SensorsHandler.addRoutes (inline GET /api/v1/sensors)",
        handlerEvidence: "returns {'id': s.deviceId, 'info': info.toJson()} per sensor; the key 'name' is never emitted",
        why: 'documented response key that the handler does not emit — the served key is id',
        upstreamAsk: 'Same class as the two E2 asks',
        stillNeeded: (spec) => {
            const props = spec.paths?.['/api/v1/sensors']?.get?.responses?.['200']
                ?.content?.['application/json']?.schema?.items?.properties;
            return Boolean(props && props.name && !props.id);
        },
        goneMessage:
            'rest_v1.yml no longer documents /api/v1/sensors list items with a "name" key. The upstream fix has '
            + 'landed: DELETE the sensors-list-key-is-id exception from scripts/generate-rea-routes.js and regenerate.',
    }),
    Object.freeze({
        id: 'account-proxy-query-passthrough',
        kind: 'add-query-params',
        path: '/api/v1/account/proxy/support/api/{endpoint}',
        method: 'GET',
        params: Object.freeze([
            Object.freeze({ name: 'subject', required: false, type: 'string' }),
            Object.freeze({ name: 'body', required: false, type: 'string' }),
        ]),
        handlerFile: 'lib/src/services/webserver/account_proxy_handler.dart',
        handlerSymbol: 'AccountProxyHandler._handleGet',
        handlerEvidence: "rawQuery: request.requestedUri.query at ~:28, forwarded by "
            + "DecentProxyService._buildUri as `query: rawQuery`; the two names are ReaPrime's own, from "
            + "DecentAccountService.emailSerialMismatch ('/support/api/email?subject=$subject&body=$body')",
        why: 'a verbatim query-string relay documented with no query parameters — a spec-faithful client cannot address the only send path a read-scoped skin token has',
        upstreamAsk: 'Same class as the three above',
        stillNeeded: (spec) => {
            const op = spec.paths?.['/api/v1/account/proxy/support/api/{endpoint}']?.get;
            if (!op) return false;
            return !(op.parameters || []).some((p) => p.in === 'query');
        },
        goneMessage:
            'rest_v1.yml now documents query parameters on GET /api/v1/account/proxy/support/api/{endpoint}. The '
            + 'upstream fix has landed: DELETE the account-proxy-query-passthrough exception from '
            + 'scripts/generate-rea-routes.js and regenerate — and CHECK the documented names against the two this '
            + 'exception added before deleting the callers with them.',
    }),
]);

export class GenerateRoutesError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GenerateRoutesError';
    }
}

const hasQueryParam = (spec, path, method, name) => {
    const op = spec.paths?.[path]?.[method];
    return Boolean(op && (op.parameters || []).some((p) => p.in === 'query' && p.name === name));
};

/** `/api/v1/shots/{id}` -> `/shots/<id>`: transport-relative, ReaPrime's own param syntax. */
export function toClientRoute(path) {
    if (!path.startsWith(`${API_PREFIX}/`)) {
        throw new GenerateRoutesError(`route ${path} does not start with ${API_PREFIX}`);
    }
    return path.slice(API_PREFIX.length).replace(/\{([^}]+)\}/g, '<$1>');
}

const pascal = (word) => word
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * A deterministic identifier: method + path, `{param}` becoming `ByParam`.
 * Collisions are a hard failure, never a silent overwrite.
 */
export function deriveId(method, path) {
    const tail = path.slice(API_PREFIX.length).split('/').filter(Boolean)
        .map((seg) => (seg.startsWith('{') ? `By${pascal(seg.slice(1, -1))}` : pascal(seg)))
        .join('');
    return `${method.toLowerCase()}${tail}`;
}

/** Resolve one `$ref` into components. One level only — deliberately. */
function resolveRef(spec, ref) {
    const m = /^#\/components\/(schemas|messages)\/(.+)$/.exec(ref || '');
    if (!m) throw new GenerateRoutesError(`unsupported $ref ${JSON.stringify(ref)}`);
    const target = spec.components?.[m[1]]?.[m[2]];
    if (!target) throw new GenerateRoutesError(`$ref ${ref} does not resolve`);
    return { name: m[2], schema: target };
}

function describeSchema(spec, schema, depth = 0) {
    if (!schema || typeof schema !== 'object') return null;
    if (schema.$ref) {
        const { name, schema: target } = resolveRef(spec, schema.$ref);
        const inner = describeSchema(spec, target, depth);
        return { ref: name, ...inner };
    }
    const out = {};
    const type = schema.type || (schema.properties ? 'object' : null);
    if (type) out.kind = type;
    if (schema.enum) out.enum = schema.enum;
    if (type === 'object' && schema.properties) {
        out.keys = Object.keys(schema.properties);
        if (schema.required) out.requiredKeys = schema.required;
    }
    if (type === 'array' && schema.items && depth < 1) {
        out.items = describeSchema(spec, schema.items, depth + 1);
    }
    if (schema.format) out.format = schema.format;
    return out;
}

/** Status codes in a readable, deterministic order: numeric ascending, `default` last. */
const sortStatuses = (statuses) => [...statuses].sort((a, b) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return Number(a) - Number(b);
});

function describeRequestBody(spec, requestBody) {
    if (!requestBody) return null;
    const content = requestBody.content || {};
    const media = Object.keys(content)[0] || null;
    if (!media) return { required: Boolean(requestBody.required), media: null, schema: null };
    return {
        required: Boolean(requestBody.required),
        media,
        schema: describeSchema(spec, content[media]?.schema),
    };
}

function describeParam(param) {
    const schema = param.schema || {};
    if (schema.$ref) {
        throw new GenerateRoutesError(
            `parameter "${param.name}" uses $ref ${schema.$ref}; resolve it deliberately after checking the `
            + 'referenced schema against the handler, do not let the generator assume it',
        );
    }
    const out = { name: param.name, required: Boolean(param.required), type: schema.type || null };
    if (schema.type === 'array' && schema.items?.type) out.itemsType = schema.items.type;
    if (schema.enum) out.enum = schema.enum;
    if (schema.default !== undefined) out.default = schema.default;
    if (schema.minimum !== undefined) out.minimum = schema.minimum;
    if (schema.maximum !== undefined) out.maximum = schema.maximum;
    return out;
}

function lineIndex(text, needle) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) if (lines[i].startsWith(needle)) return i + 1;
    return null;
}

export function extractRest(spec, text) {
    if (!spec || typeof spec.paths !== 'object') throw new GenerateRoutesError('rest_v1.yml has no paths');
    const routes = [];
    const seen = new Map();

    for (const [path, item] of Object.entries(spec.paths)) {
        const specLine = lineIndex(text, `  ${path}:`);
        for (const key of Object.keys(item)) {
            if (key === 'parameters') {
                throw new GenerateRoutesError(`${path}: path-level parameters are not supported by this generator`);
            }
            if (!METHODS.includes(key)) {
                throw new GenerateRoutesError(`${path}: unexpected path-item key ${JSON.stringify(key)}`);
            }
        }
        for (const method of METHODS) {
            const op = item[method];
            if (!op) continue;
            const params = op.parameters || [];
            const pathParams = params.filter((p) => p.in === 'path');
            const query = params.filter((p) => p.in === 'query');
            const other = params.filter((p) => p.in !== 'path' && p.in !== 'query');
            if (other.length) {
                throw new GenerateRoutesError(`${method.toUpperCase()} ${path}: unsupported parameter location "${other[0].in}"`);
            }

            const responses = op.responses || {};
            const statuses = sortStatuses(Object.keys(responses).map(String));
            const successStatus = statuses.find((s) => /^2\d\d$/.test(s)) || null;
            const success = successStatus ? responses[successStatus] : null;
            const successMedia = success?.content ? Object.keys(success.content)[0] : null;

            const templateParams = (path.match(/\{([^}]+)\}/g) || []).map((s) => s.slice(1, -1));
            const declared = pathParams.map((p) => p.name);
            for (const name of templateParams) {
                if (!declared.includes(name)) {
                    throw new GenerateRoutesError(`${method.toUpperCase()} ${path}: path parameter {${name}} is not declared`);
                }
            }

            const id = deriveId(method, path);
            if (seen.has(id)) {
                throw new GenerateRoutesError(`derived id "${id}" collides: ${seen.get(id)} and ${method.toUpperCase()} ${path}`);
            }
            seen.set(id, `${method.toUpperCase()} ${path}`);

            routes.push({
                id,
                method: method.toUpperCase(),
                path,
                route: toClientRoute(path),
                summary: op.summary || null,
                tags: op.tags || [],
                pathParams: templateParams,
                query: query.map(describeParam),
                body: describeRequestBody(spec, op.requestBody),
                statuses,
                successStatus,
                successMedia,
                successSchema: success?.content && successMedia
                    ? describeSchema(spec, success.content[successMedia]?.schema)
                    : null,
                json: successMedia === 'application/json',
                conditional: statuses.includes('304'),
                etagHeader: Boolean(success?.headers && Object.keys(success.headers).some((h) => h.toLowerCase() === 'etag')),
                specLine,
                exception: null,
            });
        }
    }
    return routes;
}

export function applyExceptions(spec, routes) {
    const applied = [];
    const claim = (route, exception) => {
        if (route.exception && route.exception !== exception.id) {
            throw new GenerateRoutesError(
                `${route.id} is claimed by two exceptions (${route.exception}, ${exception.id}); the row can only `
                + 'record one, so merge them or widen the emitted shape deliberately',
            );
        }
        route.exception = exception.id;
    };

    for (const exception of SPEC_EXCEPTIONS) {
        if (!exception.stillNeeded(spec)) throw new GenerateRoutesError(exception.goneMessage);

        if (exception.kind === 'drop-query-param') {
            const target = routes.find((r) => r.path === exception.path && r.method === exception.method);
            if (!target) throw new GenerateRoutesError(`exception ${exception.id}: ${exception.method} ${exception.path} is not in the spec`);
            const before = target.query.length;
            target.query = target.query.filter((q) => q.name !== exception.param);
            if (target.query.length === before) {
                throw new GenerateRoutesError(`exception ${exception.id}: parameter ${exception.param} was not present to drop`);
            }
            claim(target, exception);
            applied.push({
                id: exception.id,
                effect: `dropped query parameter "${exception.param}" from ${exception.method} ${exception.path}`,
                routes: [target.id],
                handlerFile: exception.handlerFile,
                handlerSymbol: exception.handlerSymbol,
                handlerEvidence: exception.handlerEvidence,
                why: exception.why,
                upstreamAsk: exception.upstreamAsk,
            });
            continue;
        }

        if (exception.kind === 'add-query-params') {
            const target = routes.find((r) => r.path === exception.path && r.method === exception.method);
            if (!target) throw new GenerateRoutesError(`exception ${exception.id}: ${exception.method} ${exception.path} is not in the spec`);
            for (const param of exception.params) {
                if (target.query.some((q) => q.name === param.name)) {
                    throw new GenerateRoutesError(
                        `exception ${exception.id}: query parameter ${param.name} is already documented — the spec may `
                        + 'already be fixed, so re-read it and delete the exception rather than widening it further',
                    );
                }
                target.query.push({ name: param.name, required: param.required === true, type: param.type });
            }
            claim(target, exception);
            applied.push({
                id: exception.id,
                effect: `added query parameter(s) ${exception.params.map((p) => `"${p.name}"`).join(', ')} `
                    + `to ${exception.method} ${exception.path}`,
                routes: [target.id],
                handlerFile: exception.handlerFile,
                handlerSymbol: exception.handlerSymbol,
                handlerEvidence: exception.handlerEvidence,
                why: exception.why,
                upstreamAsk: exception.upstreamAsk,
            });
            continue;
        }

        if (exception.kind === 'add-methods') {
            const source = routes.find((r) => r.path === exception.path && r.method === exception.from.toUpperCase());
            if (!source) throw new GenerateRoutesError(`exception ${exception.id}: ${exception.from.toUpperCase()} ${exception.path} is not in the spec`);
            claim(source, exception);
            Object.assign(source, exception.marks || {});
            const added = [];
            for (const method of exception.add) {
                const clone = {
                    ...structuredClone({ ...source, exception: null }),
                    id: deriveId(method, exception.path),
                    method: method.toUpperCase(),
                    exception: exception.id,
                    ...(exception.marks || {}),
                };
                if (routes.some((r) => r.id === clone.id)) {
                    throw new GenerateRoutesError(`exception ${exception.id}: ${clone.id} already exists — the spec may already be fixed`);
                }
                routes.splice(routes.indexOf(source) + 1 + added.length, 0, clone);
                added.push(clone.id);
            }
            applied.push({
                id: exception.id,
                effect: `added ${exception.add.map((m) => m.toUpperCase()).join(', ')} on ${exception.path}`,
                routes: [source.id, ...added],
                handlerFile: exception.handlerFile,
                handlerSymbol: exception.handlerSymbol,
                handlerEvidence: exception.handlerEvidence,
                why: exception.why,
                upstreamAsk: exception.upstreamAsk,
            });
            continue;
        }

        if (exception.kind === 'rename-response-key') {
            const target = routes.find((r) => r.path === exception.path && r.method === exception.method);
            if (!target) throw new GenerateRoutesError(`exception ${exception.id}: ${exception.method} ${exception.path} is not in the spec`);
            const holder = exception.inItems ? target.successSchema?.items : target.successSchema;
            if (!holder?.keys?.includes(exception.from)) {
                throw new GenerateRoutesError(`exception ${exception.id}: response key ${exception.from} was not present to rename`);
            }
            const swap = (list) => (list ? list.map((k) => (k === exception.from ? exception.to : k)) : list);
            holder.keys = swap(holder.keys);
            holder.requiredKeys = swap(holder.requiredKeys);
            claim(target, exception);
            applied.push({
                id: exception.id,
                effect: `renamed response key "${exception.from}" to "${exception.to}" on ${exception.method} ${exception.path}`
                    + (exception.inItems ? ' (array items)' : ''),
                routes: [target.id],
                handlerFile: exception.handlerFile,
                handlerSymbol: exception.handlerSymbol,
                handlerEvidence: exception.handlerEvidence,
                why: exception.why,
                upstreamAsk: exception.upstreamAsk,
            });
            continue;
        }

        throw new GenerateRoutesError(`exception ${exception.id}: unknown kind ${exception.kind}`);
    }
    return applied;
}

export function extractSockets(spec, text) {
    if (!spec || typeof spec.channels !== 'object') throw new GenerateRoutesError('websocket_v1.yml has no channels');
    const messageName = (ref) => {
        const direct = /^#\/components\/messages\/(.+)$/.exec(ref);
        if (direct) return direct[1];
        const viaChannel = /^#\/channels\/([^/]+)\/messages\/(.+)$/.exec(ref);
        if (viaChannel) {
            const channel = spec.channels[viaChannel[1]];
            const entry = channel?.messages?.[viaChannel[2]];
            if (!entry?.$ref) throw new GenerateRoutesError(`socket message ${ref} does not resolve`);
            return messageName(entry.$ref);
        }
        throw new GenerateRoutesError(`unsupported message $ref ${ref}`);
    };

    const byChannel = new Map();
    for (const [name, channel] of Object.entries(spec.channels)) {
        if (!channel.address) throw new GenerateRoutesError(`channel ${name} has no address`);
        const address = channel.address.startsWith('/') ? channel.address : `/${channel.address}`;
        const messages = Object.values(channel.messages || {}).map((m) => messageName(m.$ref));
        byChannel.set(name, {
            id: name,
            address,
            route: address.replace(/\{([^}]+)\}/g, '<$1>'),
            params: (address.match(/\{([^}]+)\}/g) || []).map((s) => s.slice(1, -1)),
            messages,
            receives: [],
            sends: [],
            specLine: lineIndex(text, `  ${name}:`),
        });
    }

    for (const [opName, op] of Object.entries(spec.operations || {})) {
        const ref = op.channel?.$ref || '';
        const m = /^#\/channels\/(.+)$/.exec(ref);
        if (!m) throw new GenerateRoutesError(`operation ${opName}: unsupported channel $ref ${ref}`);
        const channel = byChannel.get(m[1]);
        if (!channel) throw new GenerateRoutesError(`operation ${opName}: channel ${m[1]} is not declared`);
        const names = op.messages ? op.messages.map((entry) => messageName(entry.$ref)) : channel.messages;
        const bucket = op.action === 'send' ? channel.sends : channel.receives;
        if (op.action !== 'send' && op.action !== 'receive') {
            throw new GenerateRoutesError(`operation ${opName}: unknown action ${op.action}`);
        }
        for (const name of names) if (!bucket.includes(name)) bucket.push(name);
    }

    return [...byChannel.values()].map((c) => ({
        id: c.id,
        address: c.address,
        route: c.route,
        params: c.params,
        bidirectional: c.sends.length > 0,
        receives: c.receives,
        sends: c.sends,
        specLine: c.specLine,
    }));
}

const INDENT = '    ';

/** Emit a JS literal: objects one key per line, short scalar arrays inline. */
export function literal(value, depth = 1) {
    const pad = INDENT.repeat(depth);
    const padIn = INDENT.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const scalar = value.every((v) => v === null || typeof v !== 'object');
        if (scalar) {
            const inline = `[${value.map((v) => literal(v, depth)).join(', ')}]`;
            if (inline.length + pad.length <= 96) return inline;
        }
        return `[\n${value.map((v) => `${padIn}${literal(v, depth + 1)},`).join('\n')}\n${pad}]`;
    }
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const inline = `{ ${entries.map(([k, v]) => `${key(k)}: ${literal(v, depth)}`).join(', ')} }`;
    if (!entries.some(([, v]) => v && typeof v === 'object') && inline.length + pad.length <= 96) return inline;
    return `{\n${entries.map(([k, v]) => `${padIn}${key(k)}: ${literal(v, depth + 1)},`).join('\n')}\n${pad}}`;
}

const key = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k));

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function render({ reaRoot = REA_ROOT, requireCommit = true } = {}) {
    const rest = readReaFile(REST_REL, { reaRoot });
    const ws = readReaFile(WS_REL, { reaRoot });
    const commit = resolveReaCommit({ reaRoot, require: requireCommit });

    const restSpec = parseYaml(rest.text, { file: REST_REL });
    const wsSpec = parseYaml(ws.text, { file: WS_REL });

    const routes = extractRest(restSpec, rest.text);
    const applied = applyExceptions(restSpec, routes);
    const channels = extractSockets(wsSpec, ws.text);

    const counts = {
        routes: routes.length,
        paths: Object.keys(restSpec.paths).length,
        conditional: routes.filter((r) => r.conditional).length,
        channels: channels.length,
        exceptions: applied.length,
    };

    const routeText = routes.map((r) => `${INDENT}${literal(r, 1)},`).join('\n');
    const channelText = channels.map((c) => `${INDENT}${literal(c, 1)},`).join('\n');
    const appliedText = applied.map((a) => `${INDENT}${literal(a, 1)},`).join('\n');

    return `// GENERATED FILE — DO NOT EDIT.
//
//   generator: scripts/generate-rea-routes.js
//   sources:   ${REST_REL} (sha256 ${sha256(rest.text).slice(0, 16)})
//              ${WS_REL} (sha256 ${sha256(ws.text).slice(0, 16)})
//   commit:    ${commit}
//
// Regenerate with \`node scripts/generate-rea-routes.js\`; \`--check\` fails on a stale
// artifact and test/rea-routes-freshness.test.mjs runs that check in CI.
//
// This is the DOCUMENTED SURFACE, complete: every path and verb in ReaPrime's own specs,
// ${counts.routes} REST operations across ${counts.paths} paths and ${counts.channels} socket channels. It is a table, not a
// client — no fetch, no base URL, no error policy. \`src/data/rea-routes.js\` binds a row to
// the injected transport, and only for the calls the stores and connectors make.
//
// ${applied.length} ROWS DO NOT MATCH THE SPEC, DELIBERATELY. Where \`rest_v1.yml\` and the Dart handler
// disagree at ${commit.slice(0, 8)}, the handler wins: see REA_ROUTE_EXCEPTIONS below, and the
// commented exception config in the generator. Each is an upstream ask; each deletes itself
// (the generator hard-fails) the moment the source document is fixed.
//
// \`successMedia\` / \`json\` are what the source document declares. A null there means the response
// content is undocumented — not a promise that no body arrives (PUT /machine/cupWarmer
// documents "200 Accepted" and the handler returns {"status":"accepted"}).
//
// Absence is a signal here too: a route missing from this table is a route ReaPrime
// does not document, and the answer is never to hand-write it at the call site.

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}

/**
 * Every documented REST operation, in source order.
 *
 * \`path\` is as documented (\`/api/v1/shots/{id}\`); \`route\` is what the transport takes —
 * relative to \`${API_PREFIX}\`, in ReaPrime's own \`<param>\` syntax, so it matches the route
 * strings already used in \`rea-conditional.js\`.
 */
export const REST_ROUTES = deepFreeze([
${routeText}
]);

/**
 * Every documented WebSocket channel. \`sends\` is non-empty only where the channel is
 * bidirectional — devices, display, update and the raw characteristic channel — which is
 * the fact the connection surface rests on: the state arrives AND the answer goes back on the same
 * socket.
 */
export const SOCKET_CHANNELS = deepFreeze([
${channelText}
]);

/**
 * Where this table deliberately departs from \`rest_v1.yml\`, with the handler evidence.
 * A contract-table entry citing one of these rows should cite the handler, not the yml.
 */
export const REA_ROUTE_EXCEPTIONS = deepFreeze([
${appliedText}
]);

/** Provenance, asserted by the freshness test rather than trusted. */
export const REA_ROUTES_SOURCE = deepFreeze({
    commit: '${commit}',
    rest: { file: '${REST_REL}', sha256: '${sha256(rest.text)}' },
    websocket: { file: '${WS_REL}', sha256: '${sha256(ws.text)}' },
    counts: ${literal(counts, 1)},
});

/** \`GET /shots\` -> the row. Built here so there is exactly one index, not one per caller. */
export const REST_ROUTE_BY_KEY = deepFreeze(Object.fromEntries(
    REST_ROUTES.map((r) => [\`\${r.method} \${r.route}\`, r]),
));

/** \`getShotsById\` -> the row. */
export const REST_ROUTE_BY_ID = deepFreeze(Object.fromEntries(REST_ROUTES.map((r) => [r.id, r])));

/** \`/ws/v1/machine/snapshot\` -> the channel. */
export const SOCKET_CHANNEL_BY_ROUTE = deepFreeze(Object.fromEntries(
    SOCKET_CHANNELS.map((c) => [c.route, c]),
));
`;
}

/** @returns {{ok: boolean, stale: boolean, expected: string, actual: string|null}} */
export function check(options = {}) {
    const expected = render(options);
    const actual = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : null;
    return { ok: actual === expected, stale: actual !== expected, expected, actual };
}

/** Write the artifact. @returns {{written: boolean, path: string}} */
export function generate(options = {}) {
    const { ok, expected } = check(options);
    if (!ok) writeFileSync(OUT_FILE, expected, 'utf8');
    return { written: !ok, path: OUT_FILE };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    try {
        if (process.argv.includes('--summary')) {
            const rest = readReaFile(REST_REL);
            const ws = readReaFile(WS_REL);
            const restSpec = parseYaml(rest.text, { file: REST_REL });
            const wsSpec = parseYaml(ws.text, { file: WS_REL });
            const routes = extractRest(restSpec, rest.text);
            const applied = applyExceptions(restSpec, routes);
            const channels = extractSockets(wsSpec, ws.text);
            process.stdout.write(
                `paths ${Object.keys(restSpec.paths).length}, operations ${routes.length} `
                + `(conditional ${routes.filter((r) => r.conditional).length}), channels ${channels.length}, `
                + `exceptions applied ${applied.length}\n`,
            );
        } else if (process.argv.includes('--check')) {
            if (check().stale) {
                process.stderr.write('src/data/rea-routes.generated.js is STALE — run: node scripts/generate-rea-routes.js\n');
                process.exit(1);
            }
            process.stdout.write('rea-routes.generated.js is fresh\n');
        } else {
            const { written, path } = generate();
            process.stdout.write(`${written ? 'wrote' : 'unchanged'} ${path}\n`);
        }
    } catch (e) {
        if (e instanceof GenerateRoutesError || e instanceof ReaSourceError || e.name === 'YamlSubsetError') {
            process.stderr.write(`${e.message}\n`);
            process.exit(1);
        }
        throw e;
    }
}
