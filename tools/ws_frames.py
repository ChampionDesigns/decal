#!/usr/bin/env python3
"""The WebSocket half of the offline mock — the ten `/ws/v1/*` channels, as data.

WHY THIS EXISTS, measured: "The biggest
remaining hole, stated not papered over … the contract check is closed for REST and open for
sockets." `mock_rea.py` spoke no WebSocket at all: the nine `tools/rea-fixtures/ws__*.json`
files are 226-byte recordings of ReaPrime's *"Only WebSocket connections are supported."*
404 page — what the server answers when a socket path is fetched over plain HTTP — and the
only WebSocket code in the tree was `test/harness/ws.js`, a CDP CLIENT. So nothing in the
tree could push a frame at the stores, and no instrument could show the 15 Hz render loop
holding against a live feed.

This module closes it. `mock_rea.MockRea.do_GET` hands a request carrying the upgrade
headers to `serve_socket` below; everything else on `/ws/v1/*` still answers the recorded
404 HTML page, because that is what the server does and a recording is served as what it
is (`envelope_for`).

THE RULE EVERY FRAME HERE OBEYS — THE SAME ONE THE REST HALF OBEYS.
A mock may serve a recording, or a value DERIVED from a recording by a rule written down
where a reader can check it, or state THE MOCK ITSELF OWNS (it is a server: whether it is
scanning, what brightness it was told to hold, which device it has connected). It may not
invent a measurement. Where a channel's values are in none of those three classes the
channel is SILENT and says so, exactly as the REST half answers 501/503 rather than
inventing a body. `WS_FRAMES.md` is the derivation table in prose; `SPECS` below is the
same thing as data, and `check_mock_contract.check_socket_frames` holds the served frames
to it by OPENING THE SOCKETS and reading what comes out.

WHAT IS NOT RESTATED HERE. The channel key lists are READ from the client's own tables
(`src/data/rea-names.js`) rather than copied: a second copy of `SNAPSHOT_KEYS` is a second
thing to forget when a name moves, and the whole point of the instrument is that it cannot
drift from the client without something going red. The keys that have no array to read —
shot state, display, update, devices — are stated here with their handler citation and
cross-checked against the client module that reads them (`socket-key-drift`).

FIRE AND FORGET. No channel replays history on connect. The telemetry channels
(machine snapshot, scale) send NOTHING until their playback clock reaches its first step,
so what the chart draws is what the client buffered — which is the thing under test. The
state channels (devices, display, update) send their CURRENT state once on connect and
nothing older, because ReaPrime's own streams are BehaviorSubjects and that single frame
is the state, not a backlog: `DevicesStateAggregator._stateStream` is a
`BehaviorSubject<Map<String, dynamic>>` (devices_handler.dart:15), and display/update
listen the same way.
"""
from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import select
import socket as _socket
import struct
import threading
import time

TOOLS = pathlib.Path(__file__).resolve().parent
REPO = TOOLS.parent
FIXTURES = TOOLS / "rea-fixtures"
TABLE_PATH = REPO / "src" / "data" / "CONTRACTS.json"

NAMES_JS = REPO / "src" / "data" / "rea-names.js"
FEED_READERS_JS = REPO / "src" / "stores" / "feed-readers.js"
DEVICES_JS = REPO / "src" / "data" / "rea-devices.js"

#: The longest of the three recorded shots — 426 measurement frames, 28.3 s, one real
#: espresso ending at 35.97 g. `api__v1__shots__latest.json` is the FLAT summary shape with
#: no `measurements` array at all and must never drive a chart.
SHOT_FIXTURE = FIXTURES / "api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json"
DEVICES_FIXTURE = FIXTURES / "api__v1__devices.json"
INFO_FIXTURE = FIXTURES / "api__v1__info.json"

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WS_PREFIX = "/ws/v1"

#: The real cadence of the machine channel in a shot (`rea-ws-channels.js`: "The workhorse,
#: ~10 Hz in a shot. The 15 Hz/66 ms figure elsewhere is the render budget, not the socket
#: rate."). The 15 Hz loop proof drives this to 15 deliberately, which is also the rate the
#: recording itself was sampled at (median inter-sample 66.7 ms).
DEFAULT_RATE_HZ = 10.0


# --------------------------------------------------------------------------- #
# The client's own name tables — read, never restated
# --------------------------------------------------------------------------- #

def _js_text(path: pathlib.Path) -> str:
    if not path.exists():
        raise RuntimeError(f"{path} is missing — it is the source of this module's key lists")
    return path.read_text()


def js_string_array(name: str, path: pathlib.Path = NAMES_JS) -> list[str]:
    """One `export const NAME = Object.freeze([...])` string array out of a client module."""
    text = _js_text(path)
    m = re.search(rf"export const {name} = Object\.freeze\(\[(.*?)\]\)", text, re.S)
    if not m:
        raise RuntimeError(f"no {name} array in {path} — the mock reads the client's tables, "
                           "and a second copy of them here is exactly what this avoids")
    return re.findall(r"'([^']+)'", m.group(1))


def js_renames() -> list[dict]:
    """`RENAMES` from rea-names.js — the dead→live map, with its scope."""
    text = _js_text(NAMES_JS)
    m = re.search(r"export const RENAMES = Object\.freeze\(\[(.*?)\n\]\)", text, re.S)
    if not m:
        raise RuntimeError("no RENAMES table in rea-names.js")
    rows = []
    for line in m.group(1).splitlines():
        r = re.search(r"dead: '([^']+)', live: '([^']+)', on: '([^']+)', scope: '([^']+)'", line)
        if r:
            rows.append({"dead": r.group(1), "live": r.group(2), "on": r.group(3), "scope": r.group(4)})
    if not rows:
        raise RuntimeError("RENAMES parsed empty")
    return rows


SNAPSHOT_KEYS = js_string_array("SNAPSHOT_KEYS")
SNAPSHOT_DERIVED_KEYS = js_string_array("SNAPSHOT_DERIVED_KEYS")
SCALE_KEYS = js_string_array("SCALE_KEYS")
ESTIMATOR_CHANNELS = js_string_array("ESTIMATOR_CHANNELS")
ESTIMATOR_ALWAYS_PRESENT = js_string_array("ESTIMATOR_ALWAYS_PRESENT_CHANNELS")
MILK_PROBE_CHANNELS = js_string_array("MILK_PROBE_CHANNELS")
RENAMES = js_renames()
DEAD_GLOBAL = [r["dead"] for r in RENAMES if r["scope"] == "global"]
DEAD_ON_MACHINE = DEAD_GLOBAL + [r["dead"] for r in RENAMES if r["scope"] == "machine"]
#: dead name -> live name, for the channel it is alive on (`weightFlow` is dead on the
#: machine snapshot and ALIVE on the scale; `fusedConf` is dead everywhere and its live
#: spelling is the estimator's `confidence`).
LIVE_OF = {r["dead"]: (r["live"], r["on"]) for r in RENAMES}

SHOT_STATES = js_string_array("SHOT_STATES", FEED_READERS_JS)
SHOT_EVENTS = js_string_array("SHOT_EVENTS", FEED_READERS_JS)
SHOT_DECISION_KINDS = js_string_array("SHOT_DECISION_KINDS", FEED_READERS_JS)
SHOT_DECISION_REASONS = js_string_array("SHOT_DECISION_REASONS", FEED_READERS_JS)
UPDATE_PHASES = js_string_array("UPDATE_PHASES", FEED_READERS_JS)


# --------------------------------------------------------------------------- #
# The frame contract — one entry per socket row in CONTRACTS.json
# --------------------------------------------------------------------------- #
#
# `source` is the honesty class, and it is the column a reader should read first:
#   recorded  every value is bytes out of a hashed fixture (a key may be DROPPED, never
#             added, and never edited — see `machine_frame`);
#   derived   every value comes from a recording through the rule in `derivation`, which
#             is written here, in WS_FRAMES.md, and nowhere else;
#   session   the MOCK'S OWN state as a server (scanning, brightness, which device it has
#             connected). Not a machine measurement and never presented as one;
#   unsourced no recording exists and the value is not the mock's to know. The channel is
#             SILENT until a run script supplies it, and `--ws-status` says so.

SPECS = {
    "machineSnapshot": {
        "path": "/ws/v1/machine/snapshot",
        "source": "recorded",
        "required": list(SNAPSHOT_KEYS),
        "optional": list(SNAPSHOT_DERIVED_KEYS),
        "forbidden": list(DEAD_ON_MACHINE),
        "nonNullOptional": True,   # "Derived channels are OMITTED, not null" (the row)
        "reader": NAMES_JS,
        "derivation": "measurements[].machine of the recorded shot, keys outside "
                      "SNAPSHOT_KEYS/SNAPSHOT_DERIVED_KEYS dropped (: the "
                      "recording predates 633f6f68 and still carries weight, weightFlow, "
                      "milkTemperature and the estimator's pre-rename channels). No key "
                      "is added and no value is touched.",
    },
    "scaleSnapshot": {
        "path": "/ws/v1/scale/snapshot",
        "source": "derived",
        "required": list(SCALE_KEYS),
        "optional": [],
        "forbidden": [],
        "reader": NAMES_JS,
        "derivation": "weight/weightFlow off the SAME recorded machine block (RENAMES: "
                      "both are `on: 'scale'`, 'removed from MachineSnapshot in 633f6f68'), "
                      "timestamp verbatim; battery and timerValue are written null, which "
                      "is this frame's own absence signal (toJson writes them "
                      "unconditionally, so null — not an absent key — means 'not reported').",
    },
    "shotSettings": {
        "path": "/ws/v1/machine/shotSettings",
        "source": "unsourced",
        "required": ["steamSetting", "targetSteamTemp", "targetSteamDuration",
                     "targetHotWaterTemp", "targetHotWaterVolume", "targetHotWaterDuration",
                     "targetShotVolume", "groupTemp"],
        "optional": [],
        "forbidden": [],
        "reader": None,
        "derivation": "De1ShotSettings.toJson (de1_interface.dart:117). NOT derived from "
                      "the recorded workflow's steamSettings: Workflow.steamSettings and "
                      "De1ShotSettings are different models, and mapping one onto the other "
                      "is inventing a server. Silent unless a run script supplies it.",
    },
    "shotState": {
        "path": "/ws/v1/machine/shotState",
        "source": "session",
        "required": ["event", "timestamp", "shotId", "state", "machineState", "machineSubstate",
                     "profileFrame", "scaleConnected", "scaleLost", "machineHasAutonomousSAW",
                     "decision"],
        "optional": [],
        "forbidden": [],
        "reader": FEED_READERS_JS,
        "derivation": "ShotStateEvent.toJson (shot_state_event.dart:89). `state` is the "
                      "MOCK'S OWN sequencer state as it plays the recording back — never a "
                      "mapping off the machine enum, which feed-readers.js warns is a "
                      "different enum. shotId, machineState, machineSubstate, profileFrame "
                      "and the terminal decision's `reason` are the recording's own "
                      "(stopReason 'machineEnded' is a ShotDecisionReason name).",
    },
    "waterLevels": {
        "path": "/ws/v1/machine/waterLevels",
        "source": "unsourced",
        "required": ["currentLevel", "refillLevel"],
        "optional": [],
        "forbidden": [],
        "reader": None,
        "derivation": "De1WaterLevels.toJson (de1_interface.dart:213), MILLIMETRES. No "
                      "fixture in the set records a water level — grep for currentLevel "
                      "finds nothing — so the channel is silent until a run script or the "
                      "bench supplies one. mm->mL is skin-side and is not done here.",
    },
    "devices": {
        "path": "/ws/v1/devices",
        "source": "recorded+session",
        "required": ["timestamp", "devices", "scanning", "connectionStatus"],
        "optional": ["charging"],
        "forbidden": [],
        "reader": DEVICES_JS,
        "derivation": "devices[] is GET /api/v1/devices verbatim (the same "
                      "DeviceListEntry.toJson rows the aggregator builds); scanning and "
                      "connectionStatus are the mock's own session state, moved by the "
                      "scan/connect/disconnect commands and by the run script's "
                      "pendingAmbiguity. connectionStatus writes all five keys "
                      "unconditionally because the handler builds the map literally.",
    },
    "display": {
        "path": "/ws/v1/display",
        "source": "session",
        "required": ["wakeLockEnabled", "wakeLockOverride", "brightness", "requestedBrightness",
                     "lowBatteryBrightnessActive", "platformSupported"],
        "optional": [],
        "forbidden": [],
        "reader": FEED_READERS_JS,
        "derivation": "DisplayState.toJson (display_controller.dart:29). Every value is the "
                      "mock's own: brightness is what setBrightness set it to, the wake "
                      "lock is what the client asked for. platformSupported is true for "
                      "both because this server really does accept and reflect them.",
    },
    "update": {
        "path": "/ws/v1/update",
        "source": "recorded+session",
        "required": ["phase", "currentVersion", "latestVersion", "releaseNotes", "releaseUrl",
                     "installable", "progress", "error"],
        "optional": [],
        "forbidden": [],
        "reader": FEED_READERS_JS,
        "derivation": "AppUpdateState.toJson (app_update_state.dart:65). currentVersion is "
                      "the recorded GET /api/v1/info fullVersion; latestVersion stays null "
                      "('not known yet', never 'up to date') because no update service is "
                      "recorded; installable is false and `install` answers the handler's "
                      "own {error, url} unsupported-platform envelope.",
    },
    "sensorSnapshot": {
        "path": "/ws/v1/sensors/<id>/snapshot",
        "source": "derived",
        "required": [],           # per-sensor; checked against the channel list below
        "optional": list(ESTIMATOR_CHANNELS) + list(MILK_PROBE_CHANNELS),
        "forbidden": list(DEAD_GLOBAL),
        "reader": NAMES_JS,
        "derivation": "An id with no source gets ReaPrime's own answer — {\"error\":\"not "
                      "found\"} AND THE SOCKET CLOSES, which is the client's re-discovery "
                      "trigger. With --ws-sensors=derived the puck estimator's id "
                      "streams the recording's pre-rename estimator channels under their "
                      "live names (fusedConf->confidence, vAbs->absorbedVolume, "
                      "estFlags->flags, detEventCount->collapseEventCount, estLag->lag, "
                      "fusedR1->r1, fusedR2->r2, fusedC->compliance). rev, sigmaQ and "
                      "lagConfidence are ABSENT: the recording predates them and the mock "
                      "does not synthesise an always-present channel.",
    },
    "pluginEndpoint": {
        "path": "/ws/v1/plugins/<id>/<endpoint>",
        "source": "unsourced",
        "required": [],
        "optional": [],
        "forbidden": [],
        "reader": None,
        "derivation": "No plugin payload is recorded anywhere (the ws__*plugins* fixture is "
                      "the 404 page). ReaPrime answers a plugin that is not loaded 404 "
                      "BEFORE the upgrade, so that is what the mock answers: the socket "
                      "never opens and plugin absence degrades to feature-absent.",
    },
}

#: Channels that accept the upgrade and stream. `pluginEndpoint` is served, but as the
#: pre-upgrade 404 branch, so it never reaches `serve_socket`.
UPGRADED_ROWS = [k for k in SPECS if k != "pluginEndpoint"]


def socket_rows(table_path: pathlib.Path = TABLE_PATH) -> list[dict]:
    """The ten socket rows of the contract table. One table, no fallback."""
    table = json.loads(table_path.read_text())
    rows = table.get("sockets")
    if not rows:
        raise RuntimeError(f"{table_path} has no 'sockets' rows")
    return rows


def row_for_path(path: str) -> str | None:
    """Which socket row a request path belongs to, or None."""
    bare = path.split("?")[0]
    for row_id, contract in SPECS.items():
        template = contract["path"].split("/")
        have = bare.split("/")
        if len(template) != len(have):
            continue
        if all(t == h or (t.startswith("<") and t.endswith(">") and h) for t, h in zip(template, have)):
            return row_id
    return None


# --------------------------------------------------------------------------- #
# The recording, reshaped
# --------------------------------------------------------------------------- #

class ShotReplay:
    """The recorded shot, as the frames the ten channels carry.

    Nothing here rewrites a value. The machine frame is the recorded block with the
    refuted keys DROPPED; the scale frame is two of those dropped keys under the names the
    rename table says they live at now; the phase segmentation is the recording's own
    `state.substate` transitions, not a schedule invented here.
    """

    def __init__(self, fixture: pathlib.Path = SHOT_FIXTURE):
        self.fixture = fixture
        record = json.loads(fixture.read_text())
        measurements = record.get("measurements")
        if not isinstance(measurements, list) or not measurements:
            raise RuntimeError(
                f"{fixture.name} carries no measurements array. The flat summary shape "
                "(shots/latest, the shots listing) must never drive a chart — 's "
                "test-shot-metrics-fixture-shape suite pins it as ok:false.")
        self.record = record
        self.shot_id = record.get("id")
        self.stop_reason = record.get("stopReason")
        self.raw = [m.get("machine") or {} for m in measurements]
        self.volumes = [m.get("volume") for m in measurements]
        # The recording's own phases: 90 frames of espresso/preparingForShot, then
        # preinfusion + pouring to the end.
        self.pre_shot = [i for i, m in enumerate(self.raw)
                         if (m.get("state") or {}).get("substate") == "preparingForShot"]
        self.in_shot = [i for i in range(len(self.raw)) if i not in set(self.pre_shot)]

    def __len__(self) -> int:
        return len(self.raw)

    # -- the frames ------------------------------------------------------- #

    def machine_frame(self, index: int) -> dict:
        """`MachineSnapshot.toJson`, from the recorded block, refuted keys dropped.

        DROPPING, NOT EDITING. `weight`, `weightFlow` and `milkTemperature` were deleted
        from this frame in 633f6f68 and the estimator's channels were
        renamed wholesale; the an earlier run recording predates both. Serving it verbatim
        would teach the client a server that has not existed for months — and
        `deadKeysPresent` exists precisely to report that as a defect. Serving it with the
        dead keys REMOVED is the recording, minus what the handler no longer sends.
        """
        frame = self.raw[index]
        return {k: frame[k] for k in SNAPSHOT_KEYS + SNAPSHOT_DERIVED_KEYS if k in frame}

    def scale_frame(self, index: int) -> dict:
        """`WeightSnapshot.toJson`, from the same recorded sample.

        The recording's own `measurements[].scale` is null on every sample — this shot was
        pulled with the gravimetric data arriving on the machine block, where it lived
        before 633f6f68. The numbers are real: 181.6 g with the cup on the platform, tared
        to 0 at the start of the pour, 35.97 g at the end against a workflow target yield
        of 36. So the rename table's two `on: 'scale'` rows are the derivation, and no
        value is touched on the way.
        """
        frame = self.raw[index]
        return {
            "timestamp": frame.get("timestamp"),
            "weight": frame.get("weight"),
            "weightFlow": frame.get("weightFlow"),
            # Written unconditionally by toJson; null is this frame's absence signal.
            "battery": None,
            "timerValue": None,
        }

    def estimator_frame(self, index: int) -> dict:
        """The puck estimator's channels, under the names they live at now.

        `rev`, `sigmaQ` and `lagConfidence` are ABSENT — `encodeSample` always writes them
        today, and this recording predates that. The mock does not fill them in: an
        invented always-present channel is exactly the lie this instrument exists to stop.
        """
        frame = self.raw[index]
        out: dict = {"timestamp": frame.get("timestamp")}
        for dead, value in frame.items():
            live, on = LIVE_OF.get(dead, (None, None))
            if on == "estimator":
                out[live] = value
        return out

    def has_derived(self) -> bool:
        return any(k in self.raw[0] for k in SNAPSHOT_DERIVED_KEYS)


# --------------------------------------------------------------------------- #
# The run script — phases, cadence, and the values no recording carries
# --------------------------------------------------------------------------- #

DEFAULT_TIMELINE = [{"phase": "pre-shot"}, {"phase": "in-shot"}, {"phase": "post-shot"}]
PHASES = ("idle", "pre-shot", "in-shot", "post-shot")


class Script:
    """What the operator gets to decide: cadence, phase order, and the unsourced values.

    Everything settable here is either a rate, a phase order, or a value NO recording
    carries. Nothing in a script can change a recorded number — the script chooses which
    recorded frames play and when, never what they say.
    """

    def __init__(self, doc: dict | None = None, rate: float | None = None,
                 phase: str | None = None, sensors: str = "absent", scale: str = "derived"):
        doc = dict(doc or {})
        self.rate = float(rate or doc.get("rate") or DEFAULT_RATE_HZ)
        if self.rate <= 0:
            raise ValueError("rate must be > 0 Hz")
        self.loop = bool(doc.get("loop", False))
        timeline = doc.get("timeline") or list(DEFAULT_TIMELINE)
        if phase:
            timeline = [{"phase": phase}]
        for entry in timeline:
            if entry.get("phase") not in PHASES:
                raise ValueError(f"unknown phase {entry.get('phase')!r}; one of {PHASES}")
        self.timeline = timeline
        # Values no recording carries. None means SILENT, and silent is the default.
        self.water_levels = doc.get("waterLevels")
        self.shot_settings = doc.get("shotSettings")
        self.pending_ambiguity = (doc.get("devices") or {}).get("pendingAmbiguity")
        self.connected_ids = (doc.get("devices") or {}).get("connected")
        self.machine_has_autonomous_saw = bool(doc.get("machineHasAutonomousSAW", False))
        self.scan_ms = int(doc.get("scanMs", 400))
        self.sensors = doc.get("sensors", sensors)      # 'absent' | 'derived'
        self.scale = doc.get("scale", scale)            # 'derived' | 'absent'
        self.canary = doc.get("canary")                 # see check_mock_contract

    @staticmethod
    def load(path: pathlib.Path | str | None, **kwargs) -> "Script":
        if not path:
            return Script(**kwargs)
        doc = json.loads(pathlib.Path(path).read_text())
        return Script(doc, **kwargs)

    def steps(self, replay: ShotReplay) -> tuple[list[tuple[str, int]], tuple[str, int] | None]:
        """The playback plan: a finite list of (phase, frame index), plus a held tail.

        `idle` contributes NO steps: not one frame in the recorded set carries a machine
        state of idle, and a held espresso frame relabelled idle would be the instrument
        writing the recording. The gap is real and is on the bench list.
        """
        steps: list[tuple[str, int]] = []
        hold: tuple[str, int] | None = None
        for entry in self.timeline:
            phase = entry["phase"]
            limit = entry.get("frames")
            if phase == "idle":
                continue
            if phase == "pre-shot":
                indices = replay.pre_shot
            elif phase == "in-shot":
                indices = replay.in_shot
            else:                                    # post-shot: hold the last frame
                seconds = entry.get("seconds")
                last = replay.in_shot[-1] if replay.in_shot else len(replay) - 1
                if seconds is None:
                    hold = (phase, last)
                    break
                steps += [(phase, last)] * max(1, int(seconds * self.rate))
                continue
            if limit is not None:
                indices = indices[:int(limit)]
            steps += [(phase, i) for i in indices]
        return steps, hold


# --------------------------------------------------------------------------- #
# Session state — what the mock owns as a server
# --------------------------------------------------------------------------- #

class Session:
    """The mock's own state, shared by every open socket.

    A revision counter per channel is what wakes the state channels: a pump that has sent
    revision N sends again when it sees N+1, which is how a `connect` command on one
    socket reaches the state frame on another — the aggregator's behaviour, without a
    broadcast bus.
    """

    def __init__(self, script: Script):
        self.lock = threading.RLock()
        self.script = script
        self.devices = json.loads(DEVICES_FIXTURE.read_text())
        info = json.loads(INFO_FIXTURE.read_text())
        self.scanning = False
        self.scan_until: float | None = None
        # Seeded from the RECORDING: `GET /api/v1/devices` was recorded with one machine
        # connected, so the session starts where the recording stands rather than
        # contradicting its own device list with a phase of `idle`.
        self.connected: set[str] = set(script.connected_ids) if script.connected_ids is not None else {
            d["id"] for d in self.devices if d.get("state") == "connected"}
        self.pending_ambiguity = script.pending_ambiguity
        self.connection_error = None
        self.display = {
            "wakeLockEnabled": False,
            "wakeLockOverride": False,
            "brightness": 100,
            "requestedBrightness": 100,
            "lowBatteryBrightnessActive": False,
            "platformSupported": {"brightness": True, "wakeLock": True},
        }
        self.update = {
            "phase": "idle",
            "currentVersion": info.get("fullVersion"),
            "latestVersion": None,
            "releaseNotes": None,
            "releaseUrl": None,
            "installable": False,
            "progress": None,
            "error": None,
        }
        self.water_levels = script.water_levels
        self.shot_settings = script.shot_settings
        self.revision = {"devices": 1, "display": 1, "update": 1,
                         "waterLevels": 1 if self.water_levels else 0,
                         "shotSettings": 1 if self.shot_settings else 0}
        #: what the run never had a source for, reported at shutdown
        self.silent: set[str] = set()

    def bump(self, key: str):
        with self.lock:
            self.revision[key] = self.revision.get(key, 0) + 1

    # -- devices ---------------------------------------------------------- #

    def device(self, device_id: str) -> dict | None:
        return next((d for d in self.devices if d.get("id") == device_id), None)

    def device_list(self) -> list[dict]:
        """The recorded list, with this session's connection states applied."""
        out = []
        for entry in self.devices:
            row = dict(entry)
            if row.get("id") in self.connected:
                row["state"] = "connected"
                row["available"] = True
            out.append(row)
        return out

    def found(self, kind: str) -> list[dict]:
        """`foundMachines` / `foundScales` — built by hand by the handler, four keys, no
        `available`, state always 'discovered'."""
        return [{"name": d.get("name"), "id": d.get("id"), "state": "discovered", "type": kind}
                for d in self.devices if d.get("type") == kind]

    def connection_phase(self) -> str:
        if self.pending_ambiguity:
            return "connectingMachine" if self.pending_ambiguity == "machinePicker" else "connectingScale"
        if self.scanning:
            return "scanning"
        return "ready" if self.connected else "idle"

    def devices_frame(self) -> dict:
        with self.lock:
            return {
                "timestamp": iso_now(),
                "devices": self.device_list(),
                "scanning": self.scanning,
                "connectionStatus": {
                    "phase": self.connection_phase(),
                    "foundMachines": self.found("machine"),
                    "foundScales": self.found("scale"),
                    "pendingAmbiguity": self.pending_ambiguity,
                    "error": self.connection_error,
                },
            }


def iso_now() -> str:
    """The mock's own stamp, for the frames whose timestamp is the SERVER's (the devices
    aggregator writes `DateTime.now().toUtc()`). Recorded frames keep the recording's."""
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + f".{int(time.time() % 1 * 1e6):06d}Z"


# --------------------------------------------------------------------------- #
# The channels
# --------------------------------------------------------------------------- #

class Channel:
    """One open socket's behaviour. `due(now)` is polled; `on_message` answers commands."""

    row_id = ""
    closed = False
    close_after_frames = False

    def open_frames(self) -> list[dict]:
        return []

    def next_due(self, now: float) -> float | None:
        return None

    def due(self, now: float) -> list[dict]:
        return []

    def on_message(self, data) -> list[dict]:
        return []


class _Playback(Channel):
    """Shared clock for the two telemetry channels — the whole of the cadence contract.

    Step k is due at `t0 + (k + 1) / rate`, with t0 the moment the socket opened. So
    NOTHING is sent on connect, nothing older than the connection is ever sent, and a
    subscriber joins between emissions and waits for the NEXT one, exactly as it would on
    a machine that is already running.

    THE FULL PERIOD BEFORE THE FIRST FRAME IS LOAD-BEARING, not politeness. A frame written
    into the same TCP segment as the 101 arrives before any client that attaches its
    message handler after the handshake resolves can see it — `test/harness/ws.js` parses
    exactly that leftover in its constructor. Sending step 0 at t0 made the first frame a
    coin toss; waiting one period makes "the first frame you get is the first frame sent"
    true for every client.

    Late steps are not coalesced: a stalled reader gets its frames late rather than
    silently thinned, because thinning is exactly the failure a 15 Hz loop proof is looking
    for.
    """

    def __init__(self, replay: ShotReplay, script: Script, now: float):
        self.replay = replay
        self.script = script
        self.rate = script.rate
        self.t0 = now
        self.k = 0
        self.steps, self.hold = script.steps(replay)
        if script.canary == "cadence":
            # Slower, not faster: a burst would also trip `socket-history`, and a canary
            # that fires someone else's rule proves nothing about its own. A SIXTH, not a
            # third, so the rule's tolerance can be wide enough to survive a loaded box
            # and still leave the canary unambiguous.
            self.rate = script.rate / 6

    def _step(self, k: int) -> tuple[str, int] | None:
        if k < len(self.steps):
            return self.steps[k]
        if self.hold is not None:
            return self.hold
        if self.script.loop and self.steps:
            return self.steps[k % len(self.steps)]
        return None

    def next_due(self, now: float) -> float | None:
        return None if self._step(self.k) is None else self.t0 + (self.k + 1) / self.rate

    def _pending(self, now: float) -> list[tuple[str, int]]:
        out = []
        while True:
            step = self._step(self.k)
            if step is None or now < self.t0 + (self.k + 1) / self.rate:
                break
            out.append(step)
            self.k += 1
        return out

    def phase_at(self, k: int) -> str:
        step = self._step(max(0, k - 1))
        return step[0] if step else "idle"


class MachineChannel(_Playback):
    row_id = "machineSnapshot"

    def open_frames(self):
        if self.script.canary == "history-on-connect":
            # The defect this rule exists to catch: a backlog handed over at connect, so
            # the chart draws frames the client never buffered. Eight of them, because the
            # rule counts OVER-DELIVERY against the requested rate and a couple of extra
            # frames is exactly what a starved reader legitimately sees.
            return [self.replay.machine_frame(i) for i in range(8)]
        return []

    def due(self, now):
        frames = []
        for _phase, index in self._pending(now):
            frame = self.replay.machine_frame(index)
            if self.script.canary == "dead-key":
                frame["weightFlow"] = self.replay.raw[index].get("weightFlow")
            if self.script.canary == "null-derived":
                frame["puckResistanceDerived"] = None
            frames.append(frame)
        return frames


class ScaleChannel(_Playback):
    row_id = "scaleSnapshot"

    def open_frames(self):
        # `sendStatus` fires from the connection-state listener, which a BehaviorSubject
        # answers immediately: one status envelope, then frames. It carries no timestamp,
        # which is what separates it from a WeightSnapshot (`isStatusEnvelope`).
        return [{"status": "connected" if self.script.scale == "derived" else "disconnected"}]

    def due(self, now):
        if self.script.scale != "derived":
            self._pending(now)                       # keep the clock, send nothing
            return []
        return [self.replay.scale_frame(i) for _phase, i in self._pending(now)]


class ShotStateChannel(_Playback):
    """One frame per playback phase change — the sequencer's view, which is the MOCK's."""

    row_id = "shotState"

    STATE_OF = {"pre-shot": "preheating", "in-shot": "pouring", "post-shot": "finished"}

    def __init__(self, replay, script, now, session: Session):
        super().__init__(replay, script, now)
        self.session = session
        self.sent_phase = None

    def due(self, now):
        frames = []
        for phase, index in self._pending(now):
            if phase == self.sent_phase:
                continue
            self.sent_phase = phase
            frames.append(self._frame(phase, index))
        return frames

    def _frame(self, phase: str, index: int) -> dict:
        machine = self.replay.raw[index]
        state_block = machine.get("state") or {}
        terminal = phase == "post-shot"
        return {
            "event": "terminal" if terminal else "state",
            "timestamp": machine.get("timestamp"),
            "shotId": self.replay.shot_id,
            "state": self.STATE_OF.get(phase, "idle"),
            "machineState": state_block.get("state"),
            "machineSubstate": state_block.get("substate"),
            "profileFrame": machine.get("profileFrame"),
            "scaleConnected": self.script.scale == "derived",
            "scaleLost": False,
            "machineHasAutonomousSAW": self.script.machine_has_autonomous_saw,
            "decision": None if not terminal else {
                "kind": "terminal",
                # The recording's own stopReason, which is a ShotDecisionReason name.
                "reason": self.replay.stop_reason,
                "details": None,
                "data": None,
            },
        }


class _StateChannel(Channel):
    """A channel that carries the mock's current state and re-sends it when it changes."""

    key = ""

    def __init__(self, session: Session):
        self.session = session
        self.sent = -1

    def _value(self):
        raise NotImplementedError

    def open_frames(self):
        value = self._value()
        self.sent = self.session.revision.get(self.key, 0)
        if value is None:
            self.session.silent.add(self.row_id)
            return []
        return [value]

    def next_due(self, now):
        return now + 0.05                            # the state poll; see Session.revision

    def due(self, now):
        if self.session.revision.get(self.key, 0) == self.sent:
            return []
        self.sent = self.session.revision.get(self.key, 0)
        value = self._value()
        return [] if value is None else [value]


class DevicesChannel(_StateChannel):
    row_id = "devices"
    key = "devices"

    def _value(self):
        return self.session.devices_frame()

    def due(self, now):
        s = self.session
        with s.lock:
            if s.scan_until is not None and now >= s.scan_until:
                s.scan_until = None
                s.scanning = False
                s.bump("devices")
        return super().due(now)

    def on_message(self, data):
        """`DevicesHandler._handleCommand`, answer for answer.

        The errors are the handler's own strings. An unknown command gets NOTHING, because
        the Dart switch has no default — silence is the honest reproduction of it.
        """
        s = self.session
        if not isinstance(data, dict):
            return [{"error": "Invalid JSON: not an object"}]
        command = data.get("command")
        if not isinstance(command, str):
            return [{"error": 'Missing "command" field'}]
        if command == "scan":
            with s.lock:
                s.scanning = True
                s.scan_until = time.monotonic() + s.script.scan_ms / 1000.0
                s.bump("devices")
            return []
        if command in ("connect", "disconnect"):
            device_id = data.get("deviceId")
            if not isinstance(device_id, str):
                return [{"error": f'Missing "deviceId" for {command}'}]
            device = s.device(device_id)
            if device is None:
                return [{"error": f"Device not found: {device_id}"}]
            with s.lock:
                if command == "connect":
                    s.connected.add(device_id)
                    # THE ANSWER. A connect while ReaPrime is parked on a picker is the
                    # CHOICE (`_connectDevice` routes it to selectMachine/selectScale), so
                    # it clears the ambiguity instead of starting a fresh connect.
                    if s.pending_ambiguity:
                        s.pending_ambiguity = None
                else:
                    s.connected.discard(device_id)
                s.bump("devices")
            if command == "disconnect":
                return []                            # the state frame is the whole answer
            return [{
                "deviceId": device_id,
                "operation": "connect",
                "outcome": "connected",
                "state": "connected",
                "connectionError": None,
            }]
        return []


class DisplayChannel(_StateChannel):
    row_id = "display"
    key = "display"

    def _value(self):
        return dict(self.session.display)

    def on_message(self, data):
        """`DisplayHandler._handleWebSocket`. The failure mode is SILENCE and it is
        reproduced exactly: a non-int brightness, an out-of-range one, an unknown command
        and a malformed message all get no reply at all."""
        s = self.session
        if not isinstance(data, dict):
            return []
        command = data.get("command")
        if command == "setBrightness":
            value = data.get("brightness")
            if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 100:
                return []
            with s.lock:
                s.display["brightness"] = value
                s.display["requestedBrightness"] = value
                s.bump("display")
        elif command in ("requestWakeLock", "releaseWakeLock"):
            want = command == "requestWakeLock"
            with s.lock:
                s.display["wakeLockEnabled"] = want
                s.display["wakeLockOverride"] = want
                s.bump("display")
        return []


class UpdateChannel(_StateChannel):
    row_id = "update"
    key = "update"

    def _value(self):
        return dict(self.session.update)

    def on_message(self, data):
        if not isinstance(data, dict):
            return [{"error": "Invalid JSON: not an object"}]
        command = data.get("command")
        if not isinstance(command, str):
            return [{"error": 'Missing "command" field'}]
        if command == "check":
            # No update service is recorded, and a phase of `idle` with a null
            # latestVersion after a check reads as "you are up to date" — a claim this
            # instrument cannot make. It says what is true: it has no answer.
            with self.session.lock:
                self.session.update["phase"] = "error"
                self.session.update["error"] = ("the offline mock has no recorded update "
                                                "service; nothing here knows a latest version")
                self.session.bump("update")
            return []
        if command == "install":
            # The handler's own unsupported-platform reply: an error envelope with the
            # fallback URL, which is null here because none is recorded.
            return [{"error": "In-app install is not supported on this platform",
                     "url": self.session.update["releaseUrl"]}]
        return [{"error": f"Unknown command: {command}"}]


class WaterLevelsChannel(_StateChannel):
    row_id = "waterLevels"
    key = "waterLevels"

    def _value(self):
        return dict(self.session.water_levels) if self.session.water_levels else None


class ShotSettingsChannel(_StateChannel):
    row_id = "shotSettings"
    key = "shotSettings"

    def _value(self):
        return dict(self.session.shot_settings) if self.session.shot_settings else None


class SensorChannel(_Playback):
    """One sensor id.

    An id the mock has no source for is answered exactly as ReaPrime answers an unknown
    one — `{"error":"not found"}` and the socket CLOSES — because that close is the
    client's re-discovery trigger and a silent open socket would suppress it.
    """

    row_id = "sensorSnapshot"

    def __init__(self, replay, script, now, sensor_id: str):
        super().__init__(replay, script, now)
        self.sensor_id = sensor_id
        self.kind = ("puckEstimator" if sensor_id.endswith("-puckestimator")
                     else "milkProbe" if sensor_id.endswith("-milkprobe") else None)
        self.serves = script.sensors == "derived" and self.kind == "puckEstimator"

    def open_frames(self):
        if self.serves:
            return []
        self.closed = True
        return [{"error": "not found"}]

    def due(self, now):
        if not self.serves:
            return []
        return [self.replay.estimator_frame(i) for _phase, i in self._pending(now)]


def channel_for(path: str, session: Session, replay: ShotReplay, now: float) -> Channel | None:
    row = row_for_path(path)
    script = session.script
    if row == "machineSnapshot":
        return MachineChannel(replay, script, now)
    if row == "scaleSnapshot":
        return ScaleChannel(replay, script, now)
    if row == "shotState":
        return ShotStateChannel(replay, script, now, session)
    if row == "shotSettings":
        return ShotSettingsChannel(session)
    if row == "waterLevels":
        return WaterLevelsChannel(session)
    if row == "devices":
        return DevicesChannel(session)
    if row == "display":
        return DisplayChannel(session)
    if row == "update":
        return UpdateChannel(session)
    if row == "sensorSnapshot":
        return SensorChannel(replay, script, now, path.split("/")[4])
    return None


# --------------------------------------------------------------------------- #
# RFC 6455, server side — the minimum, and no more
# --------------------------------------------------------------------------- #
#
# The mirror of test/harness/ws.js, which is a CLIENT and says in its own header that it
# cannot stand in for a server. Same deliberate scope: text frames, ping, close; no
# permessage-deflate (nothing here negotiates an extension), no fragmentation on send.

OP_TEXT, OP_BINARY, OP_CLOSE, OP_PING, OP_PONG, OP_CONT = 0x1, 0x2, 0x8, 0x9, 0xa, 0x0


def accept_key(key: str) -> str:
    return base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()


def encode_frame(payload: bytes, opcode: int = OP_TEXT) -> bytes:
    length = len(payload)
    header = bytes([0x80 | opcode])
    if length < 126:
        header += bytes([length])
    elif length < 65536:
        header += bytes([126]) + struct.pack(">H", length)
    else:
        header += bytes([127]) + struct.pack(">Q", length)
    return header + payload                          # server frames are never masked


def read_frame(buf: bytes):
    """One frame off the front of `buf`, or None while it is incomplete."""
    if len(buf) < 2:
        return None
    fin = bool(buf[0] & 0x80)
    opcode = buf[0] & 0x0f
    masked = bool(buf[1] & 0x80)
    length = buf[1] & 0x7f
    offset = 2
    if length == 126:
        if len(buf) < offset + 2:
            return None
        length = struct.unpack(">H", buf[offset:offset + 2])[0]
        offset += 2
    elif length == 127:
        if len(buf) < offset + 8:
            return None
        length = struct.unpack(">Q", buf[offset:offset + 8])[0]
        offset += 8
    mask = b""
    if masked:
        if len(buf) < offset + 4:
            return None
        mask = buf[offset:offset + 4]
        offset += 4
    if len(buf) < offset + length:
        return None
    payload = bytearray(buf[offset:offset + length])
    if masked:
        for i in range(length):
            payload[i] ^= mask[i & 3]
    return fin, opcode, bytes(payload), buf[offset + length:]


def handshake_response(key: str) -> bytes:
    return (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept_key(key)}\r\n"
        "\r\n"
    ).encode()


# --------------------------------------------------------------------------- #
# The pump
# --------------------------------------------------------------------------- #

def serve_socket(sock: _socket.socket, path: str, session: Session, replay: ShotReplay,
                 max_seconds: float | None = None) -> int:
    """Drive one open socket until the client goes away. Returns frames sent.

    One thread per connection (the HTTP server is already threaded), one select loop, no
    locks on the send path: the connection owns its own playback clock, which is why two
    clients each see the shot from ITS OWN connect and neither is handed a backlog.
    """
    now = time.monotonic()
    channel = channel_for(path, session, replay, now)
    if channel is None:
        return 0
    deadline = None if max_seconds is None else now + max_seconds
    sent = 0
    buf = b""

    def send(payload) -> None:
        nonlocal sent
        body = payload if isinstance(payload, (bytes, bytearray)) else json.dumps(payload).encode()
        sock.sendall(encode_frame(body))
        sent += 1

    try:
        for frame in channel.open_frames():
            send(frame)
        if channel.closed:
            sock.sendall(encode_frame(struct.pack(">H", 1000), OP_CLOSE))
            return sent
        while True:
            now = time.monotonic()
            if deadline is not None and now >= deadline:
                break
            due = channel.next_due(now)
            # Nothing scheduled (an idle phase, a finished playback with no hold) is a
            # lazy poll, not a spin: `select` still wakes the instant a command arrives,
            # so the timeout only bounds how stale a state-revision check can get.
            timeout = 0.1 if due is None else max(0.0, min(due - now, 0.05))
            readable, _, _ = select.select([sock], [], [], timeout)
            if readable:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    parsed = read_frame(buf)
                    if parsed is None:
                        break
                    _fin, opcode, payload, buf = parsed
                    if opcode == OP_CLOSE:
                        sock.sendall(encode_frame(struct.pack(">H", 1000), OP_CLOSE))
                        return sent
                    if opcode == OP_PING:
                        sock.sendall(encode_frame(payload, OP_PONG))
                        continue
                    if opcode in (OP_TEXT, OP_CONT):
                        try:
                            data = json.loads(payload.decode())
                        except Exception:            # noqa: BLE001
                            data = None
                        for reply in channel.on_message(data):
                            send(reply)
            for frame in channel.due(time.monotonic()):
                send(frame)
            if channel.closed:
                sock.sendall(encode_frame(struct.pack(">H", 1000), OP_CLOSE))
                break
    except (BrokenPipeError, ConnectionResetError, OSError):
        pass                                          # the client left; nothing to report
    return sent


class ProbeClient:
    """A client, for the checker and nothing else.

    `check_mock_contract.check_socket_frames` has to ASK THE SERVER — comparing the contract table
    with a re-derivation of itself would be the tautology the REST half already refuses
    (`check_refusals`). So this opens a real socket, does the real handshake, and reads
    what actually comes down the wire. It is not an implementation the skin uses: the skin
    has `rea-sockets.js`, and `test/harness/ws.js` is the test rig's client.
    """

    def __init__(self, port: int, path: str, timeout: float = 5.0):
        self.sock = _socket.create_connection(("127.0.0.1", port), timeout=timeout)
        key = base64.b64encode(hashlib.sha1(str(time.time_ns()).encode()).digest()[:16]).decode()
        self.sock.sendall((
            f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            head += chunk
        header, _, rest = head.partition(b"\r\n\r\n")
        self.status = header.split(b"\r\n", 1)[0].decode(errors="replace")
        self.ok = self.status.startswith("HTTP/1.1 101")
        self.accept = accept_key(key)
        self.buf = rest
        self.closed_by_server = False

    def collect(self, seconds: float) -> list[tuple[float, object]]:
        """Every text message that arrives in the next `seconds`, stamped on arrival."""
        out: list[tuple[float, object]] = []
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            self.sock.settimeout(max(0.01, end - time.monotonic()))
            try:
                chunk = self.sock.recv(65536)
            except (TimeoutError, OSError):
                chunk = b""
            if chunk:
                self.buf += chunk
            while True:
                parsed = read_frame(self.buf)
                if parsed is None:
                    break
                _fin, opcode, payload, self.buf = parsed
                if opcode == OP_CLOSE:
                    self.closed_by_server = True
                    return out
                if opcode == OP_TEXT:
                    try:
                        out.append((time.monotonic(), json.loads(payload.decode())))
                    except Exception:                # noqa: BLE001
                        out.append((time.monotonic(), payload.decode(errors="replace")))
        # One last non-blocking drain. A probe thread starved past its own deadline would
        # otherwise report "the channel sent nothing" about frames already sitting in its
        # socket buffer — the checker failing the build on the box's load rather than on
        # the server's behaviour.
        self.sock.settimeout(0)
        try:
            self.buf += self.sock.recv(65536)
        except (BlockingIOError, TimeoutError, OSError):
            pass
        while True:
            parsed = read_frame(self.buf)
            if parsed is None:
                break
            _fin, opcode, payload, self.buf = parsed
            if opcode == OP_CLOSE:
                self.closed_by_server = True
                break
            if opcode == OP_TEXT:
                try:
                    out.append((time.monotonic(), json.loads(payload.decode())))
                except Exception:                    # noqa: BLE001
                    out.append((time.monotonic(), payload.decode(errors="replace")))
        return out

    def send(self, payload) -> None:
        body = json.dumps(payload).encode()
        # A client frame MUST be masked (RFC 6455); the server rejects nothing here,
        # but sending an unmasked one would test a protocol the real client never speaks.
        mask = hashlib.sha1(body).digest()[:4]
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(body))
        header = bytes([0x80 | OP_TEXT])
        if len(body) < 126:
            header += bytes([0x80 | len(body)])
        else:
            header += bytes([0x80 | 126]) + struct.pack(">H", len(body))
        self.sock.sendall(header + mask + masked)

    def close(self) -> None:
        try:
            self.sock.sendall(encode_frame(struct.pack(">H", 1000), OP_CLOSE))
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


def is_upgrade(headers) -> bool:
    """A WebSocket upgrade, or a plain GET of a socket path?

    The difference matters: a plain GET must keep answering the RECORDED 404 HTML page
    ("Only WebSocket connections are supported."), because that is the response that was
    recorded and serving a recording as something else is the instrument rewriting it.
    """
    upgrade = (headers.get("Upgrade") or "").lower()
    connection = (headers.get("Connection") or "").lower()
    return upgrade == "websocket" and "upgrade" in connection and bool(headers.get("Sec-WebSocket-Key"))
