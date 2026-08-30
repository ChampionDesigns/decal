#!/usr/bin/env python3
"""cdp.py — the shared Chrome/CDP plumbing for the two capture instruments.

Deliberately NOT the Gate A harness. `test/harness/cdp.js` is parallel-safe by
construction (ephemeral debug port, fresh user-data-dir per invocation) because
sixteen builders run their rendering suites concurrently. The capture battery and
the provenance probe are the stated exception: "sequential by design (the probes
share fixed ports)" — SCOPE Part 8 §2 Gate B, restated in the wf-w0a constraints.
So the ports here are FIXED and two capture runs must not overlap. The user-data-dir
is still per-invocation, because a shared profile leaks one run's localStorage theme
stamp into the next one's.

What is shared with the harness is the geometry mechanism, and for one measured
reason: the dsf-1.5 spike found that `Emulation.setDeviceMetricsOverride` must be in
force BEFORE the page's modules evaluate, or `window.devicePixelRatio` is 1 while
the raster is 1.5 and every canvas is drawn at the wrong scale. So this module sets
metrics, then navigates — never the reverse.
"""
from __future__ import annotations

import asyncio
import functools
import http.server
import json
import pathlib
import shutil
import socketserver
import re
import subprocess
import tempfile
import threading
import time
import urllib.request

import websockets

REPO = pathlib.Path(__file__).resolve().parents[1]

#: THE CAPTURE RASTER, AND A DECLARED DEPARTURE FROM THE PORTED INSTRUMENT.
#:
#: Slate's battery shot at `scale: 1` (`review/tools/capture_battery.py`, the
#: `shot()` clip) and the audit's `probe_provenance.py` shot its base/perturbed pairs
#: at `scale: 0.5` — which is why `prov-baseline/*.png` are 960×600 while the
#: battery's are 1920×1200. Both instruments here shoot at 1, so THE PROBE'S PNGs ARE
#: DOUBLE THE AUDIT'S RASTER. Deliberate, and worth stating because it is a visible
#: difference from the ported original:
#:
#:   * nothing pixel-diffs the two corpora — they photograph different applications,
#:     and the comparison anchors on the JSON records (Part 10 §13). The record shape
#:     is what the corpus is the oracle for, and that is unchanged (13 + 2 keys);
#:   * shooting both instruments at one raster makes the battery's PNG and the
#:     probe's `--base.png` for the same state at the same geometry BYTE-IDENTICAL,
#:     which is a free cross-check that the two rigs really are driving the same page;
#:   * half-scale throws away exactly the hairline detail the tablet-raster question
#:     (Gate E) is about.
#:
#: Reversing it is this one number.
SHOT_SCALE = 1.0

CHROME = "google-chrome"
CHROME_FLAGS = [
    "--headless=new", "--hide-scrollbars", "--no-first-run",
    "--no-default-browser-check", "--disable-extensions", "--disable-gpu",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Silent unless something failed. A capture run makes hundreds of requests and a
    per-request log buries the one line that matters — but a 404 on a vendored module
    or a font is exactly how a capture ends up photographing a half-loaded page, so
    those are never swallowed."""

    def log_message(self, fmt, *args):
        code = args[1] if len(args) > 1 else ""
        if str(code).startswith(("4", "5")):
            super().log_message(fmt, *args)


def serve(root: pathlib.Path, port: int):
    """A static server on the REPO ROOT — the served root is the repo (Part 2 §2)."""
    handler = functools.partial(_QuietHandler, directory=str(root))
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    except OSError as exc:
        raise SystemExit(
            f"cannot serve {root} on {port}: {exc}. The capture instruments are sequential by "
            f"design on fixed ports — wait for the other run, or pass --app-port for a one-off."
        ) from exc
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def launch_chrome(cdp_port: int, width: int, height: int):
    """Our OWN Chrome, proven to be ours before a single byte of CDP is spoken.

    THIS IS THE COST OF FIXED PORTS, AND IT BIT ON THE FIRST RUN. If something else
    already holds the debug port — a leftover browser from an earlier probe, another
    capture run — the new Chrome fails to bind and exits, `http://127.0.0.1:PORT/json`
    still answers, and the naive version of this function happily attaches to the
    STRANGER'S TAB. The first smoke run of this probe did exactly that: it drove a
    Slate page left open by an earlier audit run, and the stylesheet index came back
    full of `slate-live.css` and `app.css` from a tree the probe was never pointed at.
    A capture rig that silently photographs the wrong application is worse than one
    that fails.

    Ownership is proved by CHROME'S OWN STARTUP LINE, `DevTools listening on
    ws://127.0.0.1:<port>/devtools/browser/<uuid>`, which only the process that
    actually bound the socket prints. `<user-data-dir>/DevToolsActivePort` looks like
    the tidier primitive and is what `test/harness/cdp.js` reads — but MEASURED on
    this Chrome, that file is written only for `--remote-debugging-port=0`; with a
    fixed port it never appears, so a check on it fails every honest launch. The
    browser uuid is then matched against `/json/version`, which closes the last gap:
    a stranger's browser has a different uuid.
    """
    profile = tempfile.mkdtemp(prefix="decal-capture-")
    log = pathlib.Path(profile) / "chrome-stderr.log"
    handle = log.open("wb")
    proc = subprocess.Popen(
        [CHROME, f"--remote-debugging-port={cdp_port}", f"--user-data-dir={profile}",
         f"--window-size={width},{height}", *CHROME_FLAGS, "about:blank"],
        stdout=subprocess.DEVNULL, stderr=handle)

    def _fail(msg):
        proc.kill()
        handle.close()
        tail = log.read_text(errors="replace")[-400:] if log.exists() else ""
        shutil.rmtree(profile, ignore_errors=True)
        raise SystemExit(f"{msg}\n{tail}")

    listening = re.compile(rf"DevTools listening on ws://127\.0\.0\.1:{cdp_port}/devtools/browser/(\S+)")
    browser_id = None
    for _ in range(200):
        if log.exists():
            m = listening.search(log.read_text(errors="replace"))
            if m:
                browser_id = m.group(1)
                break
        if proc.poll() is not None:
            _fail(f"Chrome exited without claiming debug port {cdp_port}. Something else is "
                  f"listening on it — the capture instruments are SEQUENTIAL BY DESIGN on fixed "
                  f"ports (SCOPE Part 8 §2 Gate B), so wait for the other run, or pass "
                  f"--cdp-port/--app-port for a one-off.")
        time.sleep(0.25)
    if not browser_id:
        _fail(f"Chrome never announced debug port {cdp_port} — is another capture run using it?")

    try:
        version = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json/version").read())
    except Exception as exc:                                    # noqa: BLE001
        _fail(f"debug port {cdp_port} did not answer /json/version ({exc})")
    if browser_id not in (version.get("webSocketDebuggerUrl") or ""):
        _fail(f"debug port {cdp_port} answers for a DIFFERENT browser than the one just launched. "
              f"Refusing to drive somebody else's Chrome.")

    ws_url = None
    for _ in range(160):
        try:
            tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json").read())
            pages = [t for t in tabs if t.get("type") == "page"]
            if pages:
                ws_url = pages[0]["webSocketDebuggerUrl"]
                break
        except Exception:                                       # noqa: BLE001
            pass
        time.sleep(0.25)
    if not ws_url:
        _fail(f"no CDP page target on {cdp_port}")
    handle.close()      # the child holds its own descriptor; ours would just leak
    return proc, profile, ws_url


class CDP:
    """One websocket, request/response by id, with the stylesheet index kept live.

    The stylesheet index is why the reader runs as a task rather than a
    read-until-my-id loop: `CSS.styleSheetAdded` arrives unsolicited, and a Lit tree
    emits one per component the first time its `static styles` is adopted. Losing
    those events is how a provenance row ends up with an empty sheet name — which is
    exactly what adaptation 2 exists to prevent.
    """

    def __init__(self, ws):
        self.ws, self.n = ws, 0
        self.pending: dict[int, asyncio.Future] = {}
        self.sheets: dict[str, dict] = {}
        self.task = asyncio.create_task(self._reader())

    async def _reader(self):
        try:
            async for raw in self.ws:
                m = json.loads(raw)
                if m.get("method") == "CSS.styleSheetAdded":
                    h = m["params"]["header"]
                    self.sheets[h["styleSheetId"]] = h
                mid = m.get("id")
                if mid in self.pending and not self.pending[mid].done():
                    self.pending[mid].set_result(m)
        except Exception:                                       # noqa: BLE001
            pass

    async def send(self, method, **params):
        self.n += 1
        mid = self.n
        fut = asyncio.get_event_loop().create_future()
        self.pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        try:
            m = await asyncio.wait_for(fut, timeout=60)
        finally:
            self.pending.pop(mid, None)
        if "error" in m:
            return {"__error": m["error"]}
        return m.get("result", {})

    async def js(self, expr, quiet=False):
        r = await self.send("Runtime.evaluate", expression=expr,
                            awaitPromise=True, returnByValue=True)
        if r.get("exceptionDetails"):
            if not quiet:
                print("   JS THREW:", json.dumps(r["exceptionDetails"])[:240])
            return None
        return r.get("result", {}).get("value")

    async def handle(self, expr):
        """A RemoteObject id for `expr`, for nodes that live inside a shadow root.

        `DOM.querySelectorAll` does not pierce shadow roots, so the walk keeps its
        elements in `window.__probeEls` and this turns an index into a nodeId via
        `DOM.requestNode`, which does cross the boundary.
        """
        r = await self.send("Runtime.evaluate", expression=expr, returnByValue=False)
        return r.get("result", {}).get("objectId")

    async def node_id(self, expr):
        oid = await self.handle(expr)
        if not oid:
            return None
        r = await self.send("DOM.requestNode", objectId=oid)
        await self.send("Runtime.releaseObject", objectId=oid)
        return r.get("nodeId")

    async def enable_all(self):
        for domain in ("Runtime", "Page", "DOM", "CSS"):
            await self.send(f"{domain}.enable")
        await self.send("DOM.getDocument", depth=1)

    async def set_geometry(self, g):
        """Metrics BEFORE navigation — the dsf-1.5 spike's finding."""
        await self.send("Emulation.setDeviceMetricsOverride", width=g.width,
                        height=g.height, deviceScaleFactor=g.dsf, mobile=False,
                        screenWidth=g.width, screenHeight=g.height)

    async def navigate(self, url, settle=1.0):
        await self.send("Page.navigate", url=url)
        await asyncio.sleep(settle)
        await self.send("DOM.enable")
        await self.send("CSS.enable")
        await self.send("DOM.getDocument", depth=1)

    async def wait_for(self, expr, timeout=30.0, poll=0.2):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if await self.js(expr, quiet=True):
                return True
            await asyncio.sleep(poll)
        return False

    async def screenshot(self, path: pathlib.Path, g, scale: float = SHOT_SCALE):
        """One PNG at `scale` × the geometry. See `SHOT_SCALE` for why it is 1 and
        what that changes relative to the audit's probe; both instruments record the
        value they shot at, so a corpus never has to be measured to find out."""
        import base64
        r = await self.send("Page.captureScreenshot", format="png", captureBeyondViewport=False,
                            clip={"x": 0, "y": 0, "width": g.width, "height": g.height, "scale": scale})
        if "data" not in r:
            return None
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(base64.b64decode(r["data"]))
        return path


class Session:
    """Static server + one Chrome + one CDP connection, cleaned up on exit."""

    def __init__(self, app_port: int, cdp_port: int, root: pathlib.Path = REPO,
                 width: int = 1920, height: int = 1200):
        self.app_port, self.cdp_port = app_port, cdp_port
        self.root, self.width, self.height = root, width, height
        self.base = f"http://127.0.0.1:{app_port}"

    async def __aenter__(self):
        self.httpd = serve(self.root, self.app_port)
        self.chrome, self.profile, ws_url = launch_chrome(self.cdp_port, self.width, self.height)
        self._ws_ctx = websockets.connect(ws_url, max_size=200 * 1024 * 1024)
        self.ws = await self._ws_ctx.__aenter__()
        self.cdp = CDP(self.ws)
        await self.cdp.enable_all()
        return self

    async def __aexit__(self, *exc):
        try:
            await self._ws_ctx.__aexit__(*exc)
        except Exception:                                       # noqa: BLE001
            pass
        self.chrome.terminate()
        try:
            self.chrome.wait(timeout=10)
        except Exception:                                       # noqa: BLE001
            self.chrome.kill()
        # shutdown() only stops the serve_forever loop; without server_close() the
        # listening socket survives and the NEXT theme's session cannot bind 8808.
        # (Caught by the two-theme smoke run: dark captured, light died on bind.)
        self.httpd.shutdown()
        self.httpd.server_close()
        shutil.rmtree(self.profile, ignore_errors=True)
        return False
