# Deliberately not built

The dead surface of `api.js`, listed so a later wave does not helpfully port it back.

`api.js` is 2,406 lines and **665 of them are DROP** (`scope/e2-api.md`): 274 defensive
scaffolding, 237 dead code, 62 duplicated logic, 43 caches ReaPrime makes pointless,
8 UI-from-transport, 41 wrong comments and dead branches. Absence is hard to review — a
reviewer sees what was written, not what was left out — so the omissions are written down
here with a reason and a citation each.

Everything below was checked against ReaPrime **as written** at
`2b047d02e42e29bf2d96a2aa964ef94e4a4daba3`
(`/home/ben/bengle/_port/worktrees/rea-reanchor-v3`, read-only). Old-skin line numbers are
from `/home/ben/bengle/_skinlab/slate/app/src/modules/api.js` and go soft the moment
anything moves — **re-anchor by symbol**.

**How to remove a row.** Not by needing the thing. By a decision that says the citation is
wrong or no longer holds, recorded next to the row. Two of the rows below already carry
that shape: D7's preview and F3's reset are both *wanted*, and both are still excluded,
because the work is somewhere else.

---

## Routes that do not exist

| Not built | Why | Citation |
|---|---|---|
| `previewLedStrip` / `clearLedStripPreview` — `POST /machine/ledStrip/preview` and `.../preview/clear` | These endpoints have never existed in ReaPrime, so every call from the settings page 404s, and the failure was swallowed as "preview is a nicety". **This is not D7's live preview** — D7 drives the strip from the four REAL routes below, and those stay. D7 was reversed in Ben's favour: *ReaPrime gains the two endpoints*, so this is an upstream feature ask, not skin work. 18 lines, the entire UNCLEAR bucket; DROP either way. | `api.js:1415-1430`; `de1handler.dart` `addRoutes` — the only ledStrip routes are `GET /api/v1/machine/ledStrip`, `PUT /api/v1/machine/ledStrip`, `POST /api/v1/machine/ledStrip/commit`, `POST /api/v1/machine/ledStrip/reset`. DECISIONS.md "The reversal — D7"; ITEMS.json `gate3-dead-surface`. |
| `calibrateScale`'s `POST /machine/scale/calibrate` and `buildCalibrateBody` | Written against an API that has never existed: wrong path, wrong verb, wrong command set, wrong body key, wrong response model. The real contract is `PUT /api/v1/machine/scaleCalibration`, commands `abort\|zero\|latch`, body `weightGrams`. | `api.js:196`, `loadcell-cal.js`; `de1handler.dart` `PUT /api/v1/machine/scaleCalibration`; `scope/06-carry-forward.md` `loadcell-cal.js` row. |
| `setCupWarmerPrewarm` — `PUT /machine/cupWarmer` with `{prewarmEnabled, prewarmLeadMinutes}` | That handler returns 400 unconditionally for a body without `temperature` or `enabled`. The real route is `PUT /api/v1/machine/cupWarmer/preheat` with `{enabled, leadMinutes}`. The old comment block documents the wrong response shape in both directions. | `api.js:1372`; `de1handler.dart` `PUT /api/v1/machine/cupWarmer` and `PUT /api/v1/machine/cupWarmer/preheat`. |
| The `orderBy` query parameter on `GET /shots` | No handler reads it. The real parameter is `order=asc\|desc`. `rest_v1.yml` documents `orderBy` anyway, so a generated client would faithfully emit a dead parameter — one of the two upstream schema fixes. | `api.js:1721`; `shots_handler.dart` `_getShots` reads `params['order']` only. |

## Duplicates — one of each, by construction

| Not built | Why | Citation |
|---|---|---|
| `getValueFromStore` / `setValueInStore` — the **unencoded** second implementation of the KV routes | Two implementations of the same two routes were live from different callers, and only one percent-encoded. A namespace or key containing `/`, `#` or a space broke one path and not the other. Decal has one KV client, `rea-kv-backend.js`, and `reaPath` in `rea-transport.js` makes encoding the short spelling. | `api.js:1665,:1682` vs `api.js:865,:871`; `scope/e2-api.md` new bug 2. |
| The inline profile sanitizer inside `updateWorkflow` | It had drifted from the shared one: a weight exit was nulled instead of folded into `step.weight`, so a profile kept its stop-at-weight target when **saved** and silently lost it when **armed**. One sanitizer — `rea-profile.js` — makes the divergence inexpressible. Its two extra rules (pump-field pruning, zero-limiter nulling) are not carried either; both premises are refuted at the pinned commit, reasons in the module header. | `api.js:1109-1134` vs `api.js:924-947`; `profile.dart` `ProfileStep.fromJson`, `ProfileStepPower.fromJson`; `workflow_handler.dart` `_applyUpdate`. |
| `getProfile` | A duplicate of `getWorkflow` plus a `.profile` selector, and it passes `{targetAddressSpace: 'local'}` as a `fetch` init option, which is not one. | `api.js:1024`. |

## Caches that do not pay

| Not built | Why | Citation |
|---|---|---|
| `reatsettingscache` (40 s over `GET /api/v1/settings`) | The handler assembles 22 in-memory scalars with **zero I/O**. Caching it buys nothing and costs staleness — and it was never invalidated by `setReaSettings`, only by `ensureGatewayModeTracking`, the one setting nobody edits by hand, so every setting changed from the settings page read back pre-change for up to 40 s. | `api.js:85-89,:1287-1307,:1614,:1653-1657`; `settings_handler.dart` `GET /api/v1/settings`. |
| `currentShotSettings`, `updateShotSettingsCache`, `sendShotSettings` | A write-only mirror kept current for a function with no caller anywhere in `src/` or `test/`. | `api.js:60-70,:92,:1163`. |
| Local shot-list mirroring | Replaced by revalidation: ReaPrime serves ETag/304 on every list the skin reads and the old skin never sent `If-None-Match`. See `rea-conditional.js`. | `json_response.dart` `jsonOkConditional`; seven call sites across five handlers. |
| The profiles-to-IDB cache | Its only read is inside an API catch block that cannot fire: ReaPrime serves the skin and the API from one origin, so if the API is down, nothing served the skin. | SCOPE Part 3 §4. |
| Returning **expired** cached settings from the error path | `getDe1Settings` answered a failed request with stale data "to avoid breaking functionality" — a stale value standing in for a dead server, indistinguishable on screen from a live one. A7. The two kept caches answer only from a fresh entry and never on the error path. | `api.js:1486-1492,:1566-1572`; `rea-cache.js` header. |

## Dead code — zero call sites

| Not built | Why | Citation |
|---|---|---|
| `signalHeartbeat` | A **real** route (`POST /api/v1/machine/heartbeat`), imported by `settings.js:1`, and never called — so ReaPrime's presence controller has never known this client exists while the skin renders a whole presence settings pane. Excluded from the transport core deliberately: whoever builds the presence pane adds the call **and its caller** in one change, so the pane and the heartbeat cannot ship apart again. | `api.js:2145`; `settings.js:1`; `presence_handler.dart` `POST /api/v1/machine/heartbeat`. |
| The 15 beans/grinders CRUD wrappers | Zero call sites. The **routes** are real and a future beans or grinders screen will use them through the generated client; what is excluded is porting fifteen hand-written wrappers that nothing calls. | `api.js:1753-1866`; `beans_handler.dart`, `grinders_handler.dart`. |
| `connectProfileGeneratedWebSocket` | An entire 34-line WebSocket connector nobody opens. | `api.js:470`. |
| `getEstimatorLink`, `getDisplayWebSocket`, `getUpdateWebSocket`, `uploadMachineProfile`, `getDisplayState` | Five more zero-call-site exports, verified by grep across `src/` and `test/`. | `api.js:240,:727,:805,:1867,:1993`. |
| `resyncIfDrifted` and four of its five `LAST_VALUE` keys | It compensates for something ReaPrime already does: `_setDe1DefaultsFor` re-applies the stored settings on connect, which is the exact premise ("a BLE reconnect or Rea restart leaves the DE1 stale") the function was written for. **The brightness key survives as a note, not as code**: ReaPrime persists no brightness, so that one value genuinely has nowhere else to live, and it belongs to whoever builds the display/brightness policy — not to the transport. | `api.js:1196-1230`; `de1_controller.dart` `_setDe1DefaultsFor`. |

## UI and control flow that do not belong in a transport

| Not built | Why | Citation |
|---|---|---|
| `import * as ui from './ui.js'` | `ui.js:1` imports twenty names back — a cycle. The transport painted the machine-status label itself and raised toasts from inside upload failures. Nothing in `src/data/` imports from `src/components/`, `src/screens/` or `src/stores/`, and a test asserts it. | `api.js:1,:273,:320,:330,:849,:962`. |
| The three `alert()`s inside `isValidProfile` | A transport module does not open a modal, and validation is the server's answer, not a guess made before sending. | `api.js:1049,:1057,:1065`. |
| The five catch blocks that **manufacture an answer** | `getReaSettings` → `null`, `getPlugins` → `null`, `getPluginSettings` → `{}`, `verifyVisualizerCredentials` → `false`, `getScaleDeviceId` → `null`. The fourth is the clearest: an unreachable server becomes indistinguishable from a wrong password. A7, and the reason failures here are returned as typed data. | `api.js:1306,:1905,:1924,:1989,:621`; `rea-errors.js` header. |
| `connectScaleDevice`'s catch block | `return response.json()` where `response` is `const`-scoped to the `try` — a `ReferenceError` sitting inside an error path, which is to say the error path has never once run to completion. | `api.js:152-155`. |
| The 6 s `onclose` reload timer, and three `onreconnect = null` assignments | The timer's `location.reload()` is commented out, so it fires on every disconnect to log "reloading now". `onreconnect` is not a property the socket wrapper defines — the three assignments read as lifecycle management and are no-ops. | `api.js:321-325,:333,:381,:575`; `reconnecting-websocket.js` (defines `onopen`/`onclose`/`onconnecting`/`onmessage`/`onerror` only). |
| The two hand-rolled retry timers | Retry is a policy, and the one place it belongs is the reconnecting socket (A11), which encodes it correctly and was patched on the bench for exactly this. Nothing in the REST path retries. | `scope/e2-api.md` DROP breakdown, 274 defensive lines. |

## Excluded because the work is elsewhere

| Not built | Why | Citation |
|---|---|---|
| `socket-slot.js` and `machine-link.js` | Their founding premise — that ReaPrime bound machine sockets to a De1 *instance* and never re-bound them on swap — was fixed in ReaPrime `31ea7c1a`: `_withDe1Ws` detaches and re-attaches every machine-bound socket when the instance changes. Neither module ports. Recorded here as well as in its own item, because "the socket layer got simpler" is exactly the kind of change a later wave re-complicates. | SCOPE Part 3 §1 "Socket lifecycle is now mostly ReaPrime's problem"; `de1handler.dart` `_withDe1Ws`; ITEMS.json `gate3-drop-socket-slot-machine-link`. |
| Reset-to-default, in any form — including `DELETE /api/v1/machine/settings/reset` | **F3/Q1: no work of any kind.** The semantics are blocked on Ben. The route exists in the handler and is not called from this wave. `createDe1SettingsClient(...).invalidate()` is public so that whoever builds it has the correct cache hook and does not invent a second one. | ITEMS.json constraints; `UPSTREAM_WORK.md` F3; `de1handler.dart` `DELETE /api/v1/machine/settings/reset`. |
| A local recomputation behind any missing server field | A missing field goes through the one R-tagged adapter module, one named adapter per R-number, so the swap is mechanical when upstream lands. Never a skin-side workaround. | DECISIONS.md "Upstream work stays out of the overnight run"; ITEMS.json `r-tagged-adapter-module`. |
