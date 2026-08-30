# src/stores/

The reactive state owners: machine snapshot fan-out, capabilities (A3), units,
settings/storage router (B7), estimator link. Replaces every module-scope singleton
(`CARRY_FORWARD.md` §6, Gate 4). One owner per piece of state.

Contracts are Part 3's business; this directory only fixes where they live.

<!-- gate4-core -->
## Gate 4 CORE — the primitive, the seven feeds, the shot buffer, the time axis

| file | what |
|---|---|
| `store.js` | the primitive: replay to late subscribers, return-new-state enforced (frozen state, and `set(sameObject)` throws), `StoreController` for Lit, `watchAll`. |
| `feed-store.js` | one socket feed as **last-known value plus staleness**. `FEED_STATUS` never/live/stale/unavailable; `DEFAULT_STALE_AFTER_MS` (only feeds with a rate have one). |
| `feed-readers.js` | readers for the three feeds Gate 2 does not cover — shot state, display, update — built on `src/data/reading.js`, enums pinned to the Dart by test. |
| `shot-buffer.js` | the shot-so-far buffer: samples in the **recorded shape**, one walk for every scalar, `attachShotBuffer` for the wiring policies. |
| `time-axis.js` | B4: plot ReaPrime's stamp, choose t=0 the way history does, correct nothing. |
| `live-stores.js` | the assembly: `createLiveStores({sockets, devicesLink, sensorDiscovery, clock, sourceSelector})`, plus `sourceSelectorHooks` — the B6 adapter onto `shot-source-selector.js`. |

Three rules this layer enforces rather than documents, each a `CARRY_FORWARD.md` §6 pattern:

* **C** — no module-scope mutable state. `test/store.test.mjs` scans all of `src/` for a
  top-level `let`/`var` and fails on one. The live layer is built by a function, not by
  module instantiation, so a test can build two.
* **E** — no document `CustomEvent` buses, and no DOM or network anywhere under
  `src/stores/`. Scanned by the same suite.
* **A** — nothing here schedules on its own clock. Time is injected and nothing ticks. The
  scan forbids every spelling of "do this later" and permits ONE declared line,
  `shot-mirror.js`'s injected `setTimer` default — two one-shot deadlines that replace a
  silent boot hang, both cleared when the open settles, and both proved to be a real
  injection seam in `test/shot-mirror.test.mjs` rather than an exemption with a comment on
  it. Adding a second scheduling site fails; so does deleting the declared one without
  striking it off the list.
* **F** — a fold returns new state. State objects are frozen, and handing `set()` the
  object it already holds throws with the pattern named.

**B6 is decided on the FIRST SAMPLE, not at open** — at open there is no evidence, and
deciding then would freeze "no source" for the whole shot. `shot-source-selector.js`
supplies the decision through `sourceSelectorHooks`; the buffer holds it for the shot,
releases it when the shot closes, and keeps the RECORD of which source was in force so the
post-shot summary can label the trace.

**Machine truth is never owned here.** A source that closes does not erase the value: it is
kept, marked stale, and a screen decides how to show age. Nothing is recomputed locally
when a channel goes absent (A7) — that is the whole reason this layer exists.
