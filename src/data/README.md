# src/data/

The ReaPrime address layer and transport: the API module, socket management, the
current-names reader (`CARRY_FORWARD.md` Gate 2 / Gate 3). Contract detail belongs to
SCOPE Part 3, not to the layout.

The storage-key prefix and every app-level event name follow the skin id: `decal.*`
(A10 - renamed with the id, no migration). Nothing here is named after another skin.

## Gate 2 — the address layer

One reader speaks ReaPrime's current names. Nothing above this layer touches a raw frame
key, so a rename upstream is one file to change and it announces itself on the first frame.

| module | what it owns |
|---|---|
| `rea-names.js` | the name tables and the rename table. **The one file where a dead server key may be written down** — as data, never as a read path. |
| `reading.js` | readings: a finite number, or an absence with a reason. Key presence is the validity test; the 0.3 gate lives in ReaPrime and appears nowhere here. |
| `machine-state.js` | the generated enum plus the two classifications made from it (pouring, and the post-shot review window). |
| `machine-state.generated.js` | **generated** from ReaPrime's `machine.dart` by `scripts/generate-machine-state.js`. Do not edit. |
| `rea-address.js` | the reader: machine snapshot, scale, the two sensors, stored measurements, stored steam. |

### The four rules

1. **A7 — never port a fallback path.** No `?? computeR(...)`, no delta-plus-EMA weight
   flow, no zero standing in for a measurement. A missing channel is a gap or a dash.
   The old skin's fallbacks are how seven renames shipped as silent misreadings.
2. **Key presence is the validity signal** for the three `*Derived` channels and every
   estimator channel outside the always-present six. ReaPrime omits rather than nulls and
   says so in its own comment. On the **scale** the keys are unconditional, so there a
   *null* is the absence signal — a real shape difference, not an inconsistency.
3. **In a stored shot, absence is permanent.** No `sensors` key means unavailable for that
   shot forever: `MachineSnapshot.fromJson` reads a fixed key list with no unknown-key bag,
   so anything else in the row was dropped the first time ReaPrime read it. Render a gap;
   never fall through to the derived channel and present it as the same measurement.
4. **No machine-type branch.** There is deliberately no reader for `machine.weight`,
   `machine.weightFlow` or `machine.milkTemperature` — `633f6f68` deleted all three.
   Gravimetric flow is `scale.weightFlow` for every machine; milk temperature is the milk
   probe's `temperature`. A frame still carrying a dead name is *reported* through
   `deadKeys`, never read.

### Tests

`test/rea-names.test.mjs` re-derives every table from the Dart sources at the pinned
commit, so upstream drift is a red test rather than a wrong chart.
`test/rea-dead-names.test.mjs` scans `src/` for reads of a dead name and ships a canary
plus a clean control. `test/machine-state-freshness.test.mjs` regenerates the enum and
fails on a diff.

## Gate 3 — the transport core

One client. It knows where the server is, how a request is spelled, what a failure looks
like, and which GETs may be conditional. Route knowledge belongs above it; frame knowledge
beside it in `rea-address.js`; painting nowhere near it.

| module | what it owns |
|---|---|
| `rea-transport.js` | the client: base URL **by injection**, `reaPath` (encodes every interpolated segment), `reaQuery`, one timeout, `If-None-Match` on registered routes. No `window`, no `localStorage`, no retry. |
| `rea-errors.js` | the typed failure surface — `network` / `timeout` / `http` / `decode` / `conditional`. A failure is data, never a toast and never a manufactured value. |
| `rea-conditional.js` | which routes ReaPrime serves ETag/304 for, re-derived from `jsonOkConditional`'s call sites by test, plus the bounded last-body store that makes a 304 legible. |
| `rea-cache.js` | the TTL primitive (a **named payoff** is required to construct one) and the register of the only two caches allowed to exist. |
| `rea-de1-settings.js` | those two caches wired to their routes, with write-through invalidation of **both** on any successful write. |
| `rea-profile.js` | the ONE profile sanitizer, and B9's refusal philosophy: send it, let ReaPrime return the typed 400, surface the message intact. |
| `rea-routes.generated.js` | **generated** from `rest_v1.yml` + `websocket_v1.yml` by `scripts/generate-rea-routes.js` — the complete documented surface, 143 REST rows and 13 channels. Do not edit. |
| `rea-routes.js` | lookup and spelling over that table, plus the five call helpers this wave's stores actually call. Table complete, helpers demand-driven **and consumer-checked** — see `ROUTES.md`. |
| `ROUTES.md` | the route layer's own doc: the split, the three named spec exceptions and what was checked rather than assumed. |
| `EXCLUDED.md` | **what was deliberately not built**, with a reason and a citation each. Read it before adding anything to this directory. |

### The four rules here

1. **A7 again — no fallback.** No stale-cache-on-error, no `?? null`, no retry, no silent
   refetch behind a 304. Five catch blocks in the old client manufactured an answer from a
   transport failure; one of them made an unreachable server indistinguishable from a
   wrong password.
2. **Injection, not ambient state.** `createReaTransport` throws without a `fetch` and a
   `baseUrl`. `reaBaseUrl()` is pure over values the caller read. The old client computed
   its base URL at import time and could not be tested without a loader hook.
3. **The server owns the refusal (B9).** A `power` exit is sent so ReaPrime refuses it at
   arm time with a typed 400 rather than the skin pre-stripping it into a silent
   behaviour change. One sanitizer, so the save path and the arm path cannot diverge.
4. **Caches carry a named payoff, and there are two.** `de1SettingsCache` (60 s) and
   `de1AdvancedSettingsCache` (40 s): no push stream, no ETag, fifteen serialized MMR
   reads between them. Everything else revalidates or refetches.

### Tests

`test/rea-transport.test.mjs` drives the client with an injected fetch double and asserts
no module in `src/data/` imports UI or reads ambient state.
`test/rea-conditional.test.mjs` re-derives the conditional-route registry from ReaPrime's
handlers at the pinned commit. `test/rea-caches.test.mjs` pins the two-cache register and
the handler facts the payoff rests on. `test/rea-profile.test.mjs` checks the sanitizer
against `profile.dart` and proves the save and arm bodies are identical.
`test/rea-excluded.test.mjs` scans `src/` for re-introduced dead surface, with a canary
pair, and fails if a guarded symbol has no row in `EXCLUDED.md`.

## Gate 3 — the WebSocket layer

**Ten connectors, ONE lifecycle policy.** The old tree ran four at once — slot-managed;
hand-rolled close-before-open; dedupe-on-second-call; and none at all for `shotState` and
the `timeToReady` plugin feed, where a second call leaked the first socket and doubled the
frame rate. Unifying them, not the wrapper count, is where Gate 3's time goes (SCOPE
Part 6, `api.js` row).

| module | what it owns |
|---|---|
| `../../vendor/reconnecting-websocket.js` | Joe Walnes' wrapper, now an ES module and DOM-free, with **both local patches intact** (A11). Reconnect is its job and nothing else's. Five changes, all named: `vendor/README.md`. |
| `rea-ws-channels.js` | the endpoint table as data — path, handler symbol, accepted commands — plus `classifyMessage`, the one implementation of **frame vs envelope**. Three channels multiplex something that is not a frame. |
| `rea-sockets.js` | the policy: one socket per key, close-before-open, silence-the-superseded, replay dies with the socket, refcounted, error-envelope-is-a-signal, bounded attempts where absence is normal. |
| `rea-fanout.js` | one source, many observers, **one** frame of replay — ReaPrime's `shareReplay(1)` mirrored, and the seed Gate 4's stores consume. Not a buffer: the shot-so-far is a store, not a socket. |
| `rea-devices.js` | B8 — read the whole `connectionStatus` (phase, found lists, `pendingAmbiguity`, `error`) **and send the answer** over `PUT /api/v1/devices/connect`. A malformed frame is `null`, distinct from an empty list. |
| `rea-sensors.js` | discovery by polling `GET /api/v1/sensors`, gated on capabilities through the **R3 injection point**, re-run on socket close. The estimator id derives from the machine's deviceId, so a machine swap mints a new one. |
| `EXCLUDED_WS.md` | the three sockets ReaPrime serves and this skin deliberately does not open, the connectors that do not port, and why there is no send queue. |

### The rules that are specific to sockets

1. **A frame is not the only thing on the wire.** The scale interleaves
   `{"status":…}`, the devices socket interleaves command results, and any handler may
   answer `{"error":…}`. An error envelope is a **signal**: never stored, never replayed,
   acted on. Reading one as a frame produces a plausible wrong value, not an error.
2. **Replay is only ever "the newest frame from the source you are subscribed to now".**
   Dropped on close and on retarget — a frame from the previous sensor id is the
   machine-swap defect wearing a disguise.
3. **No send queue, no synthesised disconnect frame.** A7 in socket form.
4. **Reconnect belongs to the vendored wrapper; re-discovery belongs to `rea-sensors.js`.**
   Those are the only two lifecycle jobs the client keeps (SCOPE Part 3 §1).

### Tests

`test/reconnecting-websocket.test.mjs` pins both local patches against a fake socket and
fails if the DOM comes back. `test/rea-sockets.test.mjs` has a test per policy letter, each
one failing under one of the four old policies. `test/rea-fanout.test.mjs` pins the replay
semantics Gate 4 will build on. `test/rea-devices.test.mjs` covers the full B8 frame,
eleven malformed shapes, and the answer path over both transports.
`test/rea-sensors.test.mjs` drives a machine swap end to end: close, re-discover, retarget,
old socket closed, replay dropped.

<!-- gate-d -->
## The contract table (Gate D)

`CONTRACTS.json` records every endpoint this skin adopts — path, verb, request body,
response shape, handler symbol, handler file, and the ReaPrime commit checked against —
and `CONTRACTS.md` explains the columns, the three row statuses and the handler-body gates.

It is the home for the things a schema cannot tell you and only the handler body can:
feedback's 503 means the feature is absent, the arm-time `Unsupported profile` 400 is the
machine refusing (B9), `/shots` clamps the limit to 100 and echoes the number you asked for,
a missing KV key is a 200 carrying null, and the Bengle feature gate answers 404.

`scripts/gate-d.js` enforces it: coverage (a route string in the client with no row),
staleness (a row stamped at the wrong commit), source (the row is still true of the handler
at the pin) and retirement (a retired contract bug's spelling, back in the client).
