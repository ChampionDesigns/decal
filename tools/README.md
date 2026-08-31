# tools

The development rig: a mock ReaPrime server, the fixtures it answers from, the checks
that keep the two honest, and a component gallery.

```
mock_rea.py             the mock server: REST from recorded fixtures, plus sockets
ws_frames.py            the ten socket frames the mock can push
check_mock_contract.py  the mock answers what the contract table declares
rea-fixtures/           recorded ReaPrime responses, one file per route and query
FIXTURES.sha256         their hashes, so a silent edit is visible
mock-fixture-ledger.json  which fixture answers which route, and why one does not
wire-ledger.json        vouched exceptions to gate-wire
gallery/                one page per component, every state, for a human to look at
```

## The mock server

```
python3 tools/mock_rea.py                        # serves the skin and the API
python3 tools/mock_rea.py --port 8080
```

It serves the repo as static files and answers `/api/v1/*` from `rea-fixtures/`. A route
with no fixture answers 503 rather than inventing a body, so a screen that depends on an
unrecorded route fails loudly instead of rendering a guess.

Sockets are served too. `ws_frames.py` holds the frames, and the mock pushes one on
request; `WS_FRAMES.md` describes each.

## The checks

```
npm run mock-contract        # the mock and the contract table agree
```

`check_mock_contract.py` reads `src/data/CONTRACTS.json` and every fixture, and reports
each route as vouched, ledgered, or missing. A route the skin calls with no fixture and no
ledger entry is a failure. `mock-fixture-ledger.json` carries the reason for each
deliberate gap.

Fixture parity is a precondition, not an opinion: `FIXTURES.sha256` records a hash per
fixture, and a mismatch means someone edited recorded data by hand.

## The gallery

```
python3 tools/mock_rea.py     # then open /tools/gallery/
```

One entry per component under `gallery/entries/`, each declaring its states. The registry
is checked by the suite, so an entry that names a component that does not exist, or misses
a state a component declares, fails a test rather than going quietly stale.
