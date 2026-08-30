#!/usr/bin/env python3
"""Gate B rule 4 — every frame the mock can serve is vouched for by the contract table.

    python3 tools/check_mock_contract.py            # human output, exit 1 on any violation
    python3 tools/check_mock_contract.py --json     # machine-readable, for the wave GATE agent
    npm run mock-contract

THE FAILURE THIS EXISTS TO KILL (E8): machinery that green-lights against a wrong
reference. `tools/capture_battery.py` photographs Decal against `mock_rea.py`, and
mock_rea answers out of `tools/rea-fixtures/` — recorded ReaPrime responses. Nothing
made those recordings agree with the server the skin will actually meet. A fixture that
predates a handler change keeps the battery green forever against a ReaPrime that no
longer exists, and the first evidence is a dead screen on Ben's bench.

So the mock's frames are checked against the SAME table as the client:
`src/data/CONTRACTS.json`, whose rows are hand-checked against the handler body at the
pinned commit. Gate D checks the CLIENT against that table. This checks the INSTRUMENT.

WHAT IS AUTHORITY HERE, AND WHAT IS NOT
  * The handler body at the pin is the authority, reached through the table's rows.
  * A recorded fixture is EVIDENCE, never authority, and is never edited to agree with
    the table. "Recorded" is the whole of its value: the moment a fixture is adjusted to
    pass a check, it stops being a recording and the check stops meaning anything.
  * When a fixture and the table disagree, the handler decides which is stale. Both
    mismatches found on the first run were the fixture's fault, and both are recorded
    with the Dart line that refutes them in
    `_skinlab/realine-run/waves/0b/mock-contract-mismatches.md`.

WHAT HAPPENS TO A REFUTED FIXTURE — A7, APPLIED TO AN INSTRUMENT
  It is NOT deleted, NOT edited, and NOT quietly served anyway behind a note in a file
  nobody reads. It is declared in `tools/mock-fixture-ledger.json` with `disposition:
  "refuse"`, and the mock then answers that route 410 with an explicit body instead of
  the refuted frame. Absence becomes visible: a screen built on it renders its
  empty/error state in the capture instead of a plausible lie.

  The ledger is not a mute button, and three rules keep it from becoming one:
    1. every entry carries the handler symbol, file and commit that refute the fixture;
    2. the checker RE-DERIVES the finding each run and fails (`ledger-stale`) if the
       recorded rules no longer reproduce exactly — re-record a fixture and the ledger
       stops matching, which is the point;
    3. `refuse` entries are checked by STARTING the mock and making the request, so
       deleting the wiring fails the build (`refusal-not-wired`) rather than silently
       restoring the lie. Comparing the ledger with a re-derivation of itself would be
       a tautology dressed as a check.

CANARIES: `test/fixtures/mock-contract/` holds one deliberately wrong fixture per rule
plus a stale ledger and a control, and `test/mock-contract.test.mjs` asserts each rule
fires on its own canary. A guard with no canary is a guard nobody has seen bite.

THE SOCKET HALF, CLOSED IN WAVE 5.1. This used to say, under BLIND SPOTS, that it "cannot
check the WebSocket frames at all: mock_rea speaks no WebSocket, so the ten socket rows in
the table have no instrument to check". `mock_rea` now speaks WebSocket (`tools/ws_frames.py`,
derivation table in `tools/WS_FRAMES.md`) and `check_socket_frames` opens all ten, reads the
frames off the wire and holds them to the rows. Its rules are `socket-unvouched`,
`socket-key-drift`, `socket-shape`, `socket-upgrade`, `socket-cadence` and
`socket-history`, and each has a canary behind `--ws-canary`.

BLIND SPOTS, stated so nobody trusts this for them:
  * It checks SHAPE (kind, keys, the handler-derived invariants below) — not values.
  * On the socket half it checks shape, cadence and the fire-and-forget rule. It cannot
    check that a value is the one a real machine would send: the frames are recorded or
    derived from recordings, and where neither exists the channel is SILENT and says so
    (`waterLevels`, `shotSettings` — no fixture in the set records either).
  * A passing desk check is necessary, not sufficient (the D7 episode). Anything only
    the bench can prove goes on the bench list, never asserted here.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import threading
import time
import urllib.error
import urllib.request

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import mock_rea                                                     # noqa: E402

REPO = TOOLS.parent
TABLE_PATH = REPO / "src" / "data" / "CONTRACTS.json"
LEDGER_PATH = TOOLS / "mock-fixture-ledger.json"
PIN_SOURCE = REPO / "scripts" / "lib" / "rea-source.js"

#: Findings that fail the build. Everything else is reported and does not.
BLOCKING = {
    "fixture-name", "fixture-unparseable", "unvouched-route", "verb-not-served",
    "shape-unparsed", "shape-kind", "keys-missing", "keys-extra", "forbidden-spelling",
    "invariant", "ledger-stale", "ledger-unstamped", "ledger-source",
    "refusal-not-wired", "envelope", "write-frame", "table", "query-fallback",
    # The socket half (wave 5.1). Same standing as the REST rules: a frame the table does
    # not vouch for must fail the build, not be noted at the bottom of a report.
    "socket-unvouched", "socket-shape", "socket-upgrade", "socket-cadence",
    "socket-history", "socket-key-drift",
}


class CheckError(Exception):
    """A precondition the checker cannot proceed without. Never a silent skip."""


# --------------------------------------------------------------------------- #
# The pin, the table, the ledger
# --------------------------------------------------------------------------- #

def read_pin() -> tuple[str, pathlib.Path]:
    """The pinned ReaPrime commit and worktree, from the ONE place they are written.

    `scripts/lib/rea-source.js` owns them. Parsed rather than restated: a second copy of
    a commit hash is a second thing to forget to re-pin, and Gate D already fails when
    the table drifts off this constant.
    """
    if not PIN_SOURCE.exists():
        raise CheckError(f"{PIN_SOURCE} is missing — it is the single source of the ReaPrime pin")
    text = PIN_SOURCE.read_text()
    m = re.search(r"PINNED_COMMIT\s*=\s*'([0-9a-f]{40})'", text)
    if not m:
        raise CheckError(f"no PINNED_COMMIT in {PIN_SOURCE}")
    r = re.search(r"REA_ROOT\s*=\s*process\.env\.REA_ROOT\s*\|\|\s*'([^']+)'", text)
    if not r:
        raise CheckError(f"no REA_ROOT in {PIN_SOURCE}")
    return m.group(1), pathlib.Path(os.environ.get("REA_ROOT") or r.group(1))


def load_table(path: pathlib.Path) -> dict:
    if not path.exists():
        raise CheckError(
            f"no contract table at {path}. This check has exactly one reference and no "
            "fallback: a second table to fall back on is how an instrument passes against "
            "a server that no longer exists (A7).")
    table = json.loads(path.read_text())
    for key in ("pinnedCommit", "rest"):
        if key not in table:
            raise CheckError(f"{path} has no '{key}' — it is not the Gate D contract table")
    return table


def load_ledger(path: pathlib.Path) -> dict:
    if not path.exists():
        raise CheckError(f"no fixture ledger at {path}")
    return json.loads(path.read_text())


# --------------------------------------------------------------------------- #
# Fixture names <-> request paths
# --------------------------------------------------------------------------- #

def path_of(name: str) -> str:
    """The request that produced `name`, inverting mock_rea's `_key`.

    Every decode is checked by re-encoding it (`fixture-name`): the decoder and the
    mock's encoder must agree, or the checker is checking a path the mock never serves.
    """
    stem = name[:-5] if name.endswith(".json") else name
    head, sep, query = stem.partition("~")
    path = "/" + head.replace("__", "/")
    if sep:
        path += "?" + query.replace("~", "&")
    return path


def split_query(path: str) -> tuple[str, dict[str, str]]:
    bare, _, q = path.partition("?")
    params = {}
    for part in q.split("&"):
        if not part:
            continue
        k, _, v = part.partition("=")
        params[k] = v
    return bare, params


# --------------------------------------------------------------------------- #
# Response-shape parsing
# --------------------------------------------------------------------------- #
#
# `responseShape` is a hand-written sentence per row, one clause per status the handler
# can produce: "200 array of {name:string, id:string, …}; 500 {e, st}". It is prose
# because a human writes it with the handler open, and prose is what a human checks.
# Parsing it is therefore deliberately strict: an unrecognised 2xx clause is reported as
# `shape-unparsed` and FAILS, because the alternative — treating "I could not read this"
# as "no problem here" — is the same silent-skip defect in a new costume.

_STATUS = re.compile(r"^\s*(\d{3})\b")
_TYPED = re.compile(r"^(?:the merged |a |an )?([A-Z][A-Za-z0-9]*\.toJson[A-Za-z0-9]*)")


def _brace_group(text: str) -> tuple[str, str] | None:
    """The first balanced {...} in `text`, plus the remainder after it."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1:i], text[i + 1:]
    return None


def _top_level_split(inner: str) -> list[str]:
    parts, depth, buf = [], 0, ""
    for ch in inner:
        if ch in "{[(":
            depth += 1
        elif ch in "}])":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(buf)
            buf = ""
            continue
        buf += ch
    if buf.strip():
        parts.append(buf)
    return [p.strip() for p in parts if p.strip()]


def _keys_and_literals(inner: str) -> tuple[list[str], list[str], dict[str, object]]:
    """Top-level key names, which of them are conditional, and stated literal values.

    A trailing `?` marks a key the handler writes conditionally — `chargingState?` on
    GET /settings is `if (_batteryController?.currentChargingState != null)`. It is
    ALLOWED but not REQUIRED, which is the only way a closed enumeration can describe a
    handler with `if (x != null) 'k': …` lines without manufacturing a false
    `keys-missing` on a machine that has no battery.

    `{status:'accepted'}` carries a value the handler writes; `{state:Foo.toJson}` does
    not. Only the former is ever synthesized (see `synthesizable`) — the difference is
    the whole line between quoting a handler and inventing a server.
    """
    keys, optional, literals = [], [], {}
    for part in _top_level_split(inner):
        name, sep, value = part.partition(":")
        name = name.strip().strip("`")
        if not name:
            continue
        if name.endswith("?"):
            name = name[:-1]
            optional.append(name)
        keys.append(name)
        v = value.strip() if sep else ""
        if v.startswith("'") and v.endswith("'") and len(v) >= 2:
            literals[name] = v[1:-1]
    return keys, optional, literals


def parse_response_shape(text: str) -> list[dict]:
    """Every status clause, as a shape descriptor."""
    branches: list[dict] = []
    for clause in _split_clauses(text):
        m = _STATUS.match(clause)
        if not m:
            continue
        status = int(m.group(1))
        rest = clause[m.end():].strip()
        branches.append({"status": status, "raw": clause.strip(), **_describe(rest)})
    return branches


def _split_clauses(text: str) -> list[str]:
    """Split on ';' and on ", or <status>" at brace depth 0."""
    out, depth, buf = [], 0, ""
    for ch in text:
        if ch in "{[(":
            depth += 1
        elif ch in "}])":
            depth -= 1
        if ch == ";" and depth == 0:
            out.append(buf)
            buf = ""
            continue
        buf += ch
    out.append(buf)
    final = []
    for clause in out:
        final.extend(re.split(r",\s+or\s+(?=\d{3}\b)", clause))
    return [c for c in final if c.strip()]


def _describe(rest: str) -> dict:
    """One status clause's body, as {kind, keys, optional, closed, typed, literals}."""
    base = {"kind": None, "keys": [], "optional": [], "closed": False,
            "typed": None, "literals": {}}
    low = rest.lower()

    if low.startswith("array"):
        base["kind"] = "array"
        after = rest[len("array"):].lstrip()
        if after.startswith("of "):
            tail = after[3:].lstrip()
            if tail.startswith("{"):
                group = _brace_group(tail)
                if group:
                    keys, optional, literals = _keys_and_literals(group[0])
                    base.update(element={"kind": "object", "keys": keys, "optional": optional,
                                         "closed": True, "typed": None, "literals": literals})
                    return base
            typed = _TYPED.match(tail)
            if typed:
                element = {"kind": "object", "keys": [], "optional": [], "closed": False,
                           "typed": typed.group(1), "literals": {}}
                after_type = tail[typed.end():].lstrip()
                if after_type.startswith("{"):
                    group = _brace_group(after_type)
                    if group is not None:
                        keys, optional, literals = _keys_and_literals(group[0])
                        element.update(keys=keys, optional=optional, closed=True,
                                       literals=literals)
                base.update(element=element)
                return base
            if tail.startswith("id strings") or tail.startswith("key strings"):
                base.update(element={"kind": "str", "keys": [], "optional": [], "closed": False,
                                     "typed": None, "literals": {}})
                return base
        base.update(element=None)
        return base

    if rest.startswith("{"):
        group = _brace_group(rest)
        if group is not None:
            keys, optional, literals = _keys_and_literals(group[0])
            base.update(kind="object", keys=keys, optional=optional, closed=True,
                        literals=literals)
            return base

    if low.startswith("object"):
        # An object whose keys are NOT the server's to promise — a plugin's own settings
        # map, for one. Stated openly rather than enumerated from one recording, because
        # enumerating it would turn one plugin's fields into a contract.
        base["kind"] = "object"
        return base

    if "body of null" in low or "body of literal `null`" in low or "carrying null" in low:
        base["kind"] = "null"
        return base
    if "no body" in low:
        base["kind"] = "none"
        return base
    if "carrying the stored json value" in low:
        base["kind"] = "any"
        return base
    if "x-ndjson" in low:
        base["kind"] = "ndjson"
        return base

    typed = _TYPED.match(rest)
    if typed:
        base.update(kind="object", typed=typed.group(1))
        after = rest[typed.end():].lstrip()
        if after.startswith("{"):
            group = _brace_group(after)
            if group is not None:
                keys, optional, literals = _keys_and_literals(group[0])
                base.update(keys=keys, optional=optional, closed=True, literals=literals)
        return base

    if re.match(r"^[A-Z][A-Za-z0-9]*\b", rest):          # a named type without .toJson
        base.update(kind="object", typed=rest.split()[0])
        return base

    base["kind"] = "unparsed"
    return base


def success_branches(row: dict) -> list[dict]:
    return [b for b in parse_response_shape(row.get("responseShape", "")) if 200 <= b["status"] < 300]


# --------------------------------------------------------------------------- #
# Matching a served path to a table row
# --------------------------------------------------------------------------- #

def _segments(path: str) -> list[str]:
    return [s for s in path.strip("/").split("/") if s]


def _is_param(seg: str) -> bool:
    return (seg.startswith("{") and seg.endswith("}")) or (seg.startswith("<") and seg.endswith(">"))


def match_rows(bare_path: str, table: dict) -> list[dict]:
    """Rows whose path template matches, most literal first.

    `/api/v1/shots/latest` matches both `/api/v1/shots/latest` and `/api/v1/shots/{id}`;
    the literal wins, exactly as shelf_plus's router picks the earlier registration.
    """
    want = _segments(bare_path)
    scored = []
    for row in table["rest"]:
        have = _segments(row["path"])
        if len(have) != len(want):
            continue
        literals = 0
        ok = True
        for h, w in zip(have, want):
            if _is_param(h):
                continue
            if h != w:
                ok = False
                break
            literals += 1
        if ok:
            scored.append((literals, row))
    if not scored:
        return []
    best = max(s for s, _ in scored)
    return [row for s, row in scored if s == best]


# --------------------------------------------------------------------------- #
# Handler-derived invariants
# --------------------------------------------------------------------------- #
#
# Three facts a key-level shape check cannot see, each read off the handler at the pin
# and each cited so the next reader can re-check it rather than trust it.

def invariants(row_id: str, body, params: dict[str, str]) -> list[str]:
    out = []

    if row_id == "getShotsLatest":
        # shots_handler.dart `_getLatestShot`: `jsonOk(shot?.toJsonWithoutMeasurements())`.
        # shot_record.dart `toJsonWithoutMeasurements` is `toJson` minus "measurements".
        if isinstance(body, dict) and "measurements" in body:
            out.append("carries `measurements`; _getLatestShot serves "
                       "toJsonWithoutMeasurements, which omits that key entirely")

    if row_id == "getShots":
        # shots_handler.dart `_getShots`: getShotsPaginated(limit: limit.clamp(1,100), …),
        # and shot_dao.dart `getShotsPaginated` ends `..limit(limit, offset: offset)` —
        # a SQL LIMIT. The paginated branch can never return more rows than it asked for.
        if isinstance(body, dict) and isinstance(body.get("items"), list):
            asked = params.get("limit")
            limit = int(asked) if asked and asked.isdigit() else 20
            served = min(max(limit, 1), 100)
            if len(body["items"]) > served:
                out.append(f"{len(body['items'])} items for limit={limit} (clamped {served}); "
                           "shot_dao.getShotsPaginated applies a SQL LIMIT, so the handler "
                           "cannot return more rows than it asked for")
            total = body.get("total")
            if isinstance(total, int) and total < len(body["items"]):
                out.append(f"total {total} < items {len(body['items'])}")
            for i, item in enumerate(body["items"]):
                if isinstance(item, dict) and "measurements" in item:
                    out.append(f"items[{i}] carries `measurements`; the paginated branch maps "
                               "toJsonWithoutMeasurements")
                    break

    if row_id == "getStoreByNamespace" and params.get("full") not in ("1", "true"):
        # kv_store_handler.dart: the bare namespace GET answers a list of key strings;
        # only ?full=1 answers {key: value}.
        if not isinstance(body, list):
            out.append("not an array of key strings; only ?full=1 answers an object")

    return out


# --------------------------------------------------------------------------- #
# The checks
# --------------------------------------------------------------------------- #

def finding(rule: str, subject: str, detail: str, fix: str = "") -> dict:
    return {"rule": rule, "subject": subject, "detail": detail, "fix": fix,
            "blocking": rule in BLOCKING}


def _kind_of(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, list):
        return "array"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, (int, float)):
        return "num"
    return "str"


def _shape_findings(row: dict, body, params: dict[str, str], subject: str) -> list[dict]:
    """One fixture against one row: kind, then keys, then the handler invariants."""
    out: list[dict] = []
    branches = success_branches(row)
    if not branches:
        return [finding("shape-unparsed", subject,
                        f"{row['id']}: no 2xx clause in responseShape {row['responseShape']!r}",
                        "the row's responseShape must state what a success looks like.")]
    if any(b["kind"] == "unparsed" for b in branches):
        raw = [b["raw"] for b in branches if b["kind"] == "unparsed"]
        return [finding("shape-unparsed", subject,
                        f"{row['id']}: cannot read the success clause {raw!r}",
                        "teach _describe() this form, or word the row the way the others are. "
                        "An unreadable clause is never treated as a pass.")]

    kind = _kind_of(body)
    accepted = {b["kind"] for b in branches}
    if "any" not in accepted and kind not in accepted:
        # `null` is accepted wherever the row states a null branch; nothing else is loose.
        return [finding("shape-kind", subject,
                        f"{row['id']}: fixture is {kind}, the table says {sorted(accepted)}",
                        f"responseShape: {row['responseShape']}")]

    for branch in branches:
        if branch["kind"] != kind:
            continue
        if kind == "object" and branch["closed"]:
            out += _key_findings(branch["keys"], branch["optional"], body, row, subject, "")
        if kind == "array":
            element = branch.get("element")
            if element and element["closed"]:
                for i, item in enumerate(body):
                    if not isinstance(item, dict):
                        out.append(finding("shape-kind", subject,
                                           f"{row['id']}: items[{i}] is {_kind_of(item)}, the table "
                                           "says an object", row["responseShape"]))
                        break
                    out += _key_findings(element["keys"], element["optional"], item, row,
                                         subject, f"items[{i}] ")
                    if out:
                        break
            if element and element["kind"] == "str":
                for i, item in enumerate(body):
                    if not isinstance(item, str):
                        out.append(finding("shape-kind", subject,
                                           f"{row['id']}: items[{i}] is {_kind_of(item)}, the table "
                                           "says a string", row["responseShape"]))
                        break
        break

    for detail in invariants(row["id"], body, params):
        out.append(finding("invariant", subject, f"{row['id']}: {detail}",
                           "the handler cannot produce this frame; the fixture is not a "
                           "recording of this route at the pin."))
    return out


def _key_findings(expected: list[str], optional: list[str], obj: dict, row: dict,
                  subject: str, where: str) -> list[dict]:
    out = []
    missing = [k for k in expected if k not in obj and k not in optional]
    extra = [k for k in obj if k not in expected]
    if missing:
        out.append(finding("keys-missing", subject,
                           f"{row['id']}: {where}missing {missing}", row["responseShape"]))
    if extra:
        out.append(finding("keys-extra", subject,
                           f"{row['id']}: {where}serves {extra}, which the table does not list",
                           row["responseShape"] + "  — the row enumerates the handler's keys, so an "
                           "extra key is the fixture describing a different server."))
    return out


def _keys_deep(value, out: set[str]) -> set[str]:
    if isinstance(value, dict):
        for key, sub in value.items():
            out.add(key)
            _keys_deep(sub, out)
    elif isinstance(value, list):
        for sub in value:
            _keys_deep(sub, out)
    return out


def _spelling_findings(table: dict, name: str, body) -> list[dict]:
    """A retired contract bug's spelling, alive inside a served frame.

    Gate D scans the CLIENT for these. Nothing scanned the frames the client is
    developed against — which is where `prewarmEnabled` was still sitting, in the one
    fixture a cup-warmer screen would be built against.

    KEYS ONLY, and deliberately: the table's patterns are written for source code
    (`\\.shots\\b` is a property access), and running them over a payload's TEXT
    manufactures findings out of data. The proof is in this very fixture set — the
    plugin registry advertises a permission literally named `events.shots`, which a raw
    text scan reports as CB-21 and which has nothing whatever to do with it. A frame's
    NAMES are its keys; its values are data. Each key is tested bare and dot-prefixed,
    so a response carrying a `shots` key still fires CB-21 — which is the shape the bug
    is actually about.
    """
    out = []
    keys = sorted(_keys_deep(body, set()))
    for rule in table.get("forbiddenSpellings", []):
        if rule.get("invert"):
            continue
        rx = re.compile(rule["pattern"])
        hit = [k for k in keys if rx.search(k) or rx.search(f".{k}")]
        if hit:
            out.append(finding("forbidden-spelling", name,
                               f"{rule['bug']}: the frame carries {hit} — {rule['why']}",
                               f"the checked contract is table row \"{rule['truth']}\"."))
    return out


def check_fixtures(table: dict, ledger: dict, fixtures_dir: pathlib.Path) -> tuple[list[dict], dict]:
    """Every fixture the mock can serve, against the table."""
    out: list[dict] = []
    # The buckets are DISJOINT and must sum to `fixtures`: a fixture counted twice, or
    # not at all, is how a checker reports coverage it does not have. test/
    # mock-contract.test.mjs asserts the sum on every run.
    stats = {"fixtures": 0, "routesChecked": 0, "vouched": 0, "unadopted": 0,
             "nonJson": 0, "ledgered": 0, "failed": 0}
    non_json = {e["fixture"]: e for e in ledger.get("nonJson", [])}
    unadopted = {e["fixture"]: e for e in ledger.get("unadopted", [])}
    declared = {e["fixture"]: e for e in ledger.get("findings", [])}
    seen: set[str] = set()

    for path_obj in sorted(fixtures_dir.glob("*.json")):
        name = path_obj.name
        stats["fixtures"] += 1
        seen.add(name)
        request = path_of(name)
        if mock_rea._key(request) != name:
            out.append(finding("fixture-name", name,
                               f"decodes to {request!r}, which the mock encodes back as "
                               f"{mock_rea._key(request)!r}",
                               "the fixture is named in a form the mock cannot serve."))
            stats["failed"] += 1
            continue
        bare, params = split_query(request)
        try:
            body = json.loads(path_obj.read_text())
        except Exception as exc:                                    # noqa: BLE001
            if name in non_json:
                stats["nonJson"] += 1
                continue
            out.append(finding("fixture-unparseable", name, f"not JSON ({exc})",
                               "declare it in the ledger's nonJson list with what it really is, "
                               "or drop it — the mock must not serve it as a JSON body."))
            stats["failed"] += 1
            continue

        rows = match_rows(bare, table)
        gets = [r for r in rows if r["verb"] == "GET"]
        unadopted_entry = unadopted.get(name)
        found: list[dict] = []
        if gets:
            # The table wins wherever it speaks. A ledger entry for a route the table
            # now covers would shadow the authority with a copy of it, so it is a
            # failure rather than a harmless duplicate.
            if unadopted_entry:
                out.append(finding("ledger-stale", name,
                                   f"the table now carries GET {bare} ({gets[0]['id']}); the "
                                   "ledger still declares it unadopted",
                                   "delete the ledger entry. Two records of one route drift."))
            stats["routesChecked"] += 1
            found += _spelling_findings(table, name, body)
            found += _shape_findings(gets[0], body, params, name)
        elif unadopted_entry:
            stats["routesChecked"] += 1
            found += _spelling_findings(table, name, body)
            found += _unadopted_shape_findings(unadopted_entry, body, name)
        elif rows:
            out.append(finding("verb-not-served", name,
                               f"{bare} is in the table only as "
                               f"{sorted({r['verb'] for r in rows})}; the mock serves it to GET",
                               "a GET fixture for a write-only route is a frame the server never "
                               "sends — unless the GET exists too, in which case check it against "
                               "its handler and record it."))
            stats["failed"] += 1
            continue
        else:
            out.append(finding("unvouched-route", name,
                               f"{bare} has no row in the contract table",
                               "check the route against its handler at the pin and record it — in "
                               "the table if the client adopts it, in the ledger's unadopted list "
                               "if it does not. A frame nobody checked is a frame that can lie."))
            stats["failed"] += 1
            continue

        entry = declared.get(name)
        rules = sorted({f["rule"] for f in found})
        if entry and rules == sorted(entry.get("rules", [])):
            stats["ledgered"] += 1
        elif entry:
            out.append(finding("ledger-stale", name,
                               f"the ledger records {sorted(entry.get('rules', []))}, the check "
                               f"now derives {rules}",
                               "re-open the handler, re-record the entry or delete it. A ledger "
                               "entry that no longer reproduces is a suppression, not evidence."))
            out += found
            stats["failed"] += 1
        elif found:
            out += found
            stats["failed"] += 1
        elif unadopted_entry:
            stats["unadopted"] += 1
        else:
            stats["vouched"] += 1

    for name in sorted(set(non_json) | set(unadopted) | set(declared)):
        if name not in seen:
            out.append(finding("ledger-stale", name,
                               "declared in the ledger but no such fixture exists",
                               "delete the entry, or restore the fixture."))
    return out, stats


def _unadopted_shape_findings(entry: dict, body, name: str) -> list[dict]:
    """An unadopted fixture still gets a shape check — against the ledger's own
    handler-read row, which carries the same columns a table row does."""
    pseudo = {"id": entry.get("id", name), "responseShape": entry["responseShape"],
              "path": entry["path"], "verb": entry.get("verb", "GET")}
    return _shape_findings(pseudo, body, {}, name)


def check_ledger(table: dict, ledger: dict, pin: str, rea_root: pathlib.Path,
                 source: bool = True) -> list[dict]:
    """The ledger is held to the table's own rules: stamped at the pin, and true of the
    handler at that pin. An exemption nobody can re-check is how coverage dies."""
    out = []
    if ledger.get("pinnedCommit") != pin:
        out.append(finding("ledger-unstamped", str(LEDGER_PATH.name),
                           f"pinnedCommit {ledger.get('pinnedCommit')} != {pin}",
                           "re-check every entry against the new commit before stamping it."))
    entries = [*ledger.get("nonJson", []), *ledger.get("unadopted", []),
               *ledger.get("findings", [])]
    for entry in entries:
        subject = entry["fixture"]
        if entry.get("checkedCommit") != pin:
            out.append(finding("ledger-unstamped", subject,
                               f"checkedCommit {entry.get('checkedCommit')} != {pin}",
                               "open the handler at the pin and re-check before stamping."))
        for column in ("handlerSymbol", "handlerFile", "evidence"):
            if not entry.get(column):
                out.append(finding("ledger-source", subject, f"no {column}",
                                   "an entry with no handler evidence is an opinion."))
    if not source:
        return out
    if not rea_root.exists():
        return out + [finding("ledger-source", str(rea_root),
                              "the pinned ReaPrime worktree is not present, so no ledger entry "
                              "can be re-verified",
                              "set REA_ROOT to a checkout at the pin, or pass --no-source and say "
                              "so in the record.")]
    cache: dict[str, str | None] = {}
    for entry in entries:
        rel = entry.get("handlerFile")
        if not rel:
            continue
        if rel not in cache:
            full = rea_root / rel
            cache[rel] = full.read_text() if full.exists() else None
        text = cache[rel]
        subject = entry["fixture"]
        if text is None:
            out.append(finding("ledger-source", subject, f"{rel} does not exist at the pin",
                               "re-anchor the entry by symbol."))
            continue
        template = re.sub(r"\{([^}]+)\}", r"<\1>", entry["path"].split("?")[0])
        if f"'{template}'" not in text:
            out.append(finding("ledger-source", subject,
                               f"{rel} does not register '{template}'",
                               "the route moved handlers, or the path is wrong."))
        symbol = entry["handlerSymbol"].split(".")[-1]
        symbol = re.match(r"_?[A-Za-z][A-Za-z0-9_]*", symbol)
        if symbol and symbol.group(0) not in text:
            out.append(finding("ledger-source", subject,
                               f"symbol \"{symbol.group(0)}\" not found in {rel}",
                               "re-anchor by symbol — line numbers and names both move."))
    return out


def check_live(ledger: dict, fixtures_dir: pathlib.Path) -> list[dict]:
    """ASK THE SERVER. The refusal wiring is checked by making the requests.

    Comparing the ledger with a re-derivation of itself would be a tautology dressed as
    a check — the "machinery that green-lights against a wrong reference" failure in
    miniature. So this starts `mock_rea` on an ephemeral port (never 8080; the two
    capture instruments own that and are sequential by design) and issues the actual
    GETs:

      * a fixture the ledger REFUSES must come back 410 carrying its evidence;
      * a recorded 404 page must come back 404 text/html, not 200 application/json;
      * a control fixture must still come back 200 application/json, because a mock
        that refuses everything would pass the first two rules and photograph nothing.

    The expectations come from the ledger under test and the answers from the live
    server, so the canary ledger (which refuses a fixture the real wiring serves) makes
    this fire.
    """
    out: list[dict] = []
    refuse = [e for e in ledger.get("findings", []) if e.get("disposition") == "refuse"]
    non_json = list(ledger.get("nonJson", []))
    if not refuse and not non_json:
        return out

    control = next((p.name for p in sorted(fixtures_dir.glob("*.json"))
                    if p.name not in {e["fixture"] for e in [*refuse, *non_json]}), None)
    try:
        httpd = mock_rea.start(port=0)
    except OSError as exc:                                          # noqa: BLE001
        return [finding("refusal-not-wired", "mock_rea",
                        f"the mock could not be started to check its wiring ({exc})",
                        "the refusal path is unverified; do not shoot.")]
    port = httpd.server_address[1]

    def get(path: str):
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("Content-Type", ""), e.read()

    try:
        for entry in refuse:
            path = path_of(entry["fixture"])
            status, ctype, body = get(path)
            if status != 410:
                out.append(finding("refusal-not-wired", entry["fixture"],
                                   f"GET {path} answered {status}; the ledger refutes this "
                                   "recording, so the mock must answer 410",
                                   "a frame the handler refutes must not reach a screenshot."))
            elif b"refuted" not in body:
                out.append(finding("refusal-not-wired", entry["fixture"],
                                   f"GET {path} answered 410 with no explanation in the body",
                                   "the refusal carries its evidence, or nobody can act on it."))
        for entry in non_json:
            path = path_of(entry["fixture"])
            want = entry.get("serveAs", {})
            status, ctype, _ = get(path)
            if status != want.get("status") or want.get("contentType", "") not in ctype:
                out.append(finding("envelope", entry["fixture"],
                                   f"GET {path} answered {status} {ctype}; the recording is "
                                   f"{want.get('status')} {want.get('contentType')}",
                                   "serve a recorded response as what it is — a 404 HTML page "
                                   "served as 200 JSON is the instrument rewriting a recording."))
        if control:
            path = path_of(control)
            status, ctype, _ = get(path)
            if status != 200 or "application/json" not in ctype:
                out.append(finding("refusal-not-wired", control,
                                   f"the control fixture GET {path} answered {status} {ctype}, "
                                   "not 200 application/json",
                                   "a mock that refuses everything passes every refusal rule and "
                                   "photographs nothing."))
    finally:
        httpd.shutdown()
        httpd.server_close()
    return out


def check_query_isolation() -> list[dict]:
    """ASK THE SERVER for a page it has no recording of.

    THE HOLE THIS CLOSES. Every other fixture rule reads a fixture off disk and derives
    the request from `path_of(name)` — the query in the fixture's OWN name. So the shots
    list was only ever checked at `limit=20`, the one query it is named for, while
    `mock_rea._resolve` fell back from an exact miss to any recording of the same
    endpoint and answered `?limit=5&offset=0&order=desc` with that same 20-row page:
    200, `limit` 20, `offset` 0. A rule that can only ask the question the answer was
    recorded for is not a check (E8, in miniature, inside the checker).

    So this makes the requests the fixture names do NOT cover: for every recording whose
    name embeds a query, the endpoint with the query stripped, and the recorded query
    with one more parameter on it. Neither has a fixture of its own — the loop skips any
    probe that does — so a 200 is proof that something answered from a different
    recording, and the fallback is back.

    It probes the set the SERVER serves (`mock_rea.FIXTURES`), not `--fixtures-dir`,
    because what is under test is the mock's resolution, not a canary corpus.
    """
    out: list[dict] = []
    served = mock_rea.FIXTURES
    probes: list[tuple[str, str]] = []
    for path_obj in sorted(served.glob("*~*.json")):
        recorded = path_of(path_obj.name)
        bare = recorded.split("?")[0]
        for probe in (bare, f"{recorded}&decalQueryProbe=1"):
            if (served / mock_rea._key(probe)).exists():
                continue                      # it has its own recording; 200 is honest
            probes.append((path_obj.name, probe))
    if not probes:
        return out

    try:
        httpd = mock_rea.start(port=0)
    except OSError as exc:                                          # noqa: BLE001
        return [finding("query-fallback", "mock_rea",
                        f"the mock could not be started to check query resolution ({exc})",
                        "resolution is unverified; do not shoot.")]
    port = httpd.server_address[1]
    try:
        for name, probe in probes:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}{probe}", timeout=5) as r:
                    status = r.status
            except urllib.error.HTTPError as e:
                e.read()
                status = e.code
            except Exception as exc:                                # noqa: BLE001
                out.append(finding("query-fallback", name,
                                   f"GET {probe} could not be made ({exc})",
                                   "resolution is unverified; do not shoot."))
                continue
            if status == 200:
                out.append(finding("query-fallback", name,
                                   f"GET {probe} answered 200; no fixture is named for that "
                                   f"request, so it was served from another recording",
                                   "`mock_rea._resolve` resolves EXACTLY. A query with no "
                                   "recording is a MISS (503) — a different page is a "
                                   "plausible answer standing where an absence belongs (A7)."))
    finally:
        httpd.shutdown()
        httpd.server_close()
    return out


def check_write_frames(table: dict) -> tuple[list[dict], int]:
    """The mock's answers to mutating verbs, against the same rows.

    A mock that answers every POST/PUT/DELETE `{"success": true}` teaches the client a
    field ReaPrime has never sent on any route. Each answer is now derived from the row —
    and where the row's success body cannot be stated without inventing values (a typed
    body like `ProfileRecord.toJson`), the mock refuses (501) rather than invent one.
    """
    out, checked = [], 0
    for row in table["rest"]:
        if row["verb"] in ("GET", "HEAD"):
            continue
        checked += 1
        path = re.sub(r"\{([^}]+)\}", "x", row["path"])
        status, body, ctype = mock_rea.write_response(path, row["verb"])
        branches = success_branches(row)
        if not branches:
            out.append(finding("shape-unparsed", row["id"],
                               f"no 2xx clause in {row['responseShape']!r}", ""))
            continue
        branch = branches[0]
        if status == 501:
            if synthesizable(branch):
                out.append(finding("write-frame", row["id"],
                                   f"the mock refuses {row['verb']} {row['path']}, but the row's "
                                   f"success body is stateable: {branch['raw']!r}",
                                   "synthesize it from the row rather than refusing."))
            continue
        if status != branch["status"]:
            out.append(finding("write-frame", row["id"],
                               f"the mock answers {status}, the handler answers {branch['status']}",
                               row["responseShape"]))
            continue
        if branch["kind"] == "none":
            if body:
                out.append(finding("write-frame", row["id"],
                                   f"the mock sends a body; the handler sends none ({branch['raw']!r})",
                                   row["responseShape"]))
            continue
        try:
            payload = json.loads(body or b"null")
        except Exception as exc:                                    # noqa: BLE001
            out.append(finding("write-frame", row["id"], f"the mock's body is not JSON ({exc})", ""))
            continue
        if branch["kind"] == "null":
            if payload is not None:
                out.append(finding("write-frame", row["id"],
                                   f"the mock sends {payload!r}; the handler sends null", ""))
            continue
        if branch["kind"] == "object":
            if not isinstance(payload, dict):
                out.append(finding("write-frame", row["id"],
                                   f"the mock sends {_kind_of(payload)}; the row says object", ""))
                continue
            # Re-tagged: a key mismatch found HERE is a fault in the mock's synthesized
            # frame, not in a recording, and the rule name is what a reader acts on.
            out += [{**f, "rule": "write-frame"}
                    for f in _key_findings(branch["keys"], branch["optional"], payload,
                                           row, row["id"], "the synthesized body ")]
            for key, value in branch["literals"].items():
                if payload.get(key) != value:
                    out.append(finding("write-frame", row["id"],
                                       f"{key}={payload.get(key)!r}; the handler writes {value!r}",
                                       row["responseShape"]))
    return out, checked


def check_socket_frames(table: dict, canary: str | None = None) -> tuple[list[dict], dict]:
    """Gate B rule 4, for the ten socket rows — CLOSED, by opening the sockets.

    WHAT WAVE 0b LEFT OPEN, in its own words: "Gate B rule 4 is closed for REST and open
    for sockets", because `mock_rea` spoke no WebSocket and the socket rows therefore had
    no instrument at all. This is that instrument. It starts the mock, performs ten real
    handshakes, reads what actually comes down each wire, and holds it to
    `ws_frames.SPECS` — which is the socket rows' `carries` column made checkable.

    FOUR THINGS IT ASKS, AND WHY EACH IS NOT A TAUTOLOGY:

      1. ROW PARITY. Every socket row has a served channel and every served channel has a
         row (`socket-unvouched`). A channel the table does not carry is exactly the
         "instrument invents surface" failure, one layer down from `unvouched-route`.
      2. KEY DRIFT. Every key the spec names must be read by the CLIENT module that reads
         that channel (`socket-key-drift`). The two documents are independent — the client
         is held to the table by Gate D, the mock by this — so a rename that reaches one
         and not the other turns red instead of quietly producing frames nobody reads.
      3. SHAPE, off the wire (`socket-shape`). Keys outside the vouched set, required keys
         missing, a DEAD name alive on a frame (CB-03's `milkTemperature`, CB-08's
         `weightFlow`), a derived channel written null where the row says derived channels
         are OMITTED — all read from the frames the server actually sent, not from the
         function that made them.
      4. CADENCE AND HISTORY (`socket-cadence`, `socket-history`). The 15 Hz loop proof is
         the reason the socket half exists, so the rate is measured rather than asserted,
         and the machine channel is checked to send NOTHING before its first step: a mock
         that hands over a backlog at connect would draw a chart the client never buffered
         and prove the loop against frames it never had to keep up with.

    The canaries (`--ws-canary`) bend one derivation at a time so each rule can be seen to
    bite; `test/mock-ws.test.mjs` runs them. They exist because a derived frame cannot be
    canaried with a wrong file on disk the way a fixture can.

    WHEN IT RUNS. Only against the SERVED fixture set (or with a canary), the same rule
    `check_query_isolation` follows and for the same reason: what is under test here is the
    mock's own socket half, not a canary corpus of REST recordings, and pointing
    `--fixtures-dir` at one says nothing about the sockets. It also keeps a timing-sensitive
    probe out of the twelve REST canary runs, where the whole tree's suites are competing
    for the box.
    """
    sys.path.insert(0, str(TOOLS))
    import ws_frames                                                # noqa: PLC0415

    out: list[dict] = []
    counts = {"socketRows": len(table.get("sockets", [])), "socketChannels": 0,
              "socketRowsServed": 0, "socketFrames": 0, "socketFramesRecorded": 0,
              "socketFramesDerived": 0, "socketFramesSession": 0, "socketSilent": 0}

    # -- 1. row parity ------------------------------------------------------ #
    row_ids = {row["id"] for row in table.get("sockets", [])}
    spec_ids = set(ws_frames.SPECS)
    for missing in sorted(row_ids - spec_ids):
        out.append(finding("socket-unvouched", missing,
                           "the contract table carries this socket row and the mock serves "
                           "no channel for it", "add it to ws_frames.SPECS or say why not."))
    for extra in sorted(spec_ids - row_ids):
        out.append(finding("socket-unvouched", extra,
                           "the mock serves a channel with no row in the contract table",
                           "an instrument that invents surface teaches the client a server "
                           "that does not exist (A7)."))
    for row in table.get("sockets", []):
        spec = ws_frames.SPECS.get(row["id"])
        if spec and spec["path"] != row["path"]:
            out.append(finding("socket-unvouched", row["id"],
                               f"the mock serves {spec['path']}, the row says {row['path']}", ""))

    # -- 2. key drift against the client's own readers ---------------------- #
    specs = ws_frames.SPECS
    # The canary bends the SPEC the drift rule reads, and only that one: a spec naming a
    # key no client reader mentions is exactly the drift this rule exists to see. The
    # frame checks below still read the real spec, so the canary fires one rule.
    drift_specs = {k: dict(v) for k, v in specs.items()}
    if canary == "key-drift":
        drift_specs["machineSnapshot"]["required"] = [
            *drift_specs["machineSnapshot"]["required"], "puckResistanceRenamedUpstream"]
    for row_id, spec in drift_specs.items():
        reader = spec.get("reader")
        if reader is None:
            continue
        text = pathlib.Path(reader).read_text()
        for key in [*spec["required"], *spec["optional"]]:
            # Either spelling the client can use: a quoted key (`readValue(frame, 'x')`,
            # a name table) or a property read (`frame.x`). What it may NOT do is never
            # mention the name at all, which is what a rename looks like from here.
            if not re.search(rf"""(['"]{re.escape(key)}['"]|\.{re.escape(key)}\b)""", text):
                out.append(finding("socket-key-drift", f"{row_id}.{key}",
                                   f"the mock sends `{key}` and {pathlib.Path(reader).name} "
                                   "never names it",
                                   "the client and the instrument are held to the table "
                                   "separately; a name that moved in one is a frame nobody "
                                   "reads in the other."))

    # -- 3/4. ask the server ------------------------------------------------ #
    # A probe script, not a served one: a fast cadence so the rate is measurable in half a
    # second, and the two UNSOURCED channels supplied so their shape can be checked at all.
    # Nothing scripted here reaches a capture run — `mock_rea` starts with its own defaults,
    # where those channels are silent.
    probe_rate = 25.0
    probe_window = 1.0
    script = ws_frames.Script({
        "rate": probe_rate,
        "timeline": [{"phase": "pre-shot", "frames": 4}, {"phase": "in-shot", "frames": 30},
                     {"phase": "post-shot", "seconds": 0.5}],
        "waterLevels": {"currentLevel": 60.0, "refillLevel": 5.0},
        "shotSettings": {"steamSetting": 0, "targetSteamTemp": 160, "targetSteamDuration": 45,
                         "targetHotWaterTemp": 98, "targetHotWaterVolume": 240,
                         "targetHotWaterDuration": 30, "targetShotVolume": 0, "groupTemp": 92.0},
        "sensors": "derived",
        "canary": canary,
    })
    try:
        httpd = mock_rea.start(port=0, script=script)
    except OSError as exc:                                          # noqa: BLE001
        return [finding("socket-unvouched", "mock_rea",
                        f"the mock could not be started to check its socket half ({exc})",
                        "the socket frames are unverified; do not shoot.")], counts
    port = httpd.server_address[1]
    sensor_id = "8549628789ABCDEF-puckestimator"
    results: dict[str, dict] = {}

    def probe(row_id: str, path: str):
        opened = time.monotonic()
        client = ws_frames.ProbeClient(port, path)
        messages = client.collect(probe_window)
        client.close()
        results[row_id] = {"opened": opened, "status": client.status, "ok": client.ok,
                           "messages": messages, "closed": client.closed_by_server}

    threads = []
    for row_id in ws_frames.UPGRADED_ROWS:
        path = ws_frames.SPECS[row_id]["path"]
        if row_id == "sensorSnapshot":
            path = f"/ws/v1/sensors/{sensor_id}/snapshot"
        t = threading.Thread(target=probe, args=(row_id, path), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join(timeout=10)

    # The plugin row is served BEFORE the upgrade, and that is the contract: 404, no 101.
    try:
        plugin = ws_frames.ProbeClient(port, "/ws/v1/plugins/time-to-ready.reaplugin/timeToReady")
        plugin_status = plugin.status
        plugin_upgraded = plugin.ok
        plugin.close()
    except Exception as exc:                                        # noqa: BLE001
        plugin_status, plugin_upgraded = f"unreachable ({exc})", False

    try:
        for row_id in ws_frames.UPGRADED_ROWS:
            spec = specs[row_id]
            result = results.get(row_id)
            if result is None:
                out.append(finding("socket-upgrade", row_id, "the probe never finished", ""))
                continue
            counts["socketChannels"] += 1
            if not result["ok"]:
                out.append(finding("socket-upgrade", row_id,
                                   f"the upgrade was answered {result['status']!r}",
                                   "every socket row but the plugin template answers 101."))
                continue
            frames = [m for _t, m in result["messages"]]
            counts["socketFrames"] += len(frames)
            source = spec["source"]
            counts["socketFramesRecorded" if source.startswith("recorded")
                   else "socketFramesDerived" if source == "derived"
                   else "socketFramesSession"] += len(frames)
            if not frames and source != "unsourced":
                out.append(finding("socket-shape", row_id,
                                   "the channel opened and sent nothing", ""))
            if row_id == "sensorSnapshot":
                # An id with a source streams; the checker's own probe id has one because
                # the script says `sensors: derived`. The unknown-id branch is checked in
                # test/mock-ws.test.mjs, where the close can be waited on.
                pass
            for frame in frames:
                out += _socket_frame_findings(row_id, spec, frame)
            if source == "unsourced" and not frames:
                counts["socketSilent"] += 1

        # cadence + history, on the channel the loop proof rides
        machine = results.get("machineSnapshot")
        if machine and machine["ok"] and len(machine["messages"]) >= 4:
            stamps = [t for t, _m in machine["messages"]]
            gaps = sorted(stamps[i + 1] - stamps[i] for i in range(len(stamps) - 1))
            median = gaps[len(gaps) // 2]
            want = 1.0 / probe_rate
            # Wide on purpose. The rule is "the rate is the one that was asked for", and
            # this runs beside the whole tree's suites, so the band has to be wider than
            # anything a loaded scheduler can explain — three times either way. The canary
            # is a factor of six, so it stays unambiguous.
            if not want / 3 <= median <= 3.0 * want:
                out.append(finding("socket-cadence", "machineSnapshot",
                                   f"median inter-frame gap {median * 1000:.1f} ms at a "
                                   f"requested {probe_rate:g} Hz ({want * 1000:.1f} ms)",
                                   "the 15 Hz loop proof reads this rate as truth."))
            # A backlog is OVER-DELIVERY: more frames than the requested rate can produce
            # in the time they arrived over. Two frames close together prove nothing — the
            # pump deliberately does not coalesce late steps, so a starved reader sees
            # exactly that — but a stream that delivers more than its own clock allows can
            # only be sending frames that predate the connection.
            span = stamps[-1] - stamps[0]
            allowed = span * probe_rate + 3            # +1 for the first frame, +2 slack
            if len(stamps) > allowed:
                out.append(finding("socket-history", "machineSnapshot",
                                   f"{len(stamps)} frames over {span * 1000:.0f} ms, which at "
                                   f"{probe_rate:g} Hz allows at most {allowed:.0f} — the "
                                   "channel handed over frames that predate the connection",
                                   "fire and forget: what the chart draws must be what the "
                                   "client buffered, or the loop is proved against frames it "
                                   "never had to keep up with."))
        elif machine and machine["ok"] and machine["messages"]:
            # Thin, not silent. A channel that sent NOTHING is a `socket-shape` failure
            # above; one that sent two frames where twenty were expected is a loaded box,
            # and failing the build on the box's load is how a guard gets switched off.
            out.append(finding("socket-thin", "machineSnapshot",
                               f"only {len(machine['messages'])} frames in "
                               f"{probe_window * 1000:.0f} ms at {probe_rate:g} Hz — too few "
                               "to measure the cadence from", ""))
        if plugin_upgraded:
            out.append(finding("socket-upgrade", "pluginEndpoint",
                               f"the plugin endpoint answered {plugin_status!r} — it accepted "
                               "an upgrade. No plugin payload is recorded, and ReaPrime "
                               "answers an unloaded plugin 404 BEFORE the upgrade",
                               "a socket that opens and then carries invented events is "
                               "worse than one that never opens."))
        else:
            counts["socketRowsServed"] = counts["socketChannels"] + 1
    finally:
        httpd.shutdown()
        httpd.server_close()
    return out, counts


def _socket_frame_findings(row_id: str, spec: dict, frame) -> list[dict]:
    """One frame off the wire against its row. Signals are not frames and are skipped."""
    sys.path.insert(0, str(TOOLS))
    import ws_frames                                                # noqa: PLC0415

    out: list[dict] = []
    if not isinstance(frame, dict):
        return [finding("socket-shape", row_id,
                        f"a message that is not a JSON object ({_kind_of(frame)})",
                        "`[]` is not a frame — it has every key absent (isFrameObject).")]
    # An error envelope, the scale's status envelope and a devices command result are
    # SIGNALS, classified before anything reads them as state (rea-ws-channels.js).
    if isinstance(frame.get("error"), str):
        return out
    if row_id == "scaleSnapshot" and isinstance(frame.get("status"), str) and "timestamp" not in frame:
        return out
    if row_id == "devices" and isinstance(frame.get("operation"), str):
        return out

    keys = set(frame)
    vouched = set(spec["required"]) | set(spec["optional"])
    for key in sorted(keys - vouched):
        out.append(finding("socket-shape", f"{row_id}.{key}",
                           f"the frame carries `{key}`, which the row does not vouch for",
                           spec["derivation"][:120]))
    for key in sorted(set(spec["required"]) - keys):
        out.append(finding("socket-shape", f"{row_id}.{key}",
                           f"the frame is missing `{key}`, which the handler writes",
                           spec["derivation"][:120]))
    for key in sorted(set(spec["forbidden"]) & keys):
        live, on = ws_frames.LIVE_OF.get(key, (key, "?"))
        out.append(finding("socket-shape", f"{row_id}.{key}",
                           f"the frame carries the DEAD name `{key}`; it lives at `{live}` "
                           f"on the {on} channel now",
                           "a recording that predates a rename is served with the dead key "
                           "DROPPED, never re-labelled and never passed through."))
    if spec.get("nonNullOptional"):
        for key in spec["optional"]:
            if key in frame and frame[key] is None:
                out.append(finding("socket-shape", f"{row_id}.{key}",
                                   "a derived channel written null; the row says derived "
                                   "channels are OMITTED, not null",
                                   "key presence IS the validity signal (rea-names.js)."))
    return out


def synthesizable(branch: dict) -> bool:
    """True when the row states the whole success body — no value has to be invented."""
    if branch["kind"] in ("none", "null"):
        return True
    if branch["kind"] == "object" and branch["closed"] and not branch["typed"]:
        return all(k in branch["literals"] for k in branch["keys"])
    return False


def check_coverage(table: dict, ledger: dict, fixtures_dir: pathlib.Path) -> list[dict]:
    """Rows the client consumes for which the mock has no usable recording.

    Reported, never blocking: the mock is allowed to be incomplete, and it records every
    miss at runtime. What it is not allowed to be is quietly wrong. A REFUSED recording
    counts as no recording here — the route answers 410, and a reader deciding what to
    record next needs to see it in the same list.
    """
    refused = {e["fixture"] for e in ledger.get("findings", [])
               if e.get("disposition") == "refuse"}
    out = []
    for row in table["rest"]:
        if row["verb"] != "GET" or row["status"] != "consumed":
            continue
        if "{" in row["path"]:
            continue
        fixture = mock_rea._resolve(row["path"], fixtures_dir=fixtures_dir)
        if fixture is None:
            # `_resolve` is exact (the endpoint fallback is deleted, A7), so a route whose
            # only recording embeds a query misses at the bare path. Name the recordings
            # that DO exist rather than say "no fixture": a reader deciding what to record
            # next needs the difference between nothing at all and one query form.
            endpoint = row["path"].strip("/").replace("/", "__")
            variants = sorted(p.name for p in fixtures_dir.glob(f"{endpoint}~*.json"))
            detail = (f"{row['path']} has no fixture; the mock answers it as a MISS (503)"
                      if not variants else
                      f"{row['path']} is recorded ONLY for {', '.join(variants)}; the mock "
                      "answers that exact query and every other one as a MISS (503)")
            out.append(finding("no-fixture", row["id"], detail,
                               "record one from a real ReaPrime when a screen needs it."))
        elif fixture.name in refused:
            out.append(finding("no-fixture", row["id"],
                               f"{row['path']} has only a REFUTED recording ({fixture.name}); "
                               "the mock answers it 410",
                               "re-record it; see tools/mock-fixture-ledger.json for what the "
                               "handler refutes."))
    return out


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def run(fixtures_dir: pathlib.Path, table_path: pathlib.Path, ledger_path: pathlib.Path,
        source: bool = True, ws_canary: str | None = None) -> dict:
    pin, rea_root = read_pin()
    table = load_table(table_path)
    ledger = load_ledger(ledger_path)

    findings: list[dict] = []
    if table["pinnedCommit"] != pin:
        findings.append(finding("table", table_path.name,
                                f"pinnedCommit {table['pinnedCommit']} != {pin}",
                                "Gate D owns this too; re-pin deliberately."))
    fixture_findings, stats = check_fixtures(table, ledger, fixtures_dir)
    findings += fixture_findings
    findings += check_ledger(table, ledger, pin, rea_root, source=source)
    findings += check_live(ledger, fixtures_dir)
    findings += check_query_isolation()
    write_findings, writes = check_write_frames(table)
    findings += write_findings
    # The socket rules probe what the SERVER serves, so they run when the served set is
    # what is under test — never against a REST canary corpus. See check_socket_frames.
    socket_counts: dict = {}
    if ws_canary or fixtures_dir.resolve() == mock_rea.FIXTURES.resolve():
        socket_findings, socket_counts = check_socket_frames(table, canary=ws_canary)
        findings += socket_findings
    findings += check_coverage(table, ledger, fixtures_dir)

    return {
        "ok": not any(f["blocking"] for f in findings),
        "pin": pin,
        "table": str(table_path),
        "ledger": str(ledger_path),
        "fixturesDir": str(fixtures_dir),
        "sourceChecked": source,
        "wsCanary": ws_canary,
        "counts": {**stats, "restRows": len(table["rest"]), **socket_counts,
                   "writeRowsChecked": writes,
                   "blocking": sum(1 for f in findings if f["blocking"]),
                   "reported": sum(1 for f in findings if not f["blocking"])},
        "findings": findings,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--fixtures-dir", default=str(mock_rea.FIXTURES),
                    help="the fixture set to check — the canaries point here")
    ap.add_argument("--table", default=str(TABLE_PATH))
    ap.add_argument("--ledger", default=str(LEDGER_PATH))
    ap.add_argument("--no-source", action="store_true",
                    help="skip re-reading the pinned worktree, and say so in the record")
    ap.add_argument("--ws-canary", default=None,
                    choices=["dead-key", "null-derived", "history-on-connect", "cadence",
                             "key-drift"],
                    help="bend one socket derivation on purpose, so its rule can be seen "
                         "to bite (a derived frame cannot be canaried with a file on disk)")
    a = ap.parse_args()

    try:
        report = run(pathlib.Path(a.fixtures_dir), pathlib.Path(a.table),
                     pathlib.Path(a.ledger), source=not a.no_source, ws_canary=a.ws_canary)
    except CheckError as exc:
        if a.json:
            print(json.dumps({"ok": False, "error": str(exc)}, indent=1))
        else:
            print(f"  MOCK CONTRACT CHECK CANNOT RUN — {exc}")
        return 2

    if a.json:
        print(json.dumps(report, indent=1))
        return 0 if report["ok"] else 1

    c = report["counts"]
    sockets = (f"{c['socketChannels']}/{c['socketRows']} socket channels "
               f"({c['socketFrames']} frames read off the wire)" if "socketRows" in c
               else "sockets NOT probed (a canary fixture set is not the served one)")
    print(f"  mock contract check — {c['routesChecked']} routes, {c['fixtures']} fixtures, "
          f"{c['writeRowsChecked']} write rows, {sockets}, "
          f"vs {pathlib.Path(report['table']).name} @ {report['pin'][:8]}")
    for f in report["findings"]:
        print(f"    [{'FAIL' if f['blocking'] else 'note'}] {f['rule']}: {f['subject']} — {f['detail']}")
        if f["fix"] and f["blocking"]:
            print(f"           -> {f['fix']}")
    print(f"  {c['vouched']} vouched, {c['unadopted']} unadopted-but-handler-checked, "
          f"{c['ledgered']} ledgered, {c['nonJson']} non-JSON, "
          f"{c['blocking']} blocking, {c['reported']} reported")
    if not report["sourceChecked"]:
        print("  NOTE: --no-source — the ledger's handler evidence was NOT re-read at the pin")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
