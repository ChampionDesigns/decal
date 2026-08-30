#!/usr/bin/env python3
"""Offline stand-in for ReaPrime, for capture and provenance runs.

Ported from `review/tools/mock_rea.py` (Slate's, read-only). Serves recorded GET
fixtures on port 8080 so Decal's screens render with realistic data and no machine
is involved.

SAFETY (carried unchanged): only GET is ever forwarded to a real ReaPrime, and only
when --record is passed with an explicit host. Every mutating verb
(POST/PUT/PATCH/DELETE) is answered locally and is NEVER forwarded, so a capture run
cannot command a machine.

WHAT THE PORT ADDS — Gate B change 4, "the mock is contract-checked" (SCOPE Part 8
§2): "The battery is only as honest as mock_rea's frames. Its fixtures should be
recorded real ReaPrime responses (review/tools/rea-fixtures/ already holds some), and
the mock's payload shapes get checked against the same contract table as the client
(Gate D) — otherwise the battery can pass forever against a server that no longer
exists." Four mechanisms:

  1. `--check-fixtures` verifies every fixture against `tools/FIXTURES.sha256`.
     FIXTURE PARITY IS A FINAL-REVIEW PRECONDITION (Part 10 §13): the comparison
     anchors on text and assumes identical data, so a drifted fixture turns every
     profile title and shot trace into a false difference. Both instruments call
     this before their first shot AND ABORT ON IT — the probe used to call it and
     shoot anyway, recording the failure in RUN.json after the corpus was written.
     `--allow-fixture-drift` is the one legitimate override, on both.
  2. `--check-contract` runs `check_mock_contract.py` against `src/data/CONTRACTS.json`
     — the SAME table Gate D holds the client to, whose rows are read off the handler
     body at the pinned ReaPrime commit. There is no second table and no fallback: the
     provisional fixture-derived table this file used to accept (`mock-contract.json`,
     with `src/data/rea-contract.json` and an env var ahead of it in a three-deep
     candidate chain) is DELETED. A chain of candidate references is precisely how an
     instrument goes on passing against a reference that moved (A7).
  3. THE MOCK REFUSES TO SERVE A FRAME THE HANDLER REFUTES. `machine/cupWarmer` still
     carries the `prewarm*` keys that CB-18/CB-19 retired, and no truer recording of
     it exists anywhere — Slate's committed blob has the same stale bytes. It is NOT
     edited (a fixture edited to pass a check has stopped being a recording) and NOT
     quietly served: `tools/mock-fixture-ledger.json` declares it, and this server
     answers that route **410 with an explicit body**. Absence becomes visible in the
     capture instead of a plausible lie. `check_mock_contract.check_live` starts this
     server and makes the request, so the build fails if the wiring disappears.
     The other two refuted recordings — `shots/latest` and the shots list — were not
     recordings at all but an uncommitted Slate working-tree edit wave 0a copied, and
     they have been REPLACED by the committed blobs that ARE recordings of those
     routes (ledger `resolved`, with the git command that reproduces each).
  4. MUTATING VERBS ARE ANSWERED FROM THE TABLE, NOT FROM A CANNED SUCCESS. The
     original replied `{"success": true, "mock": true}` to every write — a shape
     ReaPrime sends on no route in its history, which is a field the client could learn
     from its instrument and never see from its server. Each write is now derived from
     its row (`202` with no body, `200 null`, `200 {}`, `200 {"status":"accepted"}`),
     and where the row's success body cannot be stated without inventing values the
     mock answers **501** rather than invent one.

The fixtures themselves are the CURRENT working-tree bytes of
`slate/review/tools/rea-fixtures/`, copied (never edited) and hashed.

ONE PORTED BUG FIXED: the original's `do_GET` called `.exists()` on `_resolve()`'s
result, which is `None` on a total miss — so an unrecorded endpoint raised
AttributeError inside the handler instead of returning the `{}` the record/miss path
intends. It never fired in the baseline runs because every endpoint Slate touches had
a fixture; Decal's client will touch endpoints Slate never did.

AND THAT `{}` IS GONE TOO. A miss now answers **503 with an explicit body**, because an
empty object is a fabricated success: it renders as "the machine has nothing" rather
than "this instrument has no recording". 503 and not 404 on purpose — 404 is ReaPrime's
FEATURE-ABSENT signal on the cup warmer, pre-heat, LED strip and scale-calibration
routes (`_bengleFirmwareGate`), and an instrument must never manufacture that.

IT NOW SPEAKS WebSocket, AND THAT IS WHAT WAVE 0b LEFT OPEN. "Gate B rule 4 is closed for
REST and open for sockets" (`waves/0b/REPORT.md:255-261`): this file had two verbs and no
101, so the ten socket rows of the contract table had no instrument at all and nothing in
the tree could push a frame at the stores. `tools/ws_frames.py` is the other half — the ten
channels, their frames, and where every value comes from — and `do_GET` below hands it any
`/ws/v1/*` request that carries the upgrade headers.

A PLAIN GET OF A SOCKET PATH STILL ANSWERS THE RECORDED 404 HTML PAGE. That is not an
oversight to tidy up later: `ws__*.json` are recordings of ReaPrime's "Only WebSocket
connections are supported." page, `envelope_for` serves a recording as what it is, and
`check_mock_contract.check_live` asserts it. Upgrade or not is the whole difference.

AND SO IS THE QUERY FALLBACK (A7). `_resolve` used to fall back from an exact miss to
any recording of the same ENDPOINT, on the argument that a fixture name embeds its query
so one extra parameter turns a hit into a miss. What it actually did was answer every
`/api/v1/shots?…` with the one `limit=20` page: `?limit=5&offset=0&order=desc` came back
200 with 21 items, `limit` 20 and `offset` 0 — four times the rows asked for, at the
wrong offset, echoing a page size nobody requested. That is the defect class this wave
exists to kill: a plausible answer standing where an absence should be visible, and one
Gate B rule 4 could not see, because `check_fixtures` derives each request from the query
in the fixture's OWN name and so only ever asked at limit=20. Resolution is EXACT now, a
query with no recording is a miss (503), and `check_mock_contract.check_query_isolation`
makes the request to prove it.
"""
from __future__ import annotations

import hashlib
import http.server
import json
import pathlib
import re
import socketserver
import sys
import threading
import urllib.error
import urllib.request

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import ws_frames                                                    # noqa: E402

REPO = TOOLS.parent
FIXTURES = TOOLS / "rea-fixtures"
HASHES = TOOLS / "FIXTURES.sha256"
LEDGER = TOOLS / "mock-fixture-ledger.json"
SAFE_METHODS = {"GET", "HEAD"}


def _key(path: str) -> str:
    safe = path.strip("/").replace("/", "__").replace("?", "~").replace("&", "~")
    return (safe or "root")[:180] + ".json"


def _resolve(path: str, fixtures_dir: pathlib.Path | None = None):
    """The fixture recorded for EXACTLY this path — query string included — or None.

    THE ENDPOINT FALLBACK IS DELETED AND MUST STAY DELETED (A7). The ported version
    fell back to `glob(f"{endpoint}~*.json")` on an exact miss, reasoning that the
    endpoint identifies the fixture and the params only rank candidates. A query
    string is not a ranking hint: `limit`, `offset` and `order` ARE the request, and
    the response echoes them back. Serving the `limit=20` page to `?limit=5` answered
    a question nobody asked with a body that looks exactly like an answer.

    A query with no recording is now a MISS, and `do_GET` says so with a 503 naming
    the path. "This instrument has no recording of that page" is a true sentence; a
    different page is not.
    """
    root = fixtures_dir or FIXTURES
    exact = root / _key(path)
    return exact if exact.exists() else None


# --------------------------------------------------------------------------- #
# Fixture parity
# --------------------------------------------------------------------------- #

def hash_fixtures() -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(FIXTURES.glob("*.json"))}


def read_hashes() -> dict[str, str]:
    if not HASHES.exists():
        return {}
    out = {}
    for line in HASHES.read_text().splitlines():
        if not line.strip():
            continue
        digest, name = line.split(maxsplit=1)
        out[name.strip()] = digest
    return out


def check_fixtures(verbose: bool = True) -> dict:
    """Fixture parity. Returns a report; `ok` False means DO NOT SHOOT."""
    have, want = hash_fixtures(), read_hashes()
    missing = sorted(set(want) - set(have))
    extra = sorted(set(have) - set(want))
    changed = sorted(n for n in set(have) & set(want) if have[n] != want[n])
    report = {"count": len(have), "recorded": len(want), "missing": missing,
              "extra": extra, "changed": changed,
              "ok": not (missing or extra or changed) and bool(want)}
    if verbose:
        if report["ok"]:
            print(f"  fixture parity OK — {len(have)} fixtures match {HASHES.name}")
        else:
            print(f"  FIXTURE PARITY FAILED — missing={missing} extra={extra} changed={changed}")
    return report


def write_hashes() -> int:
    lines = [f"{d}  {n}\n" for n, d in sorted(hash_fixtures().items())]
    HASHES.write_text("".join(lines))
    return len(lines)


# --------------------------------------------------------------------------- #
# Gate B change 4 — the contract check, and what it changes about serving
# --------------------------------------------------------------------------- #
#
# `check_mock_contract` imports this module (it checks what the mock serves), so every
# import of it here is deferred into the function that needs it. Explicit and one-way:
# the checker knows about the mock; the mock asks the checker three questions.

def read_ledger(ledger_path: pathlib.Path | None = None) -> dict:
    """The fixture ledger. `ledger_path` exists for the canaries, which hand the checker
    a deliberately wrong one; the server itself always reads `LEDGER`."""
    path = ledger_path or LEDGER
    if not path.exists():
        raise SystemExit(
            f"{path} is missing. It declares every fixture this mock must NOT serve; "
            "without it the mock would serve frames the contract table refutes.")
    return json.loads(path.read_text())


def refused_fixtures(ledger_path: pathlib.Path | None = None) -> set[str]:
    """Fixture files this server will not answer with, and why they exist anyway.

    A refuted recording is evidence — of what the server used to send, and of what has
    to be re-recorded on the bench. Deleting it would delete the evidence; serving it
    would photograph a lie. So it stays on disk, out of the reply path.

    THE DERIVATION IS THE THING UNDER TEST. `check_mock_contract.check_refusals` asks
    this function what the mock will refuse and compares it with what the ledger says it
    must refuse, so a "simplification" here (dropping the non-JSON half, hard-coding a
    list, reading a stale copy) fails the build instead of restoring a lie in silence.
    """
    ledger = read_ledger(ledger_path)
    out = {e["fixture"] for e in ledger.get("findings", []) if e.get("disposition") == "refuse"}
    out |= {e["fixture"] for e in ledger.get("nonJson", [])}
    return out


#: The by-id shot route, whose body is the only recorded one carrying `measurements`.
_SHOT_BY_ID = re.compile(r"^/api/v1/shots/(?!latest$)[^/?]+$")


def _derived_or_none(p: float, f: float, value: float):
    """ReaPrime's own `_derivedOrNull`, transcribed from `machine.dart:70-76` at the pin.

    Returns `value` only when `flow >= 0.3 && pressure >= 0.3` and every input and the
    result are finite. Below the gate the ratios are numerically meaningless and
    `jsonEncode` would throw on the infinities, which is why the server gates rather than
    clamps.
    """
    if not (f >= 0.3) or not (p >= 0.3):
        return None
    for v in (p, f, value):
        if not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
            return None
    return value


def upgrade_recorded_shot(record):
    """Recompute the three derived channels onto a recorded shot, AT SERVE TIME.

    THE DATA TRUTH, at pin 2b047d02 (`lib/src/models/device/machine.dart:64-140`): the
    derived channels are "computed on read from the raw pressure and flow fields — never
    stored — so already-recorded history shots gain these channels with zero migration
    (fromJson does not read them; toJson recomputes them)". `ShotsHandler._getShot`
    answers `jsonOk(shot.toJson())`, which maps every measurement through
    `ShotSnapshot.toJson` -> `machine.toJson()`, which WRITES the three keys above the
    gate and OMITS them below it.

    THE RECORDINGS PREDATE THE GETTERS: 923 measurements across the three shot fixtures,
    zero `*Derived` keys, zero `sensors` maps. By this file's own standing rule — "a
    recorded fixture is evidence and never authority: when the two disagree the handler
    decides which is stale, and the fixture is never edited to agree" — the handler wins
    and the bytes on disk stay exactly as recorded, hashes and all. What changes is what
    the MOCK SERVES, which is the same class of thing as the 410 the cup-warmer route
    gets: the instrument answering as the server at the pin would.

    NOTHING IS INVENTED. Every number written here is `p / (f * f)`, `p / f` or
    `0.1 * p * f` over pressure and flow that were recorded off a real machine, under the
    server's own gate, with the server's own omit-don't-null rule. The JS twin in
    `test/fixtures/history-route-fixture.js` is the same rule in the other language, for
    the rendering suites; `tools/mock-fixture-ledger.json` declares both.
    """
    if not isinstance(record, dict) or not isinstance(record.get("measurements"), list):
        return record, 0
    upgraded = 0
    measurements = []
    for measurement in record["measurements"]:
        machine = measurement.get("machine") if isinstance(measurement, dict) else None
        if not isinstance(machine, dict):
            measurements.append(measurement)
            continue
        p, f = machine.get("pressure"), machine.get("flow")
        if not isinstance(p, (int, float)) or not isinstance(f, (int, float)):
            measurements.append(measurement)
            continue
        nxt = dict(machine)
        wrote = False
        for key, value in (
            ("puckResistanceDerived", _derived_or_none(p, f, p / (f * f)) if f else None),
            ("loadImpedanceDerived", _derived_or_none(p, f, p / f) if f else None),
            ("hydraulicPowerDerived", _derived_or_none(p, f, 0.1 * p * f)),
        ):
            if value is not None:
                nxt[key] = value
                wrote = True
        if wrote:
            upgraded += 1
        measurements.append({**measurement, "machine": nxt})
    return {**record, "measurements": measurements}, upgraded


def envelope_for(fixture: pathlib.Path, ledger_path: pathlib.Path | None = None) -> tuple[int, str]:
    """The status and content type a fixture is served with.

    A recorded 404 HTML page (what ReaPrime answers when a WebSocket path is fetched
    over plain HTTP) is served as a 404 HTML page. It used to be served as
    `200 application/json`, which is the instrument rewriting a recording.
    """
    for entry in read_ledger(ledger_path).get("nonJson", []):
        if entry["fixture"] == fixture.name:
            served = entry.get("serveAs", {})
            return served.get("status", 404), served.get("contentType", "text/html")
    return 200, "application/json"


def check_contract(verbose: bool = True) -> dict:
    """Delegate to the Gate B rule 4 checker. One table, no candidates, no fallback."""
    sys.path.insert(0, str(TOOLS))
    import check_mock_contract as checker                          # noqa: PLC0415

    try:
        report = checker.run(FIXTURES, checker.TABLE_PATH, LEDGER)
    except checker.CheckError as exc:
        if verbose:
            print(f"  CONTRACT CHECK CANNOT RUN — {exc}")
        return {"ok": False, "table": str(checker.TABLE_PATH), "error": str(exc),
                "routes": 0, "failures": [str(exc)]}
    failures = [f"{f['rule']}: {f['subject']} — {f['detail']}"
                for f in report["findings"] if f["blocking"]]
    notes = [f"{f['rule']}: {f['subject']} — {f['detail']}"
             for f in report["findings"] if not f["blocking"]]
    out = {"ok": report["ok"], "table": report["table"], "pin": report["pin"],
           "routes": report["counts"]["routesChecked"], "counts": report["counts"],
           "failures": failures, "notes": notes}
    if verbose:
        if report["ok"]:
            print(f"  contract check OK — {out['routes']} routes vs "
                  f"{pathlib.Path(out['table']).name} @ {report['pin'][:8]} "
                  f"({report['counts']['ledgered']} ledgered, {len(notes)} notes)")
        else:
            print(f"  CONTRACT CHECK FAILED vs {pathlib.Path(out['table']).name}")
            for f in failures:
                print("    ", f)
    return out


def uncontracted_matcher():
    """A predicate: does this request path have a checked contract behind it?

    Silence is not coverage — the runtime record of paths NOBODY has checked is the only
    way a route the client invents shows up before it reaches a machine.
    """
    sys.path.insert(0, str(TOOLS))
    import check_mock_contract as checker                          # noqa: PLC0415

    table = checker.load_table(checker.TABLE_PATH)
    ledger = read_ledger()
    unadopted = {e["path"].split("?")[0] for e in ledger.get("unadopted", [])}

    def is_contracted(bare: str) -> bool:
        return bool(checker.match_rows(bare, table)) or bare in unadopted

    return is_contracted


def write_response(path: str, verb: str) -> tuple[int, bytes, str]:
    """The answer to a mutating verb, derived from its contract row.

    Never forwarded, never a machine command — and never a canned success either. The
    row states the whole body or the mock refuses: `{"status": "accepted"}` is quoting
    the handler, `ProfileRecord.toJson` would be inventing a server.
    """
    sys.path.insert(0, str(TOOLS))
    import check_mock_contract as checker                          # noqa: PLC0415

    bare = path.split("?")[0]
    table = checker.load_table(checker.TABLE_PATH)
    rows = [r for r in checker.match_rows(bare, table) if r["verb"] == verb.upper()]
    refusal = json.dumps({
        "error": "the offline mock has no stateable response for this route",
        "verb": verb.upper(), "path": bare,
        "why": "its contract row's success body is a typed document (or the route has no "
               "row at all), and a mock that invents one teaches the client a server that "
               "does not exist",
    }).encode()
    if not rows:
        return 501, refusal, "application/json"
    branches = checker.success_branches(rows[0])
    if not branches or not checker.synthesizable(branches[0]):
        return 501, refusal, "application/json"
    branch = branches[0]
    if branch["kind"] == "none":
        return branch["status"], b"", "application/json"
    if branch["kind"] == "null":
        return branch["status"], b"null", "application/json"
    body = {k: branch["literals"][k] for k in branch["keys"]}
    return branch["status"], json.dumps(body).encode(), "application/json"


# --------------------------------------------------------------------------- #
# The server
# --------------------------------------------------------------------------- #

class MockRea(http.server.BaseHTTPRequestHandler):
    record_host: str | None = None
    recorded: set[str] = set()
    missing: set[str] = set()
    uncontracted: set[str] = set()
    refused_paths: set[str] = set()
    is_contracted = None
    refused: set[str] = set()
    #: measurements the shot route's serve-time upgrade wrote derived channels onto
    shots_upgraded: int = 0
    #: the WebSocket half — created by `start`, loaded on the first upgrade
    ws_session = None
    ws_replay = None
    ws_opened: dict[str, int] = {}
    ws_frames: dict[str, int] = {}
    ws_lock = threading.Lock()

    def log_message(self, *_):
        pass

    # -- the WebSocket half ------------------------------------------------ #

    def _maybe_upgrade(self) -> bool:
        """Serve a `/ws/v1/*` upgrade, or say this request is not one.

        The plugin row is the one channel answered BEFORE the upgrade: ReaPrime replies
        404 to a plugin that is not loaded, so the socket never opens and plugin absence
        degrades to feature-absent rather than to a socket a client redials for ever. No
        plugin payload is recorded anywhere, so that is every plugin endpoint here.
        """
        bare = self.path.split("?")[0]
        if not bare.startswith(ws_frames.WS_PREFIX) or not ws_frames.is_upgrade(self.headers):
            return False
        row = ws_frames.row_for_path(bare)
        if row is None:
            MockRea.uncontracted.add(bare)
            self._send(404, json.dumps({
                "error": "no socket row in the contract table addresses this path",
                "path": bare,
                "why": "the mock serves the ten rows of CONTRACTS.json 'sockets' and no "
                       "more; /ws/v1/machine/raw, /ws/v1/logs and /ws/v1/webview/logs are "
                       "deliberately absent (src/data/EXCLUDED_WS.md).",
            }).encode())
            return True
        if row == "pluginEndpoint":
            self._send(404, json.dumps({
                "error": "Plugin not found",
                "path": bare,
                "why": "no plugin payload is recorded; ReaPrime answers an unloaded plugin "
                       "404 BEFORE the upgrade, and an instrument must not open a socket "
                       "that would then carry invented events.",
            }).encode())
            return True

        with MockRea.ws_lock:
            if MockRea.ws_session is None:
                MockRea.ws_session = ws_frames.Session(ws_frames.Script())
            if MockRea.ws_replay is None:
                MockRea.ws_replay = ws_frames.ShotReplay()
            MockRea.ws_opened[row] = MockRea.ws_opened.get(row, 0) + 1

        self.wfile.write(ws_frames.handshake_response(self.headers["Sec-WebSocket-Key"]))
        self.wfile.flush()
        self.close_connection = True
        sent = ws_frames.serve_socket(self.connection, bare, MockRea.ws_session,
                                      MockRea.ws_replay)
        with MockRea.ws_lock:
            MockRea.ws_frames[row] = MockRea.ws_frames.get(row, 0) + sent
        return True

    def _send(self, code: int, body: bytes, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
        if self.command == "GET" and self._maybe_upgrade():
            return
        bare = self.path.split("?")[0]
        if MockRea.is_contracted and not MockRea.is_contracted(bare):
            MockRea.uncontracted.add(bare)

        fixture = _resolve(self.path)
        if fixture is not None and fixture.name in MockRea.refused:
            MockRea.refused_paths.add(bare)
            entry = next((e for e in read_ledger().get("findings", [])
                          if e["fixture"] == fixture.name), None)
            if entry is None:                      # a recorded non-JSON body: serve it as it is
                status, ctype = envelope_for(fixture)
                self._send(status, fixture.read_bytes(), ctype)
                return
            self._send(410, json.dumps({
                "error": "this recording is refuted by the contract table",
                "path": bare, "fixture": fixture.name,
                "evidence": entry.get("evidence"),
                "handler": f"{entry.get('handlerSymbol')} in {entry.get('handlerFile')}",
                "action": entry.get("bench"),
            }).encode())
            return

        if fixture is not None:
            status, ctype = envelope_for(fixture)
            #: THE SERVE-TIME UPGRADE — see `upgrade_recorded_shot`. Only the by-id shot
            #: route, only when the recording is missing what the handler at the pin
            #: writes, and never a change to the bytes on disk.
            if status == 200 and _SHOT_BY_ID.match(bare):
                record, upgraded = upgrade_recorded_shot(json.loads(fixture.read_text()))
                MockRea.shots_upgraded += upgraded
                self._send(status, json.dumps(record).encode(), ctype)
                return
            self._send(status, fixture.read_bytes(), ctype)
            return

        if MockRea.record_host:
            url = f"http://{MockRea.record_host}:8080{self.path}"
            target = FIXTURES / _key(self.path)
            try:
                with urllib.request.urlopen(url, timeout=10) as r:
                    body = r.read()
                FIXTURES.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
                MockRea.recorded.add(self.path)
                self._send(200, body)
                return
            except urllib.error.HTTPError as e:
                body = e.read() or b"{}"
                FIXTURES.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
                self._send(e.code, body)
                return
            except Exception:
                pass

        MockRea.missing.add(self.path)
        self._send(503, json.dumps({
            "error": "the offline mock has no recorded response for this path",
            "path": self.path,
            "why": "503 and not 404 on purpose: 404 is ReaPrime's feature-absent signal "
                   "(_bengleFirmwareGate), and an instrument must never manufacture it.",
        }).encode())

    do_HEAD = do_GET

    def _write(self):
        """Mutating verbs are answered from the contract table. Never forwarded."""
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        bare = self.path.split("?")[0]
        if MockRea.is_contracted and not MockRea.is_contracted(bare):
            MockRea.uncontracted.add(f"{self.command} {bare}")
        status, body, ctype = write_response(self.path, self.command)
        self._send(status, body, ctype)

    do_POST = do_PUT = do_PATCH = do_DELETE = _write


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start(port=8080, record_host=None, script=None):
    """Start the server. `script` is a `ws_frames.Script` — cadence, phase order, and the
    values no recording carries. Passing none leaves the socket half on its defaults, and
    the defaults are the honest ones: silent where nothing is recorded."""
    MockRea.record_host = record_host
    MockRea.is_contracted = uncontracted_matcher()
    MockRea.refused = refused_fixtures()
    if script is not None:
        MockRea.ws_session = ws_frames.Session(script)
        MockRea.ws_replay = ws_frames.ShotReplay()
    httpd = Server(("127.0.0.1", port), MockRea)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def start_or_reuse(port=8080, record_host=None):
    """Start the mock, or reuse one that is already serving THE SAME FIXTURES.

    The audit's probe reused whatever was on 8080 — "another capture session already
    owns it with the same fixtures; reuse rather than fight it, never kill another
    session's run". Correct instinct, unchecked assumption: "the same fixtures" was
    taken on trust, and fixture parity is precisely the precondition Part 10 §13 says
    silently poisons every comparison after it. So the reuse path now PROVES it, by
    asking the incumbent for one endpoint and comparing the bytes with our own copy.
    """
    try:
        httpd = start(port=port, record_host=record_host)
        print(f"  mock ReaPrime on 127.0.0.1:{port} — {len(list(FIXTURES.glob('*.json')))} fixtures"
              f", {len(MockRea.refused)} refused")
        return httpd
    except OSError:
        pass
    probe = "/api/v1/info"
    ours = _resolve(probe)
    try:
        theirs = urllib.request.urlopen(f"http://127.0.0.1:{port}{probe}", timeout=5).read()
    except Exception as exc:                                    # noqa: BLE001
        raise SystemExit(f"port {port} is busy but not answering {probe} ({exc}) — "
                         "the capture instruments are sequential by design") from exc
    if ours is None or theirs != ours.read_bytes():
        raise SystemExit(f"another server is on {port} serving DIFFERENT data for {probe}. "
                         "Refusing to capture against it — fixture parity is a precondition "
                         "(SCOPE Part 10 §13), not a preference.")
    print(f"  reusing the mock ReaPrime already on {port} (fixture bytes match)")
    return None


def _arg(argv: list[str], name: str, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


if __name__ == "__main__":
    import time

    argv = sys.argv[1:]
    if "--help" in argv or "-h" in argv:
        print(__doc__.splitlines()[0])
        print("\n  --port N             listen here instead of 8080 (0 = ephemeral)"
              "\n  --record HOST        record GETs from a real ReaPrime (GET only, ever)"
              "\n  --check-fixtures     fixture parity only"
              "\n  --check-contract     the Gate B rule 4 contract check only"
              "\n  --rehash             re-write tools/FIXTURES.sha256"
              "\n\nThe WebSocket half (tools/ws_frames.py, tools/WS_FRAMES.md):"
              "\n  --ws-rate HZ         machine/scale cadence, default 10 (the real one);"
              "\n                       the 15 Hz loop proof runs this at 15"
              "\n  --ws-phase P         start and stay in one phase:"
              "\n                       idle | pre-shot | in-shot | post-shot"
              "\n  --ws-script FILE     the full run script (timeline, and the values no"
              "\n                       recording carries: waterLevels, shotSettings,"
              "\n                       devices.pendingAmbiguity)"
              "\n  --ws-sensors MODE    absent (default: unknown id -> error + close) |"
              "\n                       derived (the estimator's recorded channels)"
              "\n  --ws-scale MODE      derived (default) | absent"
              "\n  --ws-loop            replay the shot instead of holding the last frame")
        raise SystemExit(0)
    if "--check-fixtures" in argv or "--check-contract" in argv or "--check" in argv:
        rc = 0
        if "--check-contract" not in argv:
            rc |= 0 if check_fixtures()["ok"] else 1
        if "--check-fixtures" not in argv:
            rc |= 0 if check_contract()["ok"] else 1
        raise SystemExit(rc)
    if "--rehash" in argv:
        n = write_hashes()
        print(f"wrote {n} hashes -> {HASHES}")
        raise SystemExit(0)

    host = None
    if "--record" in argv:
        host = argv[argv.index("--record") + 1]
        print(f"recording GETs from {host} into {FIXTURES}")
        print("NOTE: recording changes the fixture set — re-run `--rehash` and re-bless "
              "the baseline, or every later comparison inherits the drift.")
    doc = json.loads(pathlib.Path(_arg(argv, "--ws-script")).read_text()) if "--ws-script" in argv else None
    if doc is not None and "--ws-loop" in argv:
        doc["loop"] = True
    elif doc is None and "--ws-loop" in argv:
        doc = {"loop": True}
    script = ws_frames.Script(
        doc,
        rate=float(_arg(argv, "--ws-rate")) if "--ws-rate" in argv else None,
        phase=_arg(argv, "--ws-phase"),
        sensors=_arg(argv, "--ws-sensors", "absent"),
        scale=_arg(argv, "--ws-scale", "derived"),
    )
    check_fixtures()
    port = int(_arg(argv, "--port", 8080))
    httpd = start(port=port, record_host=host, script=script)
    port = httpd.server_address[1]
    silent = [row for row, spec in ws_frames.SPECS.items() if spec["source"] == "unsourced"]
    print(f"mock ReaPrime on 127.0.0.1:{port} — ctrl-c to stop")
    print(f"  ws: {len(ws_frames.UPGRADED_ROWS)} channels upgrade, machine/scale at "
          f"{script.rate:g} Hz, phases {[e['phase'] for e in script.timeline]}")
    print(f"  ws: SILENT unless a script supplies them (no recording exists): "
          f"{', '.join(silent)} — tools/WS_FRAMES.md says why")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\nrecorded: {len(MockRea.recorded)}  unmatched: {len(MockRea.missing)}  "
              f"uncontracted: {len(MockRea.uncontracted)}  refused: {len(MockRea.refused_paths)}")
        for row, opened in sorted(MockRea.ws_opened.items()):
            print(f"  WS {row}: {opened} connections, {MockRea.ws_frames.get(row, 0)} frames")
        for row in sorted(MockRea.ws_session.silent if MockRea.ws_session else []):
            print(f"  WS SILENT (nothing recorded, nothing scripted) {row}")
        for m in sorted(MockRea.missing):
            print("  MISS", m)
        for m in sorted(MockRea.uncontracted):
            print("  NO CONTRACT ENTRY", m)
        for m in sorted(MockRea.refused_paths):
            print("  REFUSED (refuted recording)", m)
