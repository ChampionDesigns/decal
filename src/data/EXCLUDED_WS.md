# Deliberately not built — the WebSocket layer

Companion to `EXCLUDED.md` (the REST dead surface), for this layer's socket half. Same rule:
**absence is hard to review** — a reader sees what was written, not what was left out — so
every omission is written down with a reason and a citation.

Everything below was checked against ReaPrime **as written** at
`42f67f69334197a08cc0f4138ca05302616e977a`
(the pinned ReaPrime checkout, read-only). Old-skin line numbers are from the previous
skin's modules and go soft the moment anything moves — **re-anchor by symbol**.

**How to remove a row.** Not by needing the thing. By a decision that says the citation is
wrong or no longer holds, recorded next to the row.

---

## The three sockets ReaPrime serves and this skin does not open

Not consumed, deliberately: `/ws/v1/machine/raw`, `/ws/v1/logs` and
`/ws/v1/webview/logs`. They are absent from `rea-ws-channels.js` on purpose — a table of
channels is a table of things we open — so this is the only place they are named.

| Not opened | Why | Citation |
|---|---|---|
| `/ws/v1/machine/raw` | The raw BLE/USB characteristic traffic, `RawStreamEvent`s straight off the machine. It is a debugging tap for ReaPrime's own developers: everything the skin needs off it is already decoded onto `/ws/v1/machine/snapshot`, `shotSettings`, `shotState` and `waterLevels`, and decoding it a second time in the skin would be a second implementation of a protocol the server owns — the exact drift this rewrite exists to remove. It is also the highest-rate socket on the box. | `de1handler.dart` `_handleRawSocket`, registered at `app.get('/ws/v1/machine/raw', ...)`; `de1.rawOutStream` |
| `/ws/v1/logs` | ReaPrime's own log stream. A skin that renders the server's logs is a diagnostic tool, and the diagnostic tool exists already (ReaPrime's settings screens). Nothing in the Decal inventory shows them. | `settings_handler.dart` `_handleLogsRequest` |
| `/ws/v1/webview/logs` | **Worth knowing about even unconsumed.** This is the socket ReaPrime uses to capture the *webview's own* console — the skin does not read it, the skin FEEDS it, which is why the logger binds to `console.*`. Skin logs are recoverable server-side for free over `GET /api/v1/webview/logs`; there is nothing to subscribe to. | `webview_logs_handler.dart` `_handleWebSocketLogs` |

Consequence worth stating once: **`assets/api/websocket_v1.yml` documents thirteen
channels, and thirteen is ten plus three.** `rea-ws-channels.js` carries the ten (with
`SensorSnapshot` and `Plugins` in their templated forms) and this section carries the
remainder, so every socket ReaPrime publishes is either consumed or excluded on the record.
Nothing is unaccounted for, and a fourteenth appearing upstream shows up as a channel in
neither list.

## Connectors that do not port

| Not built | Why | Citation |
|---|---|---|
| `connectProfileGeneratedWebSocket` — a 34-line connector with **zero call sites** | Measured: every other `connect*WebSocket` export in that module has between 2 and 7 callers; this one has none anywhere in the tree. It dials `/ws/v1/plugins/decent-profile.reaplugin/profileGenerated`, which is a real endpoint and stays reachable — as a `pluginEndpointPath(...)` channel like any other — so **the address is kept and the wrapper is not**. Nothing consumes it tonight; the first screen that wants generated-profile events opens the channel, and does not resurrect a bespoke connector to do it. | `connectProfileGeneratedWebSocket` (grep: 0 references outside its own module); one of six further zero-call-site exports, including an entire 34-line WebSocket connector nobody opens. |
| A per-channel `on*` handler surface (`onData, onReconnect, onDisconnect, onError` callbacks) | Nine connectors, nine slightly different callback signatures, and the differences were accidents rather than decisions: `connectScaleWebSocket` takes three, `connectDeviceWebSocket` four, `connectShotStateWebSocket` one. One `subscribe(frame => …)` plus one `onSignal(signal => …)` replaces all of them, and a caller that wants "disconnected" reads the signal rather than being handed a bespoke callback for it. | `connectWebSocket`, `connectScaleWebSocket`, `connectDeviceWebSocket`, `connectShotStateWebSocket` |
| A send() queue / command replay on reconnect | Never existed in the old tree either — recorded here because it is the obvious thing to "improve" while writing a socket layer. A command that is applied minutes after the user asked for it arrives attributed to an intent they have moved on from: `setBrightness` replayed after a wake, a `connect` replayed at a machine they walked away from. `send()` returns `{ok: false, reason}` and the caller decides. | `rea-sockets.js` "there is no fallback path here" |
| A synthesised "disconnected" frame on close | The temptation is to emit a zeroed frame so a screen has something to render. That is a manufactured answer to a transport failure — the same defect as `getPlugins() -> null` in the REST layer (`EXCLUDED.md`), wearing a different hat. On close the replay value is dropped, `last()` returns `null`, and the absence is visible. | `rea-fanout.js` `clear()`; the port notes |

## Two modules whose reason has gone (context, not this file's work)

Both are `gate3-drop-socket-slot-machine-link`'s rows rather than this layer's, and are named
here only so a reader of `rea-sockets.js` knows why it does not import either:

* **The socket-slot manager (75 lines)** — its founding premise was that ReaPrime bound
  machine sockets to a De1 *instance* and never re-bound them on swap. That was fixed upstream in
  `31ea7c1a`: `_withDe1Ws` (`de1handler.dart`) detaches and re-attaches every machine-bound
  socket when the instance changes. The *policy* it encoded — close-before-open, silence
  the discarded socket — is not dropped: it is rules B and C in `rea-sockets.js`, applied to
  all ten channels instead of two.
* **The machine-link resync driver (128 lines)** — drove the resync machinery that premise
  required. The device-connection reader replaces it with something richer
  (`rea-devices.js`), and its one durable rule — a malformed frame maps to `null`, distinct
  from an empty list — is `readDevicesFrame`'s first assertion, with a test.

## What is NOT excluded, and is not built here either

`/ws/v1/machine/shotState` is consumed (it is in the table), but nothing in this layer
derives shot phase from it. That one derivation belongs to the shot store above, not here.
Likewise the shot-so-far buffer: ReaPrime's sockets are fire-and-forget and **no socket
carries history**, so a subscriber that connects mid-shot has missed the shot — accumulating
it is `gate4-shot-so-far-buffer`'s store, deliberately not this layer's fan-out, which holds
exactly one frame.
