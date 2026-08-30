# The generated route layer

Gate 3's answer to the 872 lines of `api.js` that were nothing but a path, a verb and a
`fetch` (E2's count, `scope/e2-api.md`). Addressing is not knowledge worth hand-copying —
it is knowledge worth deriving, because a copy has no way to notice when the fact moves.

| file | what it is |
|---|---|
| `rea-routes.generated.js` | **generated** — the complete documented surface: 143 REST rows over 101 paths, 13 socket channels. Do not edit. |
| `rea-routes.js` | hand-written — lookup, spelling, and the five call helpers this wave's stores actually call (each row names its consumer file, and a test reads that file for the call). Everything else in the table is reached with `callRoute`. |
| `../../scripts/generate-rea-routes.js` | the generator, with the named exceptions. |
| `../../scripts/lib/yaml-subset.js` | the YAML reader it stands on — a refusing subset, no npm. |
| `../../scripts/lib/rea-source.js` | one pin: `REA_ROOT`, `PINNED_COMMIT`, `resolveReaCommit`. |

Regenerate with `node scripts/generate-rea-routes.js`; `--check` fails on a stale artifact
and `test/rea-routes-freshness.test.mjs` runs that check.

## The split: complete table, demand-driven helpers

**The table is complete.** Every path and verb in `assets/api/rest_v1.yml`, every channel in
`assets/api/websocket_v1.yml`. That is what makes it evidence: a route that is missing is a
route ReaPrime does not document, and Gate D's coverage half can say so mechanically
(`findRoute` / `isDocumentedRoute`).

**The helper surface is not.** Exported call helpers exist only where a store in this wave
CALLS one, and `HELPER_DEMAND` names both the item and the consumer FILE for each. Five
helpers over 143 rows. The old skin had the opposite policy and paid for it: six exported
wrappers with zero call sites, a 34-line socket connector nobody opens, and two wrappers for
endpoints that exist nowhere in ReaPrime. A wrapper with no caller is not "ready" — it is
unverified surface that reads like a promise.

That rule needed a guard, and for one pass it did not have one: the test asserted only that
the exported set equalled `HELPER_DEMAND`, so a table row was enough to make a helper look
wanted. Five of the ten helpers had zero consumers, and two of them — `sensors` and
`connectDevice` — were bypassed by the very modules named as their demand, which spelled
their own paths instead. The five are retired (`RETIRED_HELPERS` records where each went),
the two cluster modules read their paths out of the generated table, and
`test/rea-routes.test.mjs` now opens each consumer file and requires the call.

Anything outside the demand list is reached with `callRoute(transport, id, …)`, which takes
its spelling from the same table. Adding a caller never means adding addressing.

| helper | route | asked for by | consumer |
|---|---|---|---|
| `capabilities` | `GET /machine/capabilities` | gate4-capabilities-store | `src/stores/capabilities-store.js` |
| `cupWarmer` / `setCupWarmer` | `GET` / `PUT /machine/cupWarmer` | gate4-cupwarmer-store | `src/stores/cup-warmer.js` |
| `cupWarmerPreheat` / `setCupWarmerPreheat` | `GET` / `PUT /machine/cupWarmer/preheat` | gate4-cupwarmer-store | `src/stores/cup-warmer.js` |

Retired for want of a caller, each reachable by id through `callRoute`: `sensors`,
`connectDevice`, `shots`, `latestShot`, `shot`.

## Three rows do not match the spec, deliberately

The handler body is the authority — not `rest_v1.yml`, not `doc/Api.md`, not the old skin's
JSDoc. Where they disagree at `2b047d02`, the generator applies a **named exception** and
the table states the handler's truth. Each exception carries its handler evidence, and each
**hard-fails the generator the moment the spec is fixed**, so it deletes itself instead of
rotting. All three are upstream asks; none is worked around at a call site.

| exception | spec says | handler does | evidence |
|---|---|---|---|
| `shots-orderBy-not-read` | `GET /shots` takes `orderBy` | reads `order` only; `orderBy` occurs in no handler | `shots_handler.dart` `_getShots` ~:73, ~:89 |
| `plugins-passthrough-any-method` | `/plugins/{id}/{endpoint}` is GET-only | `app.all`, dispatching on `req.method`, body forwarded verbatim | `plugins_handler.dart:90`, `:184` |
| `sensors-list-key-is-id` | list items are `{name, info}` | emits `{'id': s.deviceId, 'info': …}` | `sensors_handler.dart`, inline `GET /api/v1/sensors` |

The first two are E2's two upstream asks. **The third was found by this wave's own contract
check** — which is the argument for contract checking being a build activity rather than an
audit activity. Sensor discovery derives the estimator's id from that list; a client
generated faithfully would have read `undefined` and reported "no estimator" on a machine
that has one.

POST is added to the plugin passthrough because POST is what is demonstrably used. PUT and
DELETE are not added: `app.all` would accept them, but nothing asks for them, and inventing
surface is how a table stops being evidence. The rows carry `anyMethod: true`, which records
the whole truth without emitting speculative rows.

## Reading a row

`path` is as documented (`/api/v1/shots/{id}`). `route` is what the transport takes —
relative to `/api/v1`, in ReaPrime's own `<param>` syntax, so it matches the strings already
used in `rea-conditional.js`.

`successMedia` and `json` are what the spec **documents**. A null there means the response
content is undocumented, not a promise that no body arrives: `PUT /machine/cupWarmer`
documents "200 Accepted" and the handler returns `{"status":"accepted"}`.

Two absences are real answers and are passed through as such (A7 — never port a fallback):
`GET /shots/latest` answers 200 with a body of `null` when no shot has ever been stored, and
`buildQuery` throws rather than dropping a query key the table does not declare. Sending
`orderBy` produced exactly nothing and looked like a working sort; here it is an error.

## Checked, not assumed

* The six routes with a documented `304` are exactly the six `jsonOkConditional` routes
  `rea-conditional.js` derives from the handlers. Two independent derivations, asserted
  equal.
* Eight documented operations have no exact `app.<verb>` registration because they are
  served by a parameterised one — `PUT /api/v1/scale/<command>` switches on `tare`,
  `/scale/timer/<command>` on `start|stop|reset`, and skin-assets and the support proxy use
  catch-all path patterns. Pinned in the test, so a change upstream says so.
* **Neither spec is the authority on machine state.** `rest_v1.yml` lists 20 states,
  `websocket_v1.yml` lists 16, they disagree with each other (`steamRinse` vs
  `transportMode`), and neither has `schedIdle` — which `machine.dart` does. That is why the
  enum is generated from the Dart and why the generator **refuses** a `$ref` query parameter
  rather than resolving a component into the table.

## Handoffs

* **Gate D's contract table.** These rows carry path, verb, request body fields and response
  shape. What they do not carry is the handler symbol, the handler file and the checked
  commit — those are the contract table's own columns, and the exception rows already carry
  them for the three routes that needed them. `tools/mock_rea.check_contract` prefers
  `src/data/rea-contract.json` the moment it exists, and `tools/mock-contract.json` (24
  routes, provisional, derived from fixtures) is deletable once it does.
* **`rea-ws-channels.js`** (the connectors builder) hand-writes the ten channels it opens,
  with the message classification the sockets need — knowledge this table does not carry.
  Its ten addresses are a subset of the 13 generated here, and the two should be checked
  against each other in one place rather than diverging.
* **`rea-kv-backend.js`** builds its own URLs rather than going through the transport; the
  KV list route is one of the six conditional ones. Converging it is a win it does not
  currently ask for.
