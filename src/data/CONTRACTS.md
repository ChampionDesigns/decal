# The contract table

`CONTRACTS.json` is the required record, enforced by
`gate-d`: **every endpoint this skin adopts carries its path, its verb, its request body,
its response shape, the handler symbol, the handler file and the ReaPrime commit it was
checked at.**

The rule it serves is that contract checking is a **build** activity, not an audit
activity. The check happens as the call is written, with the handler open
in the next pane. The justification is empirical: **all 31 live contract bugs were found
exactly this way**, and none of them was findable at runtime — the catches swallow, the
logs are debug-level, and the fallbacks return plausible values. A bug that cannot be seen
on the bench can only be caught at the desk, at the moment the call is written.

**The handler body is the authority.** Not `rest_v1.yml`, not the old
skin's JSDoc — which asserts, for one example, that the cup warmer has "no separate enable
field" while the handler serves and validates one. Where the document and the handler disagree
the handler wins; three such disagreements are carried as named exceptions in
`rea-routes.generated.js` and are going upstream.

**A passing desk check is necessary, not sufficient.** The LED strip is the standing
caution: static analysis was wrong in *both* directions across two passes, and the
one-sentence symptom report located the real defect — a trailing-edge debounce — in
minutes. Check the contract as it is written; then watch the feature do the thing on the
bench.

---

## Where it lives, and what else reads it

The table is `src/data/CONTRACTS.json`, beside the client it gates.

**The capture mock reads this same table** (the checks rule 4). The handover this section once
deferred to the `mock-fixtures-contract-check` item was taken by it: `tools/
check_mock_contract.py` checks `tools/rea-fixtures/` against these rows, the provisional
fixture-derived mock table and `mock_rea.contract_table_path()`'s
three-deep candidate chain are deleted, and the "more than half of these rows have no
fixture" problem is answered by direction rather than by overlap: a row without a fixture
is a note, a FIXTURE without a row is a failure. Routes the mock has a recording for that
this table does not carry — eleven of them, none addressed by the client — live in
`tools/mock-fixture-ledger.json` in these same columns, so any of them can move here
verbatim the day a screen adopts it.

`gate-d` checks the CLIENT against the table; the mock checker checks the INSTRUMENT
against it. Two fixtures failed that check on its first run and are not served at all —
see the mock-contract mismatch record.

## The columns

| column | what it is |
|---|---|
| `id` | the generated table's route id. `gate-d` asserts every id agrees with `rea-routes.generated.js` on verb and path — two tables about one server must agree. |
| `path` / `route` | documented form (`/api/v1/shots/{id}`) and transport-relative form (`/shots/<id>`). |
| `verb` | as registered in the handler. |
| `requestFields` | `{query, body, path}` — what the handler **reads**, not what the document declares. `$`-prefixed keys are notes about the body as a whole. |
| `responseShape` | every status the handler can produce, with the body shape for each. |
| `handlerSymbol` / `handlerFile` | where it was read. `gate-d` re-checks that the file exists at the pin, registers that path, and contains that symbol. |
| `checkedCommit` | the ReaPrime commit checked against. `gate-d` fails the build when it is not the pin. |
| `status` | `consumed` / `declared` / `recorded` — see below. |
| `gates` | handler-body gates: "registered but conditionally unavailable", clamps, encodings, refusals. Each has a `kind`, what the handler does, and what a caller must therefore do. |
| `retires` | the contract bugs (CB-nn) this row's truth retires. |

## Which routes get a row

A row exists for exactly one of three reasons, and says which:

* **`consumed`** — a caller exists in `src/` today. `consumedBy` names it.
* **`declared`** — the client states something about the route without calling it: the
 conditional-ETag registry, the cache register, the socket table. A claim about a route is
 still a claim, so it is still a row.
* **`recorded`** — no caller. The row exists because a **handler-body gate** or a **retired
 contract bug** attaches to it, and a test asserts something about it. `postFeedback` is
 the clearest case: the gate has to exist *before* the first feedback screen, because the
 screen is the thing that must hide itself.

A row is never added because a route might be useful. Inventing surface is how a table
stops being evidence — the same reason the client's helper surface is demand-driven while
its route table is complete.

## The handler-body gates worth reading before writing any screen

| route | gate |
|---|---|
| `POST /feedback` | **503 = the feature is absent.** The first thing the handler does is check for a build-time GitHub token. The route is registered, so a reachability check that asks only "does the route exist" says yes and the form ships dead. Hide the form. |
| `POST /machine/profile` | **400 `Unsupported profile` is the machine refusing.** `setProfile` is called outside `runDeviceWrite` specifically so the refusal is a clean 400 rather than the catch-all 500. the refusal rule: send the profile, surface the message; never pre-strip a step to dodge it. |
| `GET /shots` | **The limit is clamped 1–100 for the query and echoed UNCLAMPED in the body.** Ask for 200, receive 100, read `limit: 200`. Even the echo hides it. |
| `GET /shots` | **`{items, total, limit, offset}`** — never `{shots}`. |
| cup warmer, pre-heat, LED strip, scale calibration | **404 = the feature is absent** (`_bengleFirmwareGate`). Not "route missing", not an error to show. |
| `PUT /machine/cupWarmer` | **A temperature without `enabled` turns the warmer ON.** Off is `{enabled:false}`, never `{temperature:0}`. |
| `PUT /presence/schedules/<id>` | **Absence means unchanged.** `keepAwakeFor` clears only when the key is PRESENT carrying 0 or null. |
| `GET /store/<ns>/<key>` | **A missing key is 200-with-null.** This handler has no 404 path at all. |
| `POST /machine/firmware` | **NDJSON progress stream**, not a JSON document. `response.json()` turns a successful flash into a reported failure. |
| `GET /shots/latest` | **200 carrying `null`** when nothing has ever been stored. That null is the answer (). |

## `gate-d`

```
node scripts/gate-d.js # human output, exit 1 on any violation
node scripts/gate-d.js --json # machine-readable, for the wave GATE agent
node scripts/gate-d.js --no-source # skip the worktree half, and say so
npm run gate-d
```

| half | rule |
|---|---|
| **coverage** | a route string, or a route id, in the client with no table row fails the build. Plus the third scan a literal enumeration cannot do: a path assembled from fragments fails unless its file is declared in `constructedRouteBuilders` naming the rows it builds. |
| **staleness** | a row whose `checkedCommit` is not the pinned ReaPrime commit fails the build. ReaPrime is *expected* to move under this build, so drift is a certainty, not a risk — the stamp turns "did anyone re-check?" into a diff. |
| **source** | the worktree's `git rev-parse HEAD` **is** the pin, and every row's handler file still exists there, still registers that path, still contains that symbol. Required by default; a missing worktree, an unresolvable one, or one at another commit is a failure, not a silent skip — and a tree that is not the pin re-verifies **no** row, because a row "confirmed" against the wrong commit is worse than one nobody checked. |
| **retirement** | the spelling of a retired contract bug (`response.shots`, `scale/calibrate`, `prewarmEnabled`, …) appears nowhere in the client's code. |
| **integrity / agreement** | the table is well formed, and every id agrees with the generated route table on verb and path. |

Canaries live in `test/fixtures/gate-d/` — one fixture per rule, plus a control that
*discusses* an untabled route and a retired spelling in prose and must not trip anything.
`test/gate-d.test.mjs` asserts each check fails on its canary and passes on the control.

**The one declaration this gate trusts over an enumeration** is
`constructedRouteBuilders`: four files whose paths are assembled rather than written. Each
names the rows it builds, each is checked to exist, and an undeclared file that constructs a
path fails. It is written down here rather than hidden because an exemption nobody can see
is how coverage dies.

## The pin

`scripts/lib/rea-source.js` `PINNED_COMMIT` is the only place the commit is written.
`CONTRACTS.json`'s `pinnedCommit` and every row's `checkedCommit` are checked against it,
and `test/gate-d.test.mjs` asserts `gate-d.js` carries no 40-character hex of its own.

Those are all strings in this repo, and three strings agreeing with each other say nothing
about the tree the handlers were read from — `REA_ROOT` is an environment variable. So the
source half resolves that tree's HEAD with `git rev-parse` and requires it to equal the pin,
and every run prints `worktree <path> at <commit>`: the commit is a fact on the record, not
an assumption. (Before that check existed, a run against a different ReaPrime checkout
re-verified 46 of 50 rows against the wrong commit and reported only the four route strings
that happened to differ.)

## When ReaPrime moves

1. Re-pin `scripts/lib/rea-source.js`, and move the reference worktree to the new commit —
 `gate-d` reads the worktree's HEAD, so a re-pin without a checkout fails the gate outright
 rather than re-checking rows against the old tree.
2. Regenerate `rea-routes.generated.js` (`node scripts/generate-rea-routes.js`).
3. `gate-d` now fails on **every** row. That is the point: re-open each handler, re-check
 path, verb, body and response, and stamp the row. A row you did not re-read does not get
 the new stamp.
4. Where the re-check finds the **server** wrong, the fix goes upstream on a clean
 upstream-cut branch — never worked around in the skin. The four ReaPrime-side
 contract bugs are listed in `reaPrimeSide` and swept in
 the contract bug sweep.
