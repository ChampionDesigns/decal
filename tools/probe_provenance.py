#!/usr/bin/env python3
"""Measure, for every visible control in every Decal state:

  1. WHICH stylesheet + rule wins each appearance property  (CDP CSS domain)
  2. WHETHER the property moves when the design tokens are drastically perturbed at
     :root (the "temp skin" test, done at runtime)

Output: one JSON per state under --out-dir, plus screenshots before/after
perturbation, plus SHEETS.json — the same shape as the audit corpus in
`slate-audit-2026-08-16/prov-baseline/`, which is the other half of the final
review's comparison. Read-only with respect to the Slate tree and the corpora.

TWO SUBJECT SETS, `--subjects gallery` (the default) AND `--subjects app`. The probe
walked only the component gallery until fix run 7, so no instrument in this tree could
by itself produce per-element provenance for the APP SCREEN states — the very records
SCOPE Part 10 §13's structural comparison anchors on, and the ones this file's own first
line claims ("every Decal state"). The final review needed them, found the tree FROZEN,
and bridged the gap from outside it: `realine-run/waves/final/screens_prov_driver.py`
imported `capture_state` from here and drove `tools/screens/index.html` the way
`capture_battery.py --subjects app` does. That bridge is now FOLDED IN — the tree is not
frozen any more, and a measurement instrument that lives beside the corpus it wrote is
one nobody can re-run. Everything the app walk needs came with it unchanged: the settle
protocol (`screensSettled === '1'`, 120 s, then `window.__screens.settle()`), the two
per-state socket mocks (park / shot, the battery's own scripts), a fresh document per
state, the `geometries:` declaration a state may make, the idempotent three-file skip,
and the same output shape. The measurement itself is `capture_state`, unmodified and
shared by both walks, which is the point of folding rather than re-implementing.

THE GALLERY PATH IS UNTOUCHED BY THE FOLD, deliberately: same states, same settle key,
same 45 s timeout, no per-state mocks, no resume skip, and a `RUN.json` with exactly the
keys it had. A fold that quietly reshaped the corpus it already wrote would invalidate
the comparison it exists to serve.

Ported from the audit's `probe_provenance.py` with the three shadow-DOM adaptations
of SCOPE Part 10 §13, all of which live in `shadow_walk.py`:

  1. the element walk pierces shadow roots and records an ANCHOR PATH per element
     (`live-screen ▸ chart-card ▸ ui-button "1:1"`), which the comparison uses as
     identity — a Lit tree has no stable `body *` index to compare on;
  2. constructed stylesheets are named by their owning component tag, so a
     provenance row reads `chart-card (adopted)` rather than an empty string;
  3. the pinning hack is gone, and `selfcheck.py` fails if it reappears.

RECORD SHAPE vs THE BASELINE CORPUS: identical keys, plus `anchor` and `hosts`.
Nothing is removed and nothing is renamed — the corpus is the oracle and a reshaped
record would silently invalidate it.

THE PERTURBATION IS DERIVED, NOT LISTED. The audit's probe hard-coded ~90
`--slate-*` overrides; this one reads `styles/tokens.css` and
`styles/chart-channels.css` and perturbs every `--ui-*` token it finds that is not
itself derived from another token. A token added next week is therefore covered the
first time this runs, which is what makes the token-adoption measurement (Part 10
§13) mean something a year from now: an authored component whose colour or type
property stays FROZEN under this is a theming hole. Structural geometry that no
token drives is legitimately frozen and the numbers say which is which. Which tokens
it moved — and any it could NOT — go into `RUN.json` under `perturbation`, because a
token the derivation misses manufactures exactly the finding the measurement exists
to detect.

PRECONDITIONS ABORT, THEY DO NOT ANNOTATE. Fixture parity and the mock's contract
check both run before the first shot and raise; a corpus written first and labelled
`"parity": false` afterwards is a poisoned corpus with a footnote.

    python3 tools/probe_provenance.py --out-dir /tmp/prov --theme dark
    python3 tools/probe_provenance.py --out-dir /tmp/prov-app --theme dark --subjects app
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import json
import pathlib
import sys

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import cdp as cdplib       # noqa: E402
import geometry            # noqa: E402
import mock_rea            # noqa: E402
import selfcheck           # noqa: E402
import shadow_walk as sw   # noqa: E402

REPO = TOOLS.parent
APP_PORT, CDP_PORT = 8842, 9382          # fixed, and deliberately not the battery's
GALLERY = "/tools/gallery/index.html"
SCREENS = "/tools/screens/index.html"

#: The app walk's two socket scripts, byte-identical to `capture_battery.py`'s
#: SCREEN_SCRIPTS and carried as DATA rather than imported. Importing the battery to
#: reach one dict would pull its argparse module in and leave an untracked
#: `capture_battery.cpython-3xx.pyc` beside seven tracked ones — the driver this walk
#: was folded from refused the import for that reason and so does the fold.
#:
#: One mock process holds ONE socket script and the walk needs two: a server parked on
#: `machinePicker` (B8's park, which no unparked server produces) and a server playing
#: the recorded shot at the rate its samples were recorded at. Each state names the one
#: it needs; `tools/screens/screens.js` is where it says so.
SCREEN_SCRIPTS = {
    "park": {"timeline": [{"phase": "idle"}],
             "devices": {"pendingAmbiguity": "machinePicker", "connected": []}},
    "shot": {"rate": 15,
             "timeline": [{"phase": "pre-shot", "frames": 12},
                          {"phase": "in-shot", "frames": 220},
                          {"phase": "post-shot", "seconds": 1}]},
}


def _free_port() -> int:
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_screen_mocks():
    """One `tools/mock_rea.py` SUBPROCESS per socket script — the battery's pattern.

    Subprocesses rather than `mock_rea.start(script=…)` in this process, because the
    socket script is class state on `MockRea`: two in-process servers would share one
    script and the park would leak into the shot run. Started before the browser and
    stopped after it whatever happens in between, so a killed run does not leave two
    mocks holding ports for the next one to trip over.
    """
    import subprocess
    import tempfile
    import time
    import urllib.request

    ports, procs = {}, []
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="decal-prov-screens-"))
    for name, script in SCREEN_SCRIPTS.items():
        path = tmp / f"{name}.json"
        path.write_text(json.dumps(script))
        port = _free_port()
        procs.append(subprocess.Popen(
            [sys.executable, "tools/mock_rea.py", "--port", str(port), "--ws-script", str(path)],
            cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE))
        ports[name] = port

    def stop():
        for proc in procs:
            proc.kill()

    deadline = time.time() + 30
    for name, port in ports.items():
        while True:
            if time.time() > deadline:
                stop()
                raise SystemExit(f"the {name!r} mock never came up on {port}")
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/info", timeout=2).read()
                break
            except Exception:                                   # noqa: BLE001
                time.sleep(0.1)
    print(f"  screens mocks: {', '.join(f'{n} on {p}' for n, p in ports.items())}")
    return ports, stop


def winner_for(matched, inline_style, attr_style):
    """Resolve, per property, the declaration that actually wins.

    `matched` is CDP's matchedCSSRules, ordered least->most precedent. Later entries
    beat earlier ones; an !important declaration beats every normal one. Inline style
    sits above all matched rules (normal), and an inline !important beats everything.

    Unchanged from the audit's probe, including inside shadow roots:
    `CSS.getMatchedStylesForNode` resolves there too, which is why per-property
    provenance still fills for a Lit component (Part 10 §13).
    """
    res = {}

    def consider(prop, value, important, origin, selector, rule_origin=""):
        cur = res.get(prop)
        if cur and cur["important"] and not important:
            return
        res[prop] = {"value": value, "important": important, "origin": origin,
                     "selector": selector, "ruleOrigin": rule_origin}

    for entry in matched:
        rule = entry.get("rule", {})
        sel = ", ".join(s.get("text", "") for s in rule.get("selectorList", {}).get("selectors", []))[:160]
        sid = rule.get("styleSheetId", "")
        rorigin = rule.get("origin", "")
        for p in rule.get("style", {}).get("cssProperties", []):
            name = p.get("name")
            if name in sw.PROPS and "value" in p and not p.get("disabled"):
                consider(name, p["value"], bool(p.get("important")), sid, sel, rorigin)
    for src, style in (("<attr>", attr_style), ("<inline>", inline_style)):
        if not style:
            continue
        for p in style.get("cssProperties", []):
            name = p.get("name")
            if name in sw.PROPS and "value" in p and not p.get("disabled"):
                consider(name, p["value"], bool(p.get("important")), src, src, "inline")
    return res


async def capture_state(cdp, name: str, out_dir: pathlib.Path, results: dict, g,
                        labels: dict, perturb_js: str, shots=True):
    els = await cdp.js(sw.WALK_JS)
    if not els:
        print(f"   {name}: NO ELEMENTS")
        return None

    # One nodeId per element, resolved THROUGH the shadow boundary. DOM.querySelectorAll
    # would only ever return the light-DOM hosts (adaptation 1).
    prov = {}
    for e in els:
        nid = await cdp.node_id(f"window.__probeEls[{e['i']}]")
        if not nid:
            continue
        ms = await cdp.send("CSS.getMatchedStylesForNode", nodeId=nid)
        if "__error" in ms:
            continue
        w = winner_for(ms.get("matchedCSSRules", []), ms.get("inlineStyle"), ms.get("attributesStyle"))
        row = {}
        for p, d in w.items():
            label = sw.label_sheet(cdp.sheets, d["origin"], d["selector"], e["tag"],
                                   e["hosts"], d.get("ruleOrigin", ""))
            # Remember what each styleSheetId turned out to be, so SHEETS.json can
            # name the constructed sheets too. A sheet id's owning component is only
            # knowable from an element that matched it (adaptation 2), so the index
            # is filled in as the walk discovers it, not up front.
            if not d["origin"].startswith("<") and label.endswith("(adopted)"):
                labels.setdefault(d["origin"], label)
            row[p] = {"v": d["value"], "imp": d["important"], "sheet": label, "sel": d["selector"]}
        prov[str(e["i"])] = row

    before = {str(e["i"]): e["style"] for e in els}
    if shots:
        await cdp.screenshot(out_dir / f"{name}--base.png", g)

    await cdp.js(perturb_js)
    await cdp.js("new Promise(r => setTimeout(r, 500))")
    after = await cdp.js(sw.FINGERPRINT_JS) or {}
    if shots:
        await cdp.screenshot(out_dir / f"{name}--perturbed.png", g)
    await cdp.js(sw.UNPERTURB_JS)
    await cdp.js("new Promise(r => setTimeout(r, 300))")

    for e in els:
        k = str(e["i"])
        a = after.get(k, {})
        e["moved"] = sorted(p for p in sw.PROPS if a.get(p) != before[k].get(p))
        e["frozen"] = sorted(p for p in sw.PROPS if a.get(p) == before[k].get(p))
        e["prov"] = prov.get(k, {})

    results[name] = els
    (out_dir / f"{name}.json").write_text(json.dumps(els, indent=1))
    frozen_ctl = sum(1 for e in els if e["tag"] in ("button", "select", "input") and not e["moved"])
    adopted = sum(1 for e in els for d in e["prov"].values() if d["sheet"].endswith("(adopted)"))
    print(f"   {name}: {len(els)} els, {frozen_ctl} fully-frozen controls, "
          f"{adopted} property decisions from adopted sheets")
    return els


async def run(out_dir: pathlib.Path, only: str | None, theme: str, g,
              app_port: int = APP_PORT, cdp_port: int = CDP_PORT,
              fixture_drift: bool = False, subjects: str = "gallery") -> dict:
    # THE TWO DATA PRECONDITIONS, ASSERTED — not merely measured.
    #
    # Part 10 §13: "Two preconditions the capture agent asserts before the first
    # shot, because either one silently poisons every comparison after it: fixture
    # parity … and theme parity." This used to call check_fixtures() and then walk
    # straight into start_or_reuse(), so a drifted set was recorded as
    # `"parity": false` in RUN.json AFTER the shots were already on disk — the
    # poisoned corpus was written and nothing stopped it. It never ran the contract
    # check at all, though the probe drives the same mock the battery does.
    # Both now abort BEFORE the first shot, as the battery already did.
    checks = mock_rea.check_fixtures()
    if not checks["ok"] and not fixture_drift:
        raise SystemExit("fixture parity failed — re-run `python3 tools/mock_rea.py --rehash` "
                         "deliberately, or pass --allow-fixture-drift")
    contract = mock_rea.check_contract()
    if not contract["ok"]:
        raise SystemExit("contract check failed — the mock's payload shapes no longer match "
                         f"{contract.get('table')}; a probe run against it would measure a lie")
    # Derived once, not per state: it depends only on the token sheets, and RUN.json
    # has to record which tokens it moved and which it could not (Part 10 §13, the
    # token-adoption measurement). Checked here, with the other preconditions and
    # before anything is started, because a token the derivation misses is not a
    # smaller problem than a drifted fixture — it manufactures the exact finding the
    # measurement exists to produce.
    perturb_js, perturbation = sw.build_perturb_js()
    if perturbation["skipped"]:
        raise SystemExit(
            "the perturbation cannot cover " + ", ".join(s["token"] for s in perturbation["skipped"])
            + " — every property those tokens drive would read FROZEN and file as a false "
              "theming hole. Fix build_perturb_js() before shooting.")

    mock_rea.start_or_reuse()

    # The app walk's own servers, started before the browser and stopped after it in the
    # `finally` below — a killed run that leaves two mocks holding ports is the next run's
    # "port is busy but not answering" abort. The gallery walk starts none.
    mocks, stop_mocks = _start_screen_mocks() if subjects == "app" else ({}, lambda: None)

    results: dict = {}
    labels: dict[str, str] = {}      # styleSheetId -> discovered name (adaptation 2)
    walked: list[str] = []
    already: list[str] = []
    declined: list[str] = []
    unsettled: list[dict] = []
    try:
        async with cdplib.Session(app_port, cdp_port, REPO, width=g.width, height=g.height) as s:
            cdp = s.cdp
            await cdp.set_geometry(g)
            if subjects == "app":
                # THE APP WALK, as the final review's bridge drove it — see the header. Loaded
                # with no `?state=`, the page mounts nothing and only publishes its registry,
                # which is what lets this learn which MOCK each state needs before it drives
                # anything.
                await cdp.navigate(f"{s.base}{SCREENS}")
                if not await cdp.wait_for("!!window.__screens"):
                    raise SystemExit("the screens page did not load — tools/screens/index.html")
                states = await cdp.js("window.__screens.states()") or []
                if only:
                    states = [st for st in states if only in st["id"]]
                if not states:
                    raise SystemExit(f"no app states matched --only {only!r}")
                print(f"  theme {theme}: {len(states)} screens states at {g.label}")

                for st in states:
                    sid = st["id"]
                    # A state MAY declare the geometries at which it is meaningful; captured
                    # elsewhere it does not produce a weaker record, it produces a FALSE one.
                    want = st.get("geometries")
                    if want and g.name not in want:
                        declined.append(sid)
                        print(f"   -- {sid} not captured here (declared for {', '.join(want)})")
                        continue
                    # IDEMPOTENT RESUME: a state whose three output files are already on disk
                    # is skipped, and the inventory below is the same either way.
                    if all((out_dir / f).exists()
                           for f in (f"{sid}.json", f"{sid}--base.png", f"{sid}--perturbed.png")):
                        already.append(sid)
                        print(f"   == {sid} already on disk — skipped (idempotent resume)")
                        continue
                    port = mocks[st.get("mock", "shot")]
                    # A fresh document per state, with the geometry already in force. The
                    # timeout is minutes rather than the gallery's 45 s because a state like
                    # `live--post-shot` waits for a recorded shot to play over a real socket,
                    # and a state that has not settled must never be measured early.
                    await cdp.navigate(
                        f"{s.base}{SCREENS}?state={sid}&theme={theme}&mock={port}", settle=0.6)
                    if not await cdp.wait_for("document.body.dataset.screensSettled === '1'",
                                              timeout=120):
                        fault = await cdp.js("document.body.dataset.screenFault || ''")
                        unsettled.append({"id": sid, "fault": fault or "never settled in 120s"})
                        print(f"   !! {sid} never settled — {fault!r}")
                        continue
                    await cdp.js("window.__screens.settle()")
                    await capture_state(cdp, sid, out_dir, results, g, labels, perturb_js)
                    walked.append(sid)
            else:
                await cdp.navigate(f"{s.base}{GALLERY}?theme={theme}")
                if not await cdp.wait_for("!!window.__gallery"):
                    raise SystemExit("gallery did not load — tools/gallery/index.html")
                await cdp.js("window.__gallery.ready")
                states = await cdp.js("window.__gallery.states()") or []
                if only:
                    states = [st for st in states if only in st["id"]]
                if not states:
                    raise SystemExit(f"no gallery states matched --only {only!r}")
                print(f"  {len(states)} states, theme {theme}, {g.label}")

                for st in states:
                    # A fresh document per state, with the geometry already in force.
                    await cdp.navigate(f"{s.base}{GALLERY}?state={st['id']}&theme={theme}", settle=0.6)
                    if not await cdp.wait_for("document.body.dataset.gallerySettled === '1'", timeout=45):
                        print(f"   {st['id']}: never settled — skipped")
                        continue
                    await cdp.js("window.__gallery.settle()")
                    await capture_state(cdp, st["id"], out_dir, results, g, labels, perturb_js)
                    walked.append(st["id"])

            sheets = {sid: labels.get(sid) or sw.label_sheet(cdp.sheets, sid, "", "", [])
                      for sid in cdp.sheets}
            sheets_file = out_dir / "SHEETS.json"
            if subjects == "app" and sheets_file.exists() and not walked:
                pass                    # fully-resumed run: keep the original session's index
            else:
                sheets_file.write_text(json.dumps(sheets, indent=1))
    finally:
        stop_mocks()

    if subjects == "app":
        # The app walk's OWN run record — the bridge's, key for key, with `tool` naming
        # the folded instrument instead of the scaffolding it came from.
        (out_dir / "RUN.json").write_text(json.dumps({
            "tool": "tools/probe_provenance.py --subjects app "
                    "(folded from realine-run/waves/final/screens_prov_driver.py, fix run 7; "
                    "measurements by capture_state + tools/shadow_walk.py, unchanged)",
            "subjects": "app screens (tools/screens/), driven the way capture_battery.py "
                        "--subjects app drives them",
            "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "theme": theme,
            "geometry": {"name": g.name, "width": g.width, "height": g.height,
                         "deviceScaleFactor": g.dsf},
            "states": sorted(walked + already),
            "walkedThisRun": sorted(walked),
            "alreadyOnDisk": sorted(already),
            "declinedGeometry": declined,
            "unsettled": unsettled,
            "recordKeys": sw.BASELINE_KEYS + sw.ADDED_KEYS,
            "recordShapeDelta": {"added": sw.ADDED_KEYS, "removed": [], "renamed": []},
            "fixtures": {"count": checks["count"], "parity": checks["ok"],
                         "contract": {k: contract.get(k) for k in ("ok", "table", "routes")}},
            "perturbation": perturbation,
            "raster": {"shotScale": cdplib.SHOT_SCALE,
                       "pngSize": [int(g.width * cdplib.SHOT_SCALE), int(g.height * cdplib.SHOT_SCALE)],
                       "note": "audit prov-baseline/ shot at 0.5 (960x600); declared departure, cdp.SHOT_SCALE"},
            "themeParity": f"compare {theme} captures against "
                           f"{'prov-baseline/' if theme == 'dark' else 'prov-light/'}, never crossed",
        }, indent=1) + "\n")
        print(f"\n{len(results)} states -> {out_dir}")
        return results

    (out_dir / "RUN.json").write_text(json.dumps({
        "tool": "tools/probe_provenance.py",
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "theme": theme,
        "geometry": {"name": g.name, "width": g.width, "height": g.height, "deviceScaleFactor": g.dsf},
        "states": sorted(results),
        "recordKeys": sw.BASELINE_KEYS + sw.ADDED_KEYS,
        "recordShapeDelta": {"added": sw.ADDED_KEYS, "removed": [], "renamed": []},
        "fixtures": {"count": checks["count"], "parity": checks["ok"],
                     "driftAllowed": bool(fixture_drift and not checks["ok"]),
                     "contract": {k: contract.get(k) for k in ("ok", "table", "provisional", "routes")}},
        "perturbation": perturbation,
        # The PNG raster, stated rather than measured. The audit's probe shot at
        # scale 0.5 (960×600); this one shoots at cdp.SHOT_SCALE, which is 1 — see
        # the constant for why, and for the one number that reverses it.
        "raster": {"shotScale": cdplib.SHOT_SCALE,
                   "pngSize": [int(g.width * cdplib.SHOT_SCALE), int(g.height * cdplib.SHOT_SCALE)],
                   "note": "audit prov-baseline/ shot at 0.5 (960x600); declared departure, cdp.SHOT_SCALE"},
        "themeParity": f"compare {theme} captures against "
                       f"{'prov-baseline/' if theme == 'dark' else 'prov-light/'}, never crossed",
    }, indent=1) + "\n")
    print(f"\n{len(results)} states -> {out_dir}")
    return results


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--only", default=None)
    ap.add_argument("--theme", default="dark", choices=("dark", "light"))
    ap.add_argument("--subjects", default="gallery", choices=("gallery", "app"),
                    help="gallery = tools/gallery/ (the default, unchanged); "
                         "app = the SCREEN states in tools/screens/, the walk folded in "
                         "from the final review's screens_prov_driver.py")
    ap.add_argument("--width", type=int, default=geometry.DESKTOP.width)
    ap.add_argument("--height", type=int, default=geometry.DESKTOP.height)
    ap.add_argument("--dsf", type=float, default=None,
                    help="deviceScaleFactor; defaults to the matrix entry matching --width/--height")
    ap.add_argument("--geometry", default=None, help="bench|desktop|floor, instead of --width/--height")
    ap.add_argument("--allow-fixture-drift", action="store_true",
                    help="the one legitimate case: you just re-recorded fixtures on purpose. "
                         "RUN.json says so.")
    ap.add_argument("--app-port", type=int, default=APP_PORT)
    ap.add_argument("--cdp-port", type=int, default=CDP_PORT,
                    help="fixed by default — the instruments are sequential by design; "
                         "override only to step around a stale browser holding the port")
    a = ap.parse_args()

    if a.geometry:
        g = geometry.select(a.geometry)[0]
    else:
        match = [x for x in geometry.CAPTURE_MATRIX if (x.width, x.height) == (a.width, a.height)]
        dsf = a.dsf if a.dsf is not None else (match[0].dsf if match else 1.0)
        g = geometry.Geometry(name=match[0].name if match else "custom",
                              width=a.width, height=a.height, dsf=dsf)

    print("  preconditions (Part 10 §13):")
    # The residue/adaptation half runs here; the fixture-parity and contract halves
    # run inside `run()`, where RUN.json can record their result — and where they
    # ABORT rather than being noted after the fact.
    results = [selfcheck.check_residue(), selfcheck.check_shadow_walk(),
               selfcheck.check_adopted_naming(), selfcheck.check_geometry(),
               selfcheck.check_perturbation()]
    for r in results:
        print(f"    [{'OK ' if r['ok'] else 'FAIL'}] {r['name']}")
        if not r["ok"]:
            for d in r["detail"]:
                print(f"           {d}")
    if not all(r["ok"] for r in results):
        raise SystemExit("selfcheck failed — see `python3 tools/selfcheck.py`")

    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    asyncio.run(run(out, a.only, a.theme, g, a.app_port, a.cdp_port, a.allow_fixture_drift,
                    a.subjects))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
