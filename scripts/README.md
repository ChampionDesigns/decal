# scripts/

Generators and guards that run under node, never at serve time: the i18n build (D2),
the colour-literal guard (A8), the token-integrity check, and the generated-artifact
freshness check (SCOPE Part 2 §7).

Every guard ships with a canary - a fixture that deliberately violates the rule and a
test asserting the guard fails on it. All three old-guard failures were guards that
silently stopped covering their target (Part 8 §2, Gate C).

## Gate C

```
node scripts/guards.js            # all guards; exit 1 on any error
node scripts/guards.js --json     # machine-readable, for the wave GATE agent
node scripts/guards.js --only colour-literal
```

| guard | rule | exempt |
|---|---|---|
| `colour-literal` | no raw colour literal in authored component CSS (A8) | `styles/tokens.css`, `styles/chart-channels.css` |
| `font-face` | no `@font-face` in component styles (Part 8 §3 Rule 2, static half) | `styles/document.css` |
| `important` | zero `!important` in component styles (spec §2.1 Rule 3) | - |
| `private-palette` | no re-declaring a public `--ui-*` token in a component (bug L12) | the token sheets |

`guards.js` is the registry - severity is one field per row, so downgrading a guard to
a warning is a one-word edit. `lib/authored-css.js` finds and parses the CSS;
`lib/colour-literals.js` decides what counts as a literal. `lib/source-scan.js` is the
shared JavaScript lexer under every source scan (Gate 2's dead names, Gate 3's excluded
surface, the cache register): it tells a name USED from a name DISCUSSED, so the module
headers and `src/data/EXCLUDED.md` can name dead symbols in prose without earning an
exemption.

**Scan by construction, not by allowlist.** `lib/authored-css.js` reads all three
places CSS is written here, not just the easy one:

| surface | where | example |
|---|---|---|
| `.css` sheet | `styles/` | `tokens.css` |
| `` css`…` `` tagged template in `.js` | `src/` | every component's `static styles` |
| HTML `<style>` element, or `` css`…` `` in an inline `<script>` | `index.html`, `tools/` | the gallery's ~120 lines of chrome |

A `**/*.css` glob would read three files today and miss every component ever written;
reading only `.css` and `.js` reported PASS on `tools/gallery/index.html`, a file it
had never opened. The scanner tracks JavaScript lexical state (strings, comments,
regex literals, nested template interpolations) and blanks HTML comments rather than
grepping, because `src/components/base.js` writes `!important` a dozen times in prose
and quotes measured `rgb(...)` values in its oracle citations: a guard that greps the
raw file fails on the file that documents the rule, and the fix for that false
positive is an exemption, and an exemption is how coverage dies.

Scan roots are `src/`, `styles/`, `tools/` and `index.html` (a root may be a file).
`test/` is excluded because its canaries violate every rule on purpose, and `vendor/`
because it is not authored here.

**Exemptions are exact paths, and their existence on disk is checked.** An exemption
pointing at a file nobody has - while silently covering one everybody has - is the old
markup-only colour guard's exact failure mode, so a missing exempt path is itself
reported as a violation. The check stats the file; it deliberately does *not* test
whether the path appeared in this run's scanned file list, because then a run over
narrowed roots reports present files as missing and the obvious remedy is to switch
the check off.

The canaries are in `test/fixtures/canaries/`, the clean counter-example in
`test/fixtures/guard-clean/`, and `test/guards.test.mjs` asserts both directions.

## i18n

`build-i18n.js` generates `i18n/en.json` from `i18n/source/` (D2).

## MachineState (Gate 2)

`generate-machine-state.js` generates `src/data/machine-state.generated.js` from
ReaPrime's `enum MachineState` / `enum MachineSubstate` in
`lib/src/models/device/machine.dart`.

```
node scripts/generate-machine-state.js            # write the artifact
node scripts/generate-machine-state.js --check    # exit 1 if it is stale
```

It is a generator rather than a copy because **the hand copy already drifted twice in one
object**: the old skin invented `READY: 'ready'` (not a state in either direction, then
used as a rule in a live-state fold) and lost `schedIdle` (which is one, so a
scheduled-idle machine classified as busy and the post-shot review window was cut short).
Both shipped, and both are among the 31 live contract bugs.

The source is the **pinned read-only reference worktree**
(`REA_ROOT`, default `/home/ben/bengle/_port/worktrees/rea-reanchor-v3`). The generator
resolves that tree's HEAD and refuses to run against anything but the pinned commit, so
the commit stamped into the artifact is a fact rather than a hope; a missing source or a
non-plain enum is a hard error, never a partial parse.
`test/machine-state-freshness.test.mjs` runs `--check` and, separately, re-parses the Dart
enum so byte-equality alone cannot pass a generator and artifact that are wrong together.

## The route table (Gate 3)

`generate-rea-routes.js` generates `src/data/rea-routes.generated.js` from ReaPrime's own
API specs — `assets/api/rest_v1.yml` and `assets/api/websocket_v1.yml` — in the same
pinned worktree.

```
node scripts/generate-rea-routes.js             # write the artifact
node scripts/generate-rea-routes.js --check     # exit 1 if it is stale
node scripts/generate-rea-routes.js --summary   # counts only, writes nothing
```

It exists because 872 of `api.js`'s 2,406 lines were one-line wrappers around a surface the
server already publishes (E2). `lib/yaml-subset.js` is the YAML reader underneath — no npm
dependency, and a deliberately small subset that **refuses** anchors, multi-document
streams, merge keys, explicit keys and tab indentation with a file and line number rather
than parsing them into something plausible. `lib/rea-source.js` holds the one pin
(`REA_ROOT`, `PINNED_COMMIT`, `resolveReaCommit`); a test asserts it agrees with
`generate-machine-state.js`.

Where the spec and the handler disagree, **the handler wins**: three named, commented
exceptions in the generator conform the output to the Dart, and each one hard-fails the
generator the moment the spec is fixed, so it deletes itself rather than rotting. See
`src/data/ROUTES.md`.

<!-- gate-d -->
## Gate D — the contract table

`gate-d.js` is the build gate over `src/data/CONTRACTS.json`, the record Part 3 §7 requires:
path, verb, request body, response shape, handler symbol, handler file and the ReaPrime
commit checked against, for every endpoint the skin adopts.

```
node scripts/gate-d.js              # human output, exit 1 on any violation
node scripts/gate-d.js --json       # machine-readable, for the wave GATE agent
node scripts/gate-d.js --no-source  # skip the worktree half, and say so
npm run gate-d
```

| half | rule |
|---|---|
| coverage | a route string, or a route id, in the client with no table row fails the build |
| staleness | a row stamped at anything but `lib/rea-source.js` `PINNED_COMMIT` fails the build |
| source | the worktree's own `git rev-parse HEAD` **is** the pin, and every row's handler file still exists there, still registers that path, still contains that symbol |
| retirement | a retired contract bug's spelling (`response.shots`, `scale/calibrate`, …) back in the client fails the build |
| integrity / agreement | the table is well formed, and every id agrees with the generated route table on verb and path |

The coverage half scans **all** of `src/` by construction: route-shaped string literals and
route ids, comments stripped, so a module header may name a dead route in prose without
earning an exemption. A path assembled from fragments cannot be seen that way, so there is a
third scan for those — it fails unless the file is declared in the table's
`constructedRouteBuilders`, naming the rows it builds. That list is four entries and is the
one place this gate trusts a declaration over an enumeration; it is written down rather than
hidden, because an exemption nobody can see is how coverage dies.

Staleness compares three strings that all live in this repo, so it proves only that the repo
agrees with itself. The source half therefore resolves `REA_ROOT`'s HEAD **before** reading
any handler and refuses anything but the pin: a tree at the wrong commit re-verifies nothing
and the run prints `worktree <path> at <commit>`, so the commit the rows were checked against
is on the record rather than assumed. (Without it, a run against another ReaPrime checkout
re-verified 46 of 50 rows against the wrong commit and printed only the four route strings
that differed — a response-shape drift would have printed `OK`.)

Canaries: `test/fixtures/gate-d/` — one fixture per rule, plus a control that discusses an
untabled route and a retired spelling in prose and must trip nothing. The worktree rules take
a tree rather than a file as their canary: this repo stands in for "a git tree that is not
the pin", a fresh temp dir for "not a git tree at all". `test/gate-d.test.mjs` asserts each
check fails on its canary, passes on the control, and re-reads every handler-body gate
against the Dart at the pin. `src/data/CONTRACTS.md` is the doc.
