#!/usr/bin/env python3
"""Gate B — capture every reachable state, every theme, at the geometry matrix.

Ported from `review/tools/capture_battery.py` (Slate's, read-only) with the four
changes SCOPE Part 8 §2 Gate B specifies. Same CLI shape as the original:

    python3 tools/capture_battery.py --out-dir /tmp/shots

One Chrome session per theme, sequential navigation, one PNG per state per geometry
— the input to a visual review. SEQUENTIAL ON PURPOSE: the probes share fixed ports,
so a parallel reviewer fleet reads these files instead of racing to render its own.
(The Gate A rendering harness is the opposite — ephemeral port, fresh profile — and
that asymmetry is deliberate; see `cdp.py`.)

THE FOUR CHANGES:

1. THE PINNING HACK DIES WITH THE CANVAS. The original stripped a scaling transform
   and pinned a fixed-size canvas element before every shot. Decal has nothing to
   neutralise: there is no scaling wrapper and no transform. `selfcheck.py` fails if
   any residue of that hack reappears in this directory, and this battery runs the
   check before its first shot rather than trusting that it stayed gone.

2. EACH STATE IS CAPTURED AT THE GEOMETRY MATRIX, NOT ONE SIZE: 1281×801 @ dsf 1.5
   (bench), 1920×1200 (desktop), 1000×600 (floor). The numbers are read from
   `test/harness/geometry.js` so Gate A and Gate B cannot disagree about what the
   bench is (`geometry.py`). Each geometry is set BEFORE navigation and the state is
   loaded fresh into it — the dsf-1.5 spike measured that a dpr applied after the
   modules evaluate leaves `devicePixelRatio` at 1 while the raster is 1.5.

3. THE FIRST BASELINE IS A REVIEW, NOT A DIFF. Below design size there is no old-app
   oracle at all, so every set is written `provisional: true` and this tool does no
   comparing whatsoever. A set stops being provisional when a human blessing pass
   (Part 9 Q4) drops a `BLESSED.json` into the output directory naming the sets it
   blessed. "Machinery that green-lights against a wrong reference is worse than
   none" — the E8 failure in visual form.

4. THE MOCK IS CONTRACT-CHECKED. `mock_rea.py` verifies fixture parity against
   `tools/FIXTURES.sha256` and payload shapes against the contract table before the
   run starts; a failure aborts rather than photographing a lie. `--allow-fixture-drift`
   exists for the one legitimate case (you just re-recorded fixtures on purpose) and
   says so in the manifest.

BLIND SPOTS, stated so nobody trusts the battery for them (Part 8 §2): it cannot see
INTERACTIVITY — the uPlot mount-C result was a pixel-identical screenshot of a chart
that was completely dead to input, and Gate A's behaviour assertions own that — and
it cannot see the TABLET'S RASTER, which is Gate E's bench run. States that are not
walked are listed in the manifest under `unverified`, ON EVERY RUN and not only on
the one mode that captures nothing (`UNWALKED` below). Silence is not coverage.

A state may also decline a geometry: `geometries: [...]` in `tools/screens/screens.js`
names where it is meaningful, and anything else is skipped, listed per set under
`notCapturedHere`, and reported in `unverified` with the reason one lookup away. That
exists because the opposite failure is silent — a state driven where its surface cannot
appear writes a real PNG that duplicates another state's, and a duplicate image reads as
coverage rather than as the hole it is (wave 5.4, cross-3).
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import json
import pathlib
import re
import sys
import time as time_module

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import cdp as cdplib       # noqa: E402
import geometry            # noqa: E402
import mock_rea            # noqa: E402
import selfcheck           # noqa: E402

REPO = TOOLS.parent
APP_PORT, CDP_PORT = 8808, 9348          # fixed: sequential by design
GALLERY = "/tools/gallery/index.html"

#: THE BLIND SPOTS THAT ARE NOT ABOUT THE INSTRUMENT — states no walk reaches yet.
#:
#: SCOPE Part 8 §2: "States the old corpus never reached — steam mode, a rendered GHC
#: strip, the DYE2 paths — are either added to the walk or listed as unverified;
#: silence is not coverage" (M16). This list used to be appended on the
#: `--subjects app` path ONLY — the path that writes a manifest and returns with zero
#: PNGs — so a manifest could never both contain captures and declare what it had not
#: walked. Tonight's real output showed it: six PNGs beside `"unverified": []`, with
#: every app screen unwalked. Recorded on EVERY run now, whatever `--subjects` says.
#:
#: THE SCREEN HALF IS NOW DERIVED, NOT WRITTEN DOWN (fix run 7, Ben's call). It was a
#: hand-written sentence naming which screens existed, and a hand-written sentence about
#: what exists goes stale the moment something is built. It did, twice, in the same
#: shape: wave 5.4 shipped a manifest whose `unverified` line said the settings screen
#: did not exist while THIRTY-EIGHT of its own PNGs sat beside it (fix-5, cross-6), and
#: the line as it stood at fix run 7 still said "the PROFILE EDITOR does not exist yet
#: (no wave has built it)" — wave 5.5 built it, `tools/screens/screens.js` carries seven
#: `editor--` rows, and every battery run since had been photographing a screen its own
#: manifest denied. A manifest asserting the absence of what it has just photographed is
#: worse than silence, and no amount of care fixes a claim that has to be re-typed.
#:
#: So the two sources ANSWER IT INSTEAD: `src/lib/app-routes.js` is the inventory of
#: screens this app has (its `ROUTES` table is one row per screen, added by the wave
#: that builds it, plus `PLANNED_ROUTE_IDS` for names declared and not yet built), and
#: `tools/screens/screens.js` is the walk registry. A screen with no registry row is
#: unwalked BY CONSTRUCTION and the manifest says so; a screen with rows cannot be
#: called missing, because nothing types the claim. Both files are read as TEXT — this
#: runs on every path, including `--subjects gallery`, where no browser and no registry
#: have been loaded, and a derivation that needed the page would go quiet on exactly the
#: run that photographs none of these states.
#:
#: THE SECOND ENTRY STAYS HAND-WRITTEN, and that is not an oversight. "States the old
#: corpus never reached — steam mode, a rendered GHC strip, the DYE2 paths" is a claim
#: about subjects that do not exist anywhere: no registry row is missing for them,
#: because no fixture, no state and no walk has ever named them. No derivation over the
#: two files above can produce a sentence about a thing neither file mentions.

#: The one claim no source can derive. It comes off this list when a subject exists.
CORPUS_UNWALKED = (
    "states the old corpus never reached: steam mode, a rendered GHC strip, the DYE2 "
    "paths (SCOPE M16, LAYOUT_SPEC_DRAFT §7.9 item 11) — no subject exists for them yet"
)

#: `id: 'live--ready',` in the walk registry — eight spaces, single quotes, one per row.
#: The same expression `test/tools-port.test.mjs` reads the registry with, so the pin and
#: the instrument cannot disagree about what a row is.
_REGISTRY_ROW = re.compile(r"^ {8}id: '([^']+)'", re.M)
#: `id: 'live',` inside `ROUTES` — four spaces deeper than the table, and the `id` field
#: is what `assertRouteTable` requires to equal the row's key.
_ROUTE_ROW = re.compile(r"^ {8}id: '([a-z][a-z0-9-]*)',$", re.M)
_PLANNED = re.compile(r"PLANNED_ROUTE_IDS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)")


def walk_registry(screens_js: str | None = None) -> dict[str, list[str]]:
    """State ids per screen, straight out of `tools/screens/screens.js`.

    A state id is `<screen>--<state>` by the registry's own convention (it is also the
    capture filename), and `test/tools-port.test.mjs` pins that every screen module has
    at least one id naming it. Grouping on the prefix is therefore the registry telling
    us which screens it can photograph, in its own words.
    """
    text = screens_js if screens_js is not None else (REPO / "tools/screens/screens.js").read_text()
    rows: dict[str, list[str]] = {}
    for sid in _REGISTRY_ROW.findall(text):
        screen = sid.split("--", 1)[0]
        rows.setdefault(screen, []).append(sid)
    return rows


def app_screens(routes_js: str | None = None) -> tuple[list[str], list[str]]:
    """`(built, planned)` — the screens the app has, from the route table itself."""
    text = routes_js if routes_js is not None else (REPO / "src/lib/app-routes.js").read_text()
    table = text[text.index("export const ROUTES"):text.index("export const DEFAULT_ROUTE_ID")]
    built = _ROUTE_ROW.findall(table)
    planned_m = _PLANNED.search(text)
    planned = [n.strip().strip("'\"") for n in (planned_m.group(1) if planned_m else "").split(",")
               if n.strip()]
    return built, planned


def unwalked(screens_js: str | None = None, routes_js: str | None = None) -> list[str]:
    """The manifest's `unverified` list, derived — see the block comment above.

    Both texts are parameters so the derivation can be driven both ways round: with the
    tree's own files (the default, and what a real run writes) and with a registry that
    is deliberately missing a screen, which is the case the old hand-written list was
    supposed to cover and twice got wrong.
    """
    rows = walk_registry(screens_js)
    built, planned = app_screens(routes_js)
    lines: list[str] = []
    for screen in built:
        if not rows.get(screen):
            lines.append(
                f"app screens: '{screen}' is in the route table (src/lib/app-routes.js) and has "
                "NO row in the walk registry (tools/screens/screens.js), so `--subjects app` "
                "photographs no frame of it. Derived, not written down: it comes off this list "
                "the moment a row names it")
    for name in planned:
        lines.append(
            f"app screens: '{name}' is declared in PLANNED_ROUTE_IDS and not built, so it has "
            "neither a route nor a walk registry row. Derived from src/lib/app-routes.js")
    walked = {s: rows[s] for s in built if rows.get(s)}
    lines.append(
        "app screens WALKED by `--subjects app` (tools/screens/), derived from the walk "
        "registry so this line cannot outlive the truth: "
        + ", ".join(f"{s} ({len(walked[s])})" for s in sorted(walked))
        + f" — {sum(len(v) for v in walked.values())} states over {len(walked)} of the "
        + f"{len(built)} screens in the route table. A screen with no row is named above")
    extra = sorted(set(rows) - set(built))
    if extra:
        lines.append(
            "walk registry rows whose screen is NOT in the route table: "
            + ", ".join(f"{s} ({len(rows[s])})" for s in extra)
            + " — either the table lost a row or a state id was misspelt; the frames are "
              "real and what they photograph is unverified")
    lines.append(CORPUS_UNWALKED)
    return lines

#: THE SCREENS WALK. `--subjects app` used to short-circuit here with "Decal has no
#: screens yet (Waves 2–4), so this path photographs nothing" — true when it was written
#: and false since wave 5.1 built the Live screen. Left alone it would have abort-checked
#: the mock, photographed nothing, and written a manifest declaring the screen unverified
#: while its states were captured BY HAND through the Gate A harness, which nobody else
#: can reproduce (wave 5.1, cross-3).
#:
#: A screen is not a gallery subject: the gallery frames its stage with 260px of nav, and
#: the whole question a Live capture answers is what the ROWS do at 1000x600. So the walk
#: has its own chrome-free page, `tools/screens/index.html`, and drives the SUITES' OWN
#: fixtures — the same store set and the same sockets the assertions run against.
SCREENS = "/tools/screens/index.html"

#: One mock process holds ONE socket script, and the walk needs two: a server parked on
#: `machinePicker` (B8's park, which no unparked server will ever produce) and a server
#: playing the recorded shot at the render budget. Both are the real `mock_rea.py`, both
#: serve the same contract-checked fixtures, and each state names the one it needs.
#:
#: The park: idle timeline, no shot, `pendingAmbiguity: machinePicker` and nothing
#: connected. The shot: the recorded run at 15 Hz — the rate the samples were recorded at,
#: so it plays at wall-clock speed — with a post-shot tail long enough for the buffer to
#: close on the mock's own `finished` frame.
SCREEN_SCRIPTS = {
    "park": {"timeline": [{"phase": "idle"}],
             "devices": {"pendingAmbiguity": "machinePicker", "connected": []}},
    "shot": {"rate": 15,
             "timeline": [{"phase": "pre-shot", "frames": 12},
                          {"phase": "in-shot", "frames": 220},
                          {"phase": "post-shot", "seconds": 1}]},
}


async def gallery_states(cdp, base: str) -> list[dict]:
    """The walk order, straight from the gallery's own registry.

    `tools/gallery/entries.js` is the single list of subjects (Waves 1–4 append to
    it), and a state's id is its capture filename — which is why the gallery README
    calls state ids identifiers rather than labels.
    """
    await cdp.navigate(f"{base}{GALLERY}")
    if not await cdp.wait_for("!!window.__gallery"):
        raise SystemExit("gallery did not load — tools/gallery/index.html")
    await cdp.js("window.__gallery.ready")
    return await cdp.js("window.__gallery.states()") or []


async def screen_states(cdp, base: str) -> list[dict]:
    """The screens walk, straight from `tools/screens/screens.js`.

    Loaded with no `?state=`, the page mounts nothing and only publishes its registry —
    which is what lets the battery learn, before it drives anything, which MOCK each state
    needs. A state carries `{id, title, fixture, mock, notes}`.
    """
    await cdp.navigate(f"{base}{SCREENS}")
    if not await cdp.wait_for("!!window.__screens"):
        raise SystemExit("the screens page did not load — tools/screens/index.html")
    return await cdp.js("window.__screens.states()") or []


async def show(cdp, base: str, state_id: str, theme: str) -> bool:
    """Navigate to one state. A fresh document per state and per geometry: the
    gallery supports in-page `show()`, but a navigation is the only way to have the
    geometry in force before the component's module evaluates."""
    await cdp.navigate(f"{base}{GALLERY}?state={state_id}&theme={theme}", settle=0.6)
    ok = await cdp.wait_for("document.body.dataset.gallerySettled === '1'", timeout=45)
    if ok:
        await cdp.js("window.__gallery.settle()")
    return ok


async def show_screen(cdp, base: str, state: dict, theme: str, mocks: dict) -> bool:
    """Navigate to one SCREEN state, against the mock that state names.

    The timeout is minutes rather than the gallery's 45 s on purpose: `live--post-shot`
    waits for the recorded shot to finish playing over a real socket, which is 14.7 s of
    frames plus the boot, and a state that has not settled must never be photographed
    early — the fixtures set `screensSettled` only after the drive returned.
    """
    port = mocks[state.get("mock", "shot")]
    url = f"{base}{SCREENS}?state={state['id']}&theme={theme}&mock={port}"
    await cdp.navigate(url, settle=0.6)
    ok = await cdp.wait_for("document.body.dataset.screensSettled === '1'", timeout=120)
    if ok:
        await cdp.js("window.__screens.settle()")
    else:
        fault = await cdp.js("document.body.dataset.screenFault || ''")
        if fault:
            print(f"       {fault}")
    return ok


def _free_port() -> int:
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_screen_mocks() -> tuple[dict, callable]:
    """One `mock_rea.py` SUBPROCESS per socket script, on ephemeral ports.

    Subprocesses rather than `mock_rea.start(script=…)` in this process, because the
    socket script is class state on `MockRea`: two in-process servers would share one
    script and the park would leak into the shot run. The battery is sequential by design
    and these are its only concurrent servers; `start_or_reuse`'s fixed 8080 REST mock is
    untouched and still the one the contract check ran against.
    """
    import subprocess
    import tempfile
    import urllib.request

    ports, procs = {}, []
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="decal-screens-"))
    for name, script in SCREEN_SCRIPTS.items():
        path = tmp / f"{name}.json"
        path.write_text(json.dumps(script))
        port = _free_port()
        proc = subprocess.Popen(
            [sys.executable, "tools/mock_rea.py", "--port", str(port), "--ws-script", str(path)],
            cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        procs.append(proc)
        ports[name] = port

    def stop():
        for proc in procs:
            proc.kill()

    deadline = time_module.time() + 30
    for name, port in ports.items():
        while True:
            if time_module.time() > deadline:
                stop()
                raise SystemExit(f"the '{name}' mock never came up on {port}")
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/info", timeout=2).read()
                break
            except Exception:                                    # noqa: BLE001
                time_module.sleep(0.1)
    print(f"  screens mocks: {', '.join(f'{n} on {p}' for n, p in ports.items())}")
    return ports, stop


async def run(out_dir: pathlib.Path, themes: list[str], geoms: list, only: str | None,
              subjects: str, fixture_drift: bool,
              app_port: int = APP_PORT, cdp_port: int = CDP_PORT) -> dict:
    blessed_file = out_dir / "BLESSED.json"
    blessed = json.loads(blessed_file.read_text()) if blessed_file.exists() else {}
    blessed_sets = set(blessed.get("sets", []))

    manifest = {
        "tool": "tools/capture_battery.py",
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "subjects": subjects,
        "gate": "B (SCOPE Part 8 §2)",
        "neutralise": "removed — change 1; selfcheck.py asserts no residue",
        "fixtures": {},
        "sets": [],
        # Populated on every path, not just the one that photographs nothing, and
        # DERIVED from the walk registry and the route table rather than written down.
        "unverified": unwalked(),
        # Stated rather than measured: Slate's battery shot at 1 and this one still
        # does, but the audit's probe shot at 0.5, so a reader comparing corpora has
        # to be told which raster a PNG is. `cdp.SHOT_SCALE` carries the reasoning.
        "shotScale": cdplib.SHOT_SCALE,
        "blindSpots": [
            "interactivity — a pixel-identical screenshot can be dead to input (uPlot mount C); Gate A owns it",
            "the tablet's raster — Risk 4's on-tablet CDP pass and Gate E own it",
        ],
    }

    checks = mock_rea.check_fixtures()
    manifest["fixtures"] = {"count": checks["count"], "parity": checks["ok"],
                            "sha256File": "tools/FIXTURES.sha256"}
    if not checks["ok"] and not fixture_drift:
        raise SystemExit("fixture parity failed — re-run `python3 tools/mock_rea.py --rehash` "
                         "deliberately, or pass --allow-fixture-drift")
    if not checks["ok"]:
        manifest["fixtures"]["driftAllowed"] = True
    # AND THE CONTRACT CHECK ABORTS TOO, from wave 0b. It used to be recorded in the
    # manifest and walked past — the same defect the probe had with fixture parity, one
    # instrument later: the corpus was written first and the failure filed after it. A
    # battery that photographs frames the handler refutes is the E8 failure in visual
    # form, and the manifest entry nobody reads is not a mitigation.
    contract = mock_rea.check_contract()
    manifest["fixtures"]["contract"] = {k: contract.get(k) for k in ("ok", "table", "pin", "routes")}
    manifest["fixtures"]["contract"]["counts"] = contract.get("counts")
    manifest["fixtures"]["contract"]["notes"] = contract.get("notes", [])
    if not contract["ok"]:
        raise SystemExit("contract check failed — the mock's frames no longer match "
                         f"{contract.get('table')}; photographing them would enshrine a "
                         "server that does not exist. Run `npm run mock-contract`.")

    mock_rea.start_or_reuse()

    # THE SCREENS WALK'S OWN SERVERS. Started before the browser and stopped after it,
    # whatever happens in between: a killed run that leaves two mocks holding ports is the
    # next run's "port is busy but not answering" abort.
    mocks, stop_mocks = _start_screen_mocks() if subjects == "app" else ({}, lambda: None)
    if subjects == "app":
        manifest["screenMocks"] = {name: {"port": port, "script": SCREEN_SCRIPTS[name]}
                                   for name, port in mocks.items()}

    total = 0
    try:
        for theme in themes:
            async with cdplib.Session(app_port, cdp_port, REPO,
                                      width=geoms[0].width, height=geoms[0].height) as s:
                cdp = s.cdp
                states = (await screen_states(cdp, s.base) if subjects == "app"
                          else await gallery_states(cdp, s.base))
                if only:
                    states = [st for st in states if only in st["id"]]
                if not states:
                    raise SystemExit(f"no {subjects} states matched --only {only!r}")
                print(f"  theme {theme}: {len(states)} states x {len(geoms)} geometries")

                for g in geoms:
                    await cdp.set_geometry(g)
                    set_id = f"{theme}/{g.name}"
                    files, misses, declined = [], [], []
                    for st in states:
                        # A state MAY declare the geometries at which it is meaningful
                        # (tools/screens/screens.js). Capturing it elsewhere does not
                        # produce a weaker image, it produces a FALSE one: wave 5.4's
                        # `settings--search-narrowed` photographed a search field the
                        # collapse had hidden and wrote a floor PNG byte-identical to
                        # `settings--browse` in both themes — two named states, one image,
                        # and nothing in the manifest saying so. Skipping is recorded under
                        # `unverified`, which is where un-walked states already go: the
                        # rule is that silence is not coverage, and a duplicate image is
                        # worse than silence because it reads as coverage.
                        want = st.get("geometries")
                        if want and g.name not in want:
                            declined.append(st["id"])
                            print(f"    -- {set_id}/{st['id']} not captured here "
                                  f"(declared for {', '.join(want)})")
                            continue
                        ok = (await show_screen(cdp, s.base, st, theme, mocks)
                              if subjects == "app"
                              else await show(cdp, s.base, st["id"], theme))
                        if not ok:
                            misses.append(st["id"])
                            print(f"    !! {set_id}/{st['id']} never settled")
                            continue
                        path = out_dir / theme / g.name / f"{st['id']}.png"
                        await cdp.screenshot(path, g)
                        files.append(path.name)
                        total += 1
                        print(f"    {set_id}/{path.name}")
                    manifest["sets"].append({
                        "id": set_id, "theme": theme, "geometry": g.name,
                        "viewport": [g.width, g.height], "deviceScaleFactor": g.dsf,
                        "dir": f"{theme}/{g.name}",
                        "files": files, "unsettled": misses,
                        "notCapturedHere": declined,
                        "provisional": set_id not in blessed_sets,
                        "blessing": "human review, region by region (Part 9 Q4) — "
                                    "the first baseline is a REVIEW, not a diff",
                    })
                    if misses:
                        manifest["unverified"].append(f"{set_id}: states that never settled: {misses}")
                    if declined:
                        manifest["unverified"].append(
                            f"{set_id}: states that declared themselves out of this geometry "
                            f"and were NOT captured: {declined} — see `geometries` in "
                            "tools/screens/screens.js for the reason each gives")
    finally:
        stop_mocks()

    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=1) + "\n")
    (out_dir / "REVIEW.md").write_text(REVIEW_MD.format(
        n=total,
        sets="\n".join(f"* `{s['id']}` — {len(s['files'])} PNG(s) at "
                       f"{s['viewport'][0]}×{s['viewport'][1]} @ dsf {s['deviceScaleFactor']:g}"
                       f"{'  **provisional**' if s['provisional'] else '  (blessed)'}"
                       for s in manifest["sets"]),
    ))
    print(f"{total} screenshots -> {out_dir}")
    return manifest


REVIEW_MD = """# Capture set — REVIEW, not a diff

{n} screenshots. Every set below is **provisional** until a human has looked at it
region by region and written `BLESSED.json` next to this file:

```json
{{ "sets": ["dark/bench", "dark/desktop"], "by": "…", "date": "…" }}
```

Why this is a review and not a comparison (SCOPE Part 8 §2, Gate B change 3): below
design size there is no old-app oracle at all — Slate's geometry is frozen, so its
captures are evidence about Slate's non-responsiveness and never a target. A battery
that diffed against an unblessed first baseline would enshrine the first bug it
photographed. That is the E8 failure in visual form.

## Sets

{sets}

## What this cannot tell you

* **Interactivity.** The uPlot mount-C result was a pixel-identical screenshot of a
  chart that was completely dead to input. Gate A's behaviour assertions own that.
* **The tablet's raster.** Gate E's bench run owns that.
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--themes", default="dark,light")
    ap.add_argument("--geometry", default=None,
                    help="comma-separated subset of the matrix: bench,desktop,floor")
    ap.add_argument("--subjects", default="gallery", choices=("gallery", "app"))
    ap.add_argument("--only", default=None, help="substring filter on state id")
    ap.add_argument("--allow-fixture-drift", action="store_true")
    ap.add_argument("--app-port", type=int, default=APP_PORT)
    ap.add_argument("--cdp-port", type=int, default=CDP_PORT,
                    help="fixed by default — the battery is sequential by design; override only "
                         "to step around a stale browser holding the port")
    a = ap.parse_args()

    print("  preconditions (Part 10 §13):")
    if _selfcheck():
        raise SystemExit("selfcheck failed — see `python3 tools/selfcheck.py`")

    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    themes = [t.strip() for t in a.themes.split(",") if t.strip()]
    asyncio.run(run(out, themes, geometry.select(a.geometry), a.only,
                    a.subjects, a.allow_fixture_drift, a.app_port, a.cdp_port))
    return 0


def _selfcheck() -> bool:
    """True when the selfcheck FAILED. Residue and adaptation checks only — the
    fixture/contract halves run again inside `run()` where the manifest can record
    their result."""
    results = [selfcheck.check_residue(), selfcheck.check_shadow_walk(),
               selfcheck.check_adopted_naming(), selfcheck.check_geometry()]
    for r in results:
        print(f"    [{'OK ' if r['ok'] else 'FAIL'}] {r['name']}")
        if not r["ok"]:
            for d in r["detail"]:
                print(f"           {d}")
    return not all(r["ok"] for r in results)


if __name__ == "__main__":
    raise SystemExit(main())
