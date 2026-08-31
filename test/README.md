# test/

`node:test` suites. **Executing tests only** - the text-scanning style is dead by
decision. The current suite's 29 text-scanning files, 4,519 lines that never
import the code they describe, do not come across.

DOM-free `src/lib/` modules test without a browser. Component rendering tests mount
the component and assert on COMPUTED styles and behaviour; their harness is headless
Chrome over CDP, fixed before the first component test is written.
The harness's standard geometry is the bench truth: 1281x801 @ deviceScaleFactor 1.5,
plus the 1000x600 floor.

Run everything with `node --test test/`.

## harness/

`harness/` is the rendering rig itself - headless Chrome over CDP, an ephemeral debug
port and a fresh user-data-dir per invocation so concurrent builders never collide,
and the four standing assertions (the token drill, one selection treatment, scroll
floors and stated overflow, focus geometry unclipped). **Read `harness/README.md`
before writing a rendering test.** `harness-selftest.test.mjs` proves the parallel
safety by running two instances at once.

## render/

Rendering suites live in `render/`, named `<subject>.render.test.mjs`. They are
ordinary `node:test` files that drive the harness, so `node --test` runs them with
everything else.

## The CSS guards

`guards.test.mjs` is their canary suite - it asserts each build guard FAILS on its
canary and PASSES on a clean component. `authored-css.test.mjs` tests the scanner
underneath it. The guards themselves live in `scripts/`.

## fixtures/

`fixtures/` holds the rendering subjects the CDP rig mounts, and
`fixtures/canaries/` the files that violate a rule on purpose so each guard
can be tested against a real violation. `fixtures/guard-clean/` holds the opposite:
a component that violates nothing, using every shape most likely to trip a careless
scanner - because a guard that fires on everything gets switched off just as fast as
one that fires on nothing. Neither directory contains a `node:test` suite.

`fixtures/dead-names/` is the same pair for the dead-name scan
(`rea-dead-names.test.mjs`): `reads-dead-name.js` reads names ReaPrime deleted, behind a
fallback that manufactures a plausible number — the exact shape the previous skin shipped — and
must FAIL the scan; `clean-control.js` names every one of them in prose and must PASS,
because a comment-blind scanner earns an exemption and an exemption is how coverage dies.

`fixtures/excluded-surface/` is the same pair for the dead-surface scan
(`rea-excluded.test.mjs`): `ports-excluded.js` ports three things `src/data/EXCLUDED.md`
says are not built - a heartbeat nobody called, an LED-preview route that has never
existed, and the `orderBy` parameter no handler reads - and must FAIL; `clean-control.js`
names every excluded symbol in prose and must PASS.

## Generated artifacts

Every committed generated file has a suite that regenerates it and fails on a diff:
`machine-state-freshness.test.mjs` for the enum, `rea-routes-freshness.test.mjs`
for the route table. Both also re-derive the headline facts from the source independently,
so byte-equality alone cannot pass a generator and an artifact that are wrong together.
`yaml-subset.test.mjs` tests the parser the route generator stands on, in both directions:
the supported subset parses correctly, and everything outside it throws.
`rea-routes.test.mjs` is where the generated table is checked against the Dart handlers it
claims to describe — including the three rows that contradict `rest_v1.yml` on purpose.

**Every browser-only file under `test/` must use the node-safe shape** -
`if (typeof HTMLElement !== 'undefined') { … }` with dynamic imports - because Node's
test runner treats every `.js` file under a directory called `test/` as a test file
and Node 20 has no `--test-exclude`. Without it, `node --test test/` reports a failing
"test" for each fixture. `fixtures/canaries/README.md` has the detail. (The
`harness/` modules need no wrapper: they are node modules with no import-time side
effects, and run as zero-test files.)

<!-- gate-d -->
## The contract table

`gate-d.test.mjs` covers the contract table three ways: the canaries in
`fixtures/gate-d/` fire (one per check), the control passes (it names an untabled route and
a retired spelling **in prose**, and nothing may trip on that), and every handler-body gate
in `src/data/CONTRACTS.json` is re-read against the ReaPrime Dart at the pinned commit —
the feedback 503, the arm-time refusal, the `/shots` clamp and its lying echo, the four-route
404 feature gate, the keep-awake clearing rule, the KV null-not-404 answer and the NDJSON
firmware stream. The two ReaPrime-side bugs with an executable signature (a cast before
the `try`, and `entries.first`) are re-proved rather than cited.

<!-- gate4-core-tests -->
## The store layer — stores, shot buffer, time axis

`store.test.mjs`, `feed-store.test.mjs`, `feed-readers.test.mjs`, `shot-buffer.test.mjs`,
`time-axis.test.mjs`, `live-stores.test.mjs`. Three kinds of test live here:

* **Mechanism** — replay, isolation of a throwing subscriber, and the pattern-F guard
  (`set()` handed the object it already holds throws). `store.test.mjs` also scans the tree:
  no module-scope `let`/`var` anywhere in `src/`, no `document.`/`window.`/`localStorage`/
  `fetch(` under `src/stores/`, and — pattern A — no scheduling call under `src/stores/`
  except the ONE declared in the suite, `shot-mirror.js`'s injected `setTimer` default.
  That declaration replaced a hole: the list used to name `setInterval(` alone and assert
  "starts no timers" while `shot-mirror.js` scheduled with `setTimeout` a directory away
  from anything that could see it. Both directions are now checked — an undeclared
  scheduling call fails, and a declaration whose source line has gone also fails, so the
  allowlist cannot rot. `shot-mirror.test.mjs` carries the other half, proving `setTimer`
  is a real injection seam rather than an exemption with a comment on it.
* **Absence** — most of `feed-store.test.mjs` asserts what does NOT happen: a closed source
  does not erase the value, an error envelope is not folded into it, `unavailable` is not
  "old", a malformed message is not a frame, and no channel is ever recomputed locally.
* **Evidence at the pin** — `feed-readers.test.mjs` re-derives `ShotState`,
  `ShotDecisionKind`, `ShotDecisionReason`, `AppUpdatePhase` and every `toJson` key from the
  Dart at `2b047d02`, plus the three premises the shot buffer stands on (idle is not
  published from the state stream; an idle frame IS published at cleanup with no `shotId`;
  the socket is seeded so a late subscriber learns the current shot). `time-axis.test.mjs`
  pins the justification: both parsers stamp `DateTime.now()`, and `sampleTime` is decoded
  off the Bengle wire and dropped — the field R4 asks for. When R4 lands, that test goes red
  and the rule is revisited rather than quietly outlived.
