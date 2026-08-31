# Mock-contract canaries

Every guard ships with a canary: a fixture that violates the rule on purpose, and a test
asserting the guard fails on it. `tools/check_mock_contract.py` holds
the mock to the same contract table gate-d holds the client to, and these are
what prove it still bites.

Nothing here is a real recording and nothing here is ever served: each directory is
handed to the checker with `--fixtures-dir`, and each is a **complete fixture set of
one file**, so the rule it breaks is the only rule that can fire. `test/
mock-contract.test.mjs` asserts exactly that — a canary that also trips someone else's
rule proves nothing about its own.

| directory | rule it breaks |
|---|---|
| `shape-kind/` | an object where `getDevices` says an array |
| `keys-missing/` | eight of the nine keys `GET /machine/settings` writes |
| `keys-extra/` | a seventh key on the six-key `/machine/settings/advanced` row |
| `forbidden-spelling/` | `prewarmLeadMinutes` nested inside an LED-strip frame — a typed, open row, so no key rule can fire and the spelling scan is isolated |
| `invariant/` | three items for `limit=2`, which `shot_dao`'s SQL LIMIT cannot produce |
| `unvouched-route/` | a recording of a route with no row anywhere |
| `verb-not-served/` | a GET fixture for `/api/v1/feedback`, which the table has only as POST |
| `unparseable/` | a recorded HTML page nobody declared as one (`fixture-unparseable`) |
| `no-fixtures/` | nothing — an empty set, so the table-only canaries fire alone |

`canary-ledger.json` is the empty ledger those runs use. The real ledger's entries name
the real fixtures, which are not in these directories, and every one of them would report
`ledger-stale` and drown the canary.

## The canaries that are not files here

A ledger or table canary would mean copying a 500-line document to break one field, and
the copy would rot the first time the original moved. `test/mock-contract.test.mjs`
mutates the real one into a temp file instead:

| canary | mutation | what must fire |
|---|---|---|
| `ledger-stale` | a declared finding's `rules` no longer match what the check derives | `ledger-stale`, **and the finding it was hiding comes back** |
| `ledger-unstamped` | the ledger stamped at a commit that is not the pin | `ledger-unstamped` |
| `ledger-source` | an entry anchored on the wrong handler file | `ledger-source` |
| `refusal-not-wired` | the ledger refuses a fixture the live mock still serves | `refusal-not-wired` (the checker starts the mock and makes the request) |
| `envelope` | a recorded 404 HTML page declared as a 200 JSON body | `envelope` |
| `write-frame` | one row's success body moves under the mock's synthesized reply | `write-frame` |
| `shape-unparsed` | a row's success clause rewritten as prose the parser cannot read | `shape-unparsed` — "I could not read this" is never treated as "no problem here" |
| `table` | the table stamped at a commit that is not the pin | `table` |
| `query-fallback` | `mock_rea._resolve` monkeypatched back to the deleted endpoint fallback, in-process | `query-fallback`, on `api__v1__shots~limit=20~offset=0~order=desc.json` — the recording that used to answer every `/shots` query |

`query-fallback` is a canary on DELETED CODE, which is why it is a mutation and not a
file: the rule asks the running mock for a page no fixture is named for (the endpoint
bare, and the recorded query plus one more parameter), and a 200 means something answered
from a different recording. With the fallback gone nothing on disk can make it fire, so
the canary puts the fallback back for one call. It exists because the file-based rules
structurally cannot see this defect — each derives its request from the query in the
fixture's own name, so the shots list was only ever asked at `limit=20`.

## The one rule with no canary

`fixture-name` — a fixture whose name does not survive a round trip through the mock's
own `_key()`. Canarying it means committing a filename containing a `?`, and the rule is
an integrity check on a decoder that is nine lines long. Stated here rather than left to
be discovered: silence is not coverage, and neither is a table that only lists what IS
covered.

## Why the control is the real fixture set

There is no `control/` directory. The control is the checker's ordinary run — real
fixtures, real ledger, real table — asserted to pass with its bucket counts adding up to
the fixture count. A checker that quietly stopped looking at anything also reports `ok`,
so the control asserts the numbers and not the boolean.
