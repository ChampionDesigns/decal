# tools/

Measurement rigs and scaffolding, not shipped app code — but they ship with the
template, because the enforcement tooling is a deliverable of the open-source
decision, not an extra.

```
gallery/                the component gallery: subjects for a human and for the battery
screens/                the SCREEN walk: one app screen state per navigation, no chrome
capture_battery.py      Gate B — one PNG per state, per theme, per geometry
probe_provenance.py     the provenance + token-adoption probe
mock_rea.py             offline ReaPrime, fixture parity, refusals, table-driven writes
ws_frames.py            the ten /ws/v1 channels — what mock_rea serves over a socket
WS_FRAMES.md            where every socket frame's values come from (the derivation table)
rea-fixtures/           33 recorded ReaPrime responses, copied never edited
FIXTURES.sha256         their hashes — fixture parity is a review precondition
check_mock_contract.py  Gate B rule 4 — the mock's frames vs src/data/CONTRACTS.json
mock-fixture-ledger.json  every frame the table does not vouch for, with handler evidence
shadow_walk.py          the three shadow-DOM adaptations, in one place
geometry.py             the capture matrix, PARSED from test/harness/geometry.js
cdp.py                  Chrome + CDP plumbing for the two instruments
selfcheck.py            the preconditions, as a command
```

## gallery/

A plain page that mounts components in their states. Scaffolding: Waves 1–4 add
entries to `gallery/entries.js` and nothing else changes. It is what a human looks at
and what the capture battery photographs — `window.__gallery.states()` / `show(id)` /
`document.body.dataset.gallerySettled`, or just
`index.html?state=<id>&theme=<light|dark>`. See `gallery/README.md`.

## screens/

The same idea for a SCREEN, and a separate page because a screen cannot be
photographed inside the gallery's stage: the gallery frames its subject with 260px of
nav, and the whole question a Live capture answers is what the rows do at 1000×600.
`screens/index.html` has no chrome at all — one full-viewport mount host — and drives
the SUITES' OWN fixtures (`test/fixtures/live-gates-fixture.js`,
`test/fixtures/live-loop-fixture.js`) rather than a second driver written for
capturing. `window.__screens.states()` / `show(id)` /
`document.body.dataset.screensSettled`, or
`index.html?state=<id>&theme=<light|dark>&mock=<port>`.

The `mock` port is not optional and not ambient: a state names which scripted mock it
needs (`park` — ReaPrime holding a device-selection session open — or `shot`, the
recorded run at 15 Hz), and `capture_battery.py --subjects app` starts one `mock_rea.py`
per script and passes the port in. One process holds one socket script, which is why
there are two.

## The capture battery (Gate B)

```bash
python3 tools/selfcheck.py                       # preconditions; run this first
python3 tools/capture_battery.py --out-dir /tmp/shots
python3 tools/probe_provenance.py --out-dir /tmp/prov --theme dark
```

Ported from the current review tooling (`review/tools/capture_battery.py`,
`review/tools/mock_rea.py`) and the audit's `probe_provenance.py`, with **Gate B's
four changes and §13's three shadow-DOM adaptations — different lists, overlapping
only on the residue rule**:

| | change / adaptation | where it lives |
|---|---|---|
| B1 / §13-3 | the canvas-pinning hack dies; residue is itself a finding | `selfcheck.py`, canary in `test/fixtures/canaries/` |
| B2 | the geometry matrix: bench 1281×801 @ dsf 1.5, desktop 1920×1200, floor 1000×600 | `geometry.py`, parsed from Gate A's `geometry.js` |
| B3 | the first baseline is a REVIEW, not a diff | every set written `provisional`; `REVIEW.md`; no diffing code exists |
| B4 | the mock is contract-checked | `check_mock_contract.py` + `mock-fixture-ledger.json`, `FIXTURES.sha256`; canaries in `test/fixtures/mock-contract/` |
| §13-1 | the walk pierces shadow roots and records anchor paths | `shadow_walk.WALK_JS` |
| §13-2 | constructed stylesheets named by owning component tag | `shadow_walk.label_sheet` |

### Sequential by design

These two instruments hold **fixed ports** (battery 8808/9348, probe 8842/9382, mock
8080) — "sequential by design (the probes share fixed ports)", SCOPE Part 8 §2. The
Gate A harness in `test/harness/` is the opposite and deliberately so: ephemeral
debug port, fresh user-data-dir, because sixteen builders run their suites at once.

Fixed ports have a failure mode that bit on the very first run here: if a stale
browser already holds the debug port, the new Chrome fails to bind, the port still
answers, and a naive launcher **drives the stranger's tab**. It happened — the first
probe run photographed a Slate page left open by an earlier audit run. `cdp.py` now
proves the browser is its own before speaking a byte of CDP, and says so loudly when
it is not. `--cdp-port` / `--app-port` exist for the one-off case where a stale
browser is squatting and killing it is not yours to do.

### The record shape, and the corpus it is compared against

`probe_provenance.py` writes exactly the **record** shape the audit corpus
(`slate-audit-2026-08-16/prov-baseline/`, `prov-light/`) holds — the same 13 keys,
the same 18-property appearance surface, the same `prov` row (`v`, `imp`, `sheet`,
`sel`) — **plus two**: `anchor` (the anchor path, which the comparison uses as
identity) and `hosts` (the shadow-host chain it was built from, which is how a
constructed sheet finds its owning tag). Nothing is removed and nothing is renamed;
the corpus is the oracle and a reshaped record would silently invalidate it.

**The PNGs are the one declared departure.** The audit's probe shot its base/perturbed
pairs at `scale: 0.5` — `prov-baseline/*.png` are 960×600 — while Slate's own battery
already shot at 1. Both instruments here shoot at 1 (`cdp.SHOT_SCALE`), so the probe's
PNGs are double the audit's raster. Nothing pixel-diffs the two corpora (they
photograph different applications, and the comparison anchors on the records), it
makes the battery's and the probe's PNG for the same state byte-identical as a free
cross-check that the two rigs drive the same page, and half-scale discards exactly the
hairline detail Gate E is about. `RUN.json` records `raster.shotScale` and the
manifest records `shotScale`, so no corpus has to be measured to find out. One number
reverses it.

**Theme parity**: dark captures compare against `prov-baseline/`, light against
`prov-light/`, never crossed. `RUN.json` states which, per run.

**Preconditions abort, they do not annotate.** Fixture parity and the mock's contract
check run before the first shot in BOTH instruments and raise. The probe used to
measure parity and shoot anyway, writing `"parity": false` into `RUN.json` after the
poisoned corpus was already on disk; `--allow-fixture-drift` is the one legitimate
override and says so in the output.

### The perturbation is derived, not listed

The audit's probe hard-coded ~90 `--slate-*` overrides. This one reads
`styles/tokens.css` and `styles/chart-channels.css` and perturbs every `--ui-*` token
it parses **except the deliberate exclusions**: 129 of 143 today, with 13 excluded as
`var()`/`calc()`-derived (they move on their own) and 1 as motion (outside the 18
properties). A token added next week is covered the first time the probe runs — which
is what keeps the token-adoption measurement honest a year from now. A component whose
colour or type property stays **frozen** under it is a theming hole; structural
geometry that no token drives is legitimately frozen, and the numbers say which is
which.

**A token the derivation cannot perturb is a hole, and is now reported.** It used to
fall out through a bare `continue`, and four did: `--ui-elev-1/2/3` (multi-value
shadow bodies the name test never matched, so `box-shadow` — one of the 18 measured
properties — would have read FROZEN for every component using elevation) and
`--ui-tint-lever` (its declaration was shadowed by a prose mention in a comment, so
the lever channel colour was absent from the perturbation entirely). Comments are
stripped before the scan, the shadow family is matched by name, and
`build_perturb_js()` returns a report: `selfcheck.py` FAILS on any remaining skip, the
probe refuses to shoot, and `RUN.json` carries the whole thing under `perturbation`.

### What the battery cannot see

* **Interactivity.** The uPlot mount-C result was a pixel-identical screenshot of a
  chart that was completely dead to input. Gate A's behaviour assertions own that.
* **The tablet's raster.** Gate E's bench run owns that.
* **States nobody walked.** Every manifest carries the unwalked states in
  `unverified` — the app screens Decal has not built yet (the profile editor and
  settings; the LIVE screen is walked by `--subjects app`, six states over
  `screens/`), and the states the old corpus never reached (steam mode, a rendered GHC
  strip, the DYE2 paths; SCOPE M16). On every run, not only on the app path: a
  manifest that holds captures and an empty `unverified` reads as coverage. Silence is
  not coverage — and neither is a manifest whose unwalked list names a screen the tree
  already ships, which is what `--subjects app` wrote until wave 5.1 wired it (cross-3).

## Fixtures

`rea-fixtures/` is a byte-for-byte copy of `review/tools/rea-fixtures/` — recorded
real ReaPrime responses, never edited here. Two things about the set are worth
knowing before trusting a capture:

* **Nine of the 33 are HTML 404 bodies**, not JSON: `ws__*.json` are what a WebSocket
  endpoint returns when it is probed over HTTP. They are hashed (they are part of the
  recorded set) and declared in the ledger, and the mock now serves them as what they
  are — 404 `text/html`, not 200 `application/json`.
* **The `store` fixtures carry the OLD storage prefix** — `/api/v1/store/slate/...`.
  Decal's prefix is `decal.` (A10, keys renamed, nothing migrates), so those
  paths will miss and the mock answers 503 with an explicit body. That is a
  fixture-set gap, not a client bug; re-record against a machine running Decal when
  there is one.
* **One is refuted by the handler at the pin and is NOT served.**
  `machine/cupWarmer` still carries the `prewarm*` keys CB-18/CB-19 retired, and no
  truer recording of it exists — Slate's committed blob has the same bytes (md5
  `4881ad9e…`), so only the bench can fix it. It is not edited — a fixture edited to
  pass a check has stopped being a recording — and it is not served: the mock answers
  that route 410 with the evidence, so a screen built on it shows its absent state
  instead of a plausible lie. Full write-up:
  `_skinlab/realine-run/waves/0b/mock-contract-mismatches.md`.
* **Two more were refuted and have been REPLACED, not edited.** `shots/latest` carried
  426 `measurements` (`_getLatestShot` serves `toJsonWithoutMeasurements`) and the shots
  list carried 21 items for `limit=20` (a SQL `LIMIT` cannot). Both were Slate's
  UNCOMMITTED working-tree edits, copied here in wave 0a; the committed blobs at Slate
  `5705362` are recordings of those routes and are what the set now holds. The swap is
  recorded in the ledger's `resolved` section with the `git show` that reproduces each
  byte for byte, because it moved `FIXTURES.sha256`.

### The contract check (Gate B rule 4)

```bash
npm run mock-contract                              # or python3 tools/check_mock_contract.py
python3 tools/check_mock_contract.py --json        # for the wave GATE agent
```

Every frame the mock can serve is checked against `src/data/CONTRACTS.json` — the SAME
table Gate D holds the client to, whose rows are read off the ReaPrime handler body at
the pinned commit. **One table, no candidate chain**: the provisional fixture-derived
`mock-contract.json` and its generator are deleted, along with `contract_table_path()`'s
three-deep fallback, because an instrument that falls back to another reference passes
against whichever reference still exists (A7).

What it checks: response kind and keys per row (`?` marks a key the handler writes
conditionally), three handler-derived invariants a key check cannot see, retired
contract-bug spellings **inside served frames** (Gate D scans the client; nothing
scanned the frames the client is developed against), the mock's synthesized answers to
mutating verbs, and — by starting the mock and making the requests — that a refused
recording really is refused **and that a query with no recording is a MISS**. That last
rule (`query-fallback`) closes a hole in the ones above it: they derive each request
from the query in the fixture's own name, so the shots list was only ever asked at
`limit=20` while `_resolve`'s deleted endpoint fallback answered `?limit=5` from that
same 20-row page. Routes with a recording but no table row live in
`mock-fixture-ledger.json`, each carrying the same columns a table row does so it can
move into the table verbatim the day a screen adopts it.

Re-recording (`--record <host>`) changes the set, so it changes the baseline:
re-run `python3 tools/mock_rea.py --rehash` deliberately and re-bless.

### The socket half (wave 5.1)

Gate B rule 4 used to be **closed for REST and open for sockets** — `mock_rea` spoke no
WebSocket, so the ten socket rows of `CONTRACTS.json` had no instrument and nothing in the
tree could push a frame at the stores. `ws_frames.py` serves all ten and
`check_mock_contract.py` opens all ten and reads what comes out (`socket-shape`,
`socket-cadence`, `socket-history`, `socket-key-drift`, `socket-upgrade`,
`socket-unvouched`; canaries behind `--ws-canary`).

```bash
python3 tools/mock_rea.py --ws-rate 15          # the 15 Hz loop proof
python3 tools/mock_rea.py --ws-phase in-shot    # start and stay mid-pour
python3 tools/mock_rea.py --ws-script run.json  # phases + the values nothing records
```

**`WS_FRAMES.md` is the answer to "where did that number come from".** Frames are recorded
(the machine channel is the recorded shot with the keys `633f6f68` retired dropped),
derived by a written rule (the scale channel is that same recording's `weight`/`weightFlow`
under the names they live at now), or the mock's own state as a server — and where a
channel is none of those it is **silent** (`waterLevels`, `shotSettings`: no fixture in the
set records either). No new fixture files exist: derivation happens at run time, so
`FIXTURES.sha256` is untouched and still verifies.
