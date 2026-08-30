#!/usr/bin/env python3
"""selfcheck.py — the capture agent's preconditions, as a command.

SCOPE Part 10 §13: the three shadow-DOM adaptations "are built and tested in wf-w0a
with the rest of the rig", and "the capture agent's prompt lists all three as
PRECONDITIONS TO VERIFY PRESENT — in the style of the residue check — never as work
to do". This is that verification, plus the two data preconditions the same section
names (fixture parity, theme parity is the caller's).

Run it before any capture:

    python3 tools/selfcheck.py            # human output, non-zero exit on failure
    python3 tools/selfcheck.py --json     # machine output

THE RESIDUE CHECK deserves a note on how it is written. Adaptation 3 is "the
1920×1200-pinning, transform-stripping hack dies; any residue of it in the ported
battery is itself a finding". The banned identifier and the two element ids it
touched are assembled from fragments below so that this file — which has to talk
about them — does not trip its own scan, and so a scan for the identifier in PROSE
(the adaptation is documented in shadow_walk.py, and should be) is not confused with
a scan for the identifier in CODE. Only executable forms are flagged: a definition,
or a call passing it. The two element ids are banned outright: nothing in this tree
has any reason to name them.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import geometry            # noqa: E402
import mock_rea            # noqa: E402
import shadow_walk         # noqa: E402

# Assembled, never written whole — see the module docstring.
_BANNED_ID = "NEUTRA" + "LISE"
_BANNED_ELS = ["scaling-" + "container", "scaled-" + "content"]
_RESIDUE_CODE = [
    re.compile(rf"^\s*{_BANNED_ID}\s*=", re.M),      # a definition
    re.compile(rf"\(\s*{_BANNED_ID}\s*[,)]"),        # passed to something
    re.compile(rf"await\s+\w+\.?\w*\(\s*{_BANNED_ID}"),
]


def check_residue(scan_dir: pathlib.Path | None = None) -> dict:
    hits = []
    root = scan_dir or TOOLS
    for f in sorted(root.glob("*.py")):
        src = f.read_text()
        for rx in _RESIDUE_CODE:
            for m in rx.finditer(src):
                hits.append(f"{f.name}:{src[:m.start()].count(chr(10)) + 1} banned identifier in code")
        for el in _BANNED_ELS:
            if el in src and f.resolve() != pathlib.Path(__file__).resolve():
                hits.append(f"{f.name}: names the canvas element id '{el}'")
    return {"name": "adaptation 3 — no residue", "ok": not hits, "detail": hits}


def check_shadow_walk() -> dict:
    js = shadow_walk.WALK_JS
    problems = []
    if "shadowRoot" not in js:
        problems.append("WALK_JS does not recurse into shadowRoot")
    if "anchor" not in js:
        problems.append("WALK_JS records no anchor path")
    if "querySelectorAll('body *')" in js:
        problems.append("WALK_JS still uses the flat body-* query")
    if shadow_walk.ANCHOR_SEP.strip() != "▸":
        problems.append(f"anchor separator is {shadow_walk.ANCHOR_SEP!r}")
    return {"name": "adaptation 1 — shadow-piercing walk with anchor paths",
            "ok": not problems, "detail": problems}


def check_adopted_naming() -> dict:
    sheets = {"S1": {"sourceURL": "", "origin": "regular", "isConstructed": True},
              "S2": {"sourceURL": "http://h/styles/tokens.css", "origin": "regular"}}
    got_inner = shadow_walk.label_sheet(sheets, "S1", ".chip", "ui-button", ["live-screen", "chart-card"])
    got_host = shadow_walk.label_sheet(sheets, "S1", ":host([selected])", "ui-button", ["live-screen", "chart-card"])
    got_file = shadow_walk.label_sheet(sheets, "S2", "body", "div", [])
    problems = []
    if got_inner != "chart-card (adopted)":
        problems.append(f"inner rule labelled {got_inner!r}, want 'chart-card (adopted)'")
    if got_host != "ui-button (adopted)":
        problems.append(f":host rule labelled {got_host!r}, want 'ui-button (adopted)'")
    if got_file != "tokens.css":
        problems.append(f"linked sheet labelled {got_file!r}, want 'tokens.css'")
    return {"name": "adaptation 2 — constructed stylesheets named by owning tag",
            "ok": not problems, "detail": problems}


def check_geometry() -> dict:
    names = [g.name for g in geometry.CAPTURE_MATRIX]
    problems = []
    if names != ["bench", "desktop", "floor"]:
        problems.append(f"capture matrix is {names}")
    if (geometry.BENCH.width, geometry.BENCH.height, geometry.BENCH.dsf) != (1281, 801, 1.5):
        problems.append(f"bench geometry is {geometry.BENCH.label}")
    return {"name": "Gate B change 2 — geometry matrix", "ok": not problems,
            "detail": problems or [g.label for g in geometry.CAPTURE_MATRIX]}


def check_record_shape() -> dict:
    keys = shadow_walk.BASELINE_KEYS + shadow_walk.ADDED_KEYS
    return {"name": "record shape", "ok": len(set(keys)) == len(keys),
            "detail": [f"baseline {len(shadow_walk.BASELINE_KEYS)} keys "
                       f"+ added {shadow_walk.ADDED_KEYS}"]}


def check_perturbation() -> dict:
    """A count alone was not a check.

    It asserted `n > 40` and nothing else, so four tokens — the whole `--ui-elev-*`
    family and `--ui-tint-lever` — fell out of the derivation silently and the
    measurement grew two holes nobody could see. A token the derivation cannot
    perturb makes every property it drives read FROZEN, which is the exact shape of
    a false theming-hole finding, so an unexplained skip FAILS here. The two
    deliberate exclusions (var()/calc()-derived, motion) are named, not counted.
    """
    _, r = shadow_walk.build_perturb_js()
    problems = [f"UNPERTURBED: {s['token']} — {s['why']} ({s['value']})" for s in r["skipped"]]
    if r["overridden"] <= 40:
        problems.append(f"only {r['overridden']} tokens overridden — the sheets did not parse")
    return {"name": "token perturbation derived from styles/", "ok": not problems,
            "detail": problems + [
                f"{r['overridden']} of {r['tokens']} --ui-* tokens overridden",
                f"deliberately excluded: {len(r['derivedExcluded'])} var()/calc()-derived, "
                f"{len(r['motionExcluded'])} motion",
            ]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--residue-scan", default=None,
                    help="run ONLY the residue check, over this directory. The canary "
                         "(test/fixtures/canaries/) points here to prove the guard still bites.")
    a = ap.parse_args()

    if a.residue_scan:
        r = check_residue(pathlib.Path(a.residue_scan))
        print(json.dumps(r, indent=1) if a.json else
              f"[{'OK ' if r['ok'] else 'FAIL'}] {r['name']}\n" + "\n".join(f"  {d}" for d in r["detail"]))
        return 0 if r["ok"] else 1

    results = [check_residue(), check_shadow_walk(), check_adopted_naming(),
               check_geometry(), check_record_shape(), check_perturbation()]

    fx = mock_rea.check_fixtures(verbose=False)
    results.append({"name": "fixture parity (Part 10 §13 precondition)", "ok": fx["ok"],
                    "detail": [f"{fx['count']} fixtures vs {fx['recorded']} recorded hashes"]
                              + [f"missing={fx['missing']}"] * bool(fx["missing"])
                              + [f"changed={fx['changed']}"] * bool(fx["changed"])
                              + [f"extra={fx['extra']}"] * bool(fx["extra"])})
    ct = mock_rea.check_contract(verbose=False)
    counts = ct.get("counts", {})
    results.append({"name": "Gate B change 4 — mock contract-checked", "ok": ct["ok"],
                    "detail": [f"{ct.get('routes')} routes vs {ct.get('table')} "
                               f"@ {str(ct.get('pin'))[:8]}",
                               f"{counts.get('vouched')} vouched, "
                               f"{counts.get('unadopted')} unadopted-but-handler-checked, "
                               f"{counts.get('ledgered')} ledgered, "
                               f"{counts.get('nonJson')} non-JSON"]
                              + ct.get("failures", [])})

    ok = all(r["ok"] for r in results)
    if a.json:
        print(json.dumps({"ok": ok, "checks": results}, indent=1))
    else:
        for r in results:
            print(f"  [{'OK ' if r['ok'] else 'FAIL'}] {r['name']}")
            for d in r["detail"]:
                print(f"         {d}")
        print("selfcheck:", "OK" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
