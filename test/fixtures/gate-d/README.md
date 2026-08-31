# gate-d canaries

Every guard ships with a canary: a fixture that violates the rule on purpose, and a test
asserting the guard fails on it. All three of this project's previous
guard failures were guards that silently stopped covering their target — a canary turns
that decay from invisible into a red build.

Nothing here is real client code and nothing here is imported by the app. `scripts/gate-d.js`
scans `src/` only, so these files are outside its reach in a normal run; the test hands
them to the checks explicitly.

| fixture | rule it breaks |
|---|---|
| `unlisted-route.js` | COVERAGE — a route-shaped string literal with no table row |
| `unlisted-route-id.js` | COVERAGE — a generated-table route id addressed with no table row |
| `constructed-route.js` | COVERAGE — a path assembled from fragments in an undeclared file |
| `forbidden-spelling.js` | RETIREMENT — a retired contract bug's spelling, back in code |
| `clean-control.js` | nothing: the control. Every check must pass on it. |
| `stale-table.json` | STALENESS — a row (and the table pin) stamped at the wrong commit |
| `wrong-handler-table.json` | SOURCE — a handler file, route registration and symbol that are not true of the pinned worktree |
| `disagreeing-table.json` | AGREEMENT — a row whose verb/path contradict the generated route table |
| `malformed-table.json` | INTEGRITY — a missing column, an unknown status, a "consumed" row with no caller, a builder file that does not exist |

The three prose canaries matter as much as the code ones: `clean-control.js` **names** a
dead route and a forbidden spelling in comments, because the scan family's founding rule is
that a name USED is not a name DISCUSSED. A guard that fires on the control would earn an
exemption, and an exemption is how coverage dies.
