# The socket half of the mock — every frame, and where its values come from

`tools/mock_rea.py` used to speak no WebSocket. said so and did not paper over it
Measured:

> The biggest remaining hole, stated not papered over … **the contract check is closed for REST
> and open for sockets.**

The nine `tools/rea-fixtures/ws__*.json` files are not frames. Each is a 226-byte recording
of the HTML page ReaPrime answers when a socket path is fetched over plain HTTP — *"Only
WebSocket connections are supported."* — and the only WebSocket code in the tree was
`test/harness/ws.js`, a CDP **client** that says in its own header that it is not a server.
So nothing could push a frame at the stores, and the 15 Hz render loop had no live feed to
be proved against.

`tools/ws_frames.py` closes it: the ten socket rows of `src/data/CONTRACTS.json`, served
over a real handshake. **This file is the derivation table** — the answer to "where did
that number come from" for every frame the instrument can send.
`tools/check_mock_contract.py check_socket_frames` holds the served frames to it by opening
the sockets and reading what actually arrives, and `test/mock-ws.test.mjs` runs the whole
thing inside `npm test`.

## The rule every frame obeys

The REST half may serve a recording, or a body **stated in full by its contract row**, and
otherwise answers 501/503 rather than invent one. The socket half obeys the same rule with
four honesty classes, and the class is the first column of every row below:

| class | what it means |
|---|---|
| **recorded** | every value is bytes out of a hashed fixture. A key may be **dropped**, never added, and no value is ever edited. |
| **derived** | every value comes from a recording through the rule in this file, and nowhere else. |
| **session** | the mock's own state **as a server** — whether it is scanning, what brightness it was told to hold, which device it has connected. Never presented as a machine measurement. |
| **unsourced** | no recording exists and the value is not the mock's to know. The channel is **SILENT** until a run script supplies it, and the mock says so on startup and at shutdown. |

A silent channel is the point, not a gap: a plausible frame standing where an absence
belongs is the defect this whole instrument exists to kill.

## The ten rows

| row | path | class | where the values come from |
|---|---|---|---|
| `machineSnapshot` | `/ws/v1/machine/snapshot` | recorded | `measurements[].machine` of the recorded shot, refuted keys dropped |
| `scaleSnapshot` | `/ws/v1/scale/snapshot` | derived | `weight`/`weightFlow` off the same recorded sample, under the names they live at now |
| `shotState` | `/ws/v1/machine/shotState` | session + recorded ids | the mock's own sequencer state; ids, substates and the stop reason are the recording's |
| `shotSettings` | `/ws/v1/machine/shotSettings` | **unsourced** | nothing records `De1ShotSettings`. Silent. |
| `waterLevels` | `/ws/v1/machine/waterLevels` | **unsourced** | no fixture in the set carries a water level. Silent. |
| `devices` | `/ws/v1/devices` | recorded + session | `devices[]` is `GET /api/v1/devices` verbatim; `scanning`/`connectionStatus` are session |
| `display` | `/ws/v1/display` | session | `DisplayState` is genuinely this server's own |
| `update` | `/ws/v1/update` | recorded + session | `currentVersion` from the recorded `GET /api/v1/info`; the rest is session |
| `sensorSnapshot` | `/ws/v1/sensors/<id>/snapshot` | derived | unknown id → `{"error":"not found"}` + **close**; the estimator's recorded channels under their live names when asked |
| `pluginEndpoint` | `/ws/v1/plugins/<id>/<endpoint>` | **unsourced** | 404 **before** the upgrade — the socket never opens |

Source fixtures, all inside the hashed set (`tools/FIXTURES.sha256`, 33 files):

* `api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json` — 426 measurement frames,
  221 203 bytes, 28.3 s, the longest of the three recorded shots. Its own sampling interval
  is 66.7 ms, i.e. 15 Hz.
* `api__v1__devices.json` — four `DeviceListEntry.toJson` rows.
* `api__v1__info.json` — `fullVersion`, for the update channel.

**`api__v1__shots__latest.json` is not usable and is not used.** It has no `measurements`
array at all (the flat summary shape) 's `test-shot-metrics-fixture-shape` suite
pins it as `ok:false`, and `ShotReplay` refuses a fixture with no measurements rather than
play an empty shot.

### No new fixture files, and that is deliberate

Every derived frame is computed **at run time** from the hashed set. Nothing is written to
`tools/rea-fixtures/`, so `tools/FIXTURES.sha256` is byte-identical and still verifies —
`python3 tools/mock_rea.py --check-fixtures` → *"fixture parity OK — 33 fixtures match"*.
A derived copy on disk would be a second thing to drift from the recording it came from,
and fixture parity is a final-review precondition, not a preference.

## The reshapes, one at a time

### 1. The machine frame: a key DROP, and nothing else

The recording is from an earlier run and its `machine` block predates ReaPrime `633f6f68`. It
carries nineteen keys: the twelve `MachineSnapshot` still writes, plus **eleven dead
names** — `weight`, `weightFlow`, `milkTemperature` ( and deleted these from
this frame) and the puck estimator's pre-rename channels `fusedConf`, `vAbs`, `estFlags`,
`detEventCount`, `estLag`, `fusedR1`, `fusedR2`, `fusedC`.

The rule: **keep the keys `SNAPSHOT_KEYS` and `SNAPSHOT_DERIVED_KEYS` name, drop the rest,
touch no value.**

Serving the block verbatim would teach the client a server that has not existed for months
— `deadKeysPresent()` exists precisely to report that as a defect. Editing the fixture to
remove them would stop it being a recording. Dropping them at serve time is the recording,
minus what the handler no longer sends, and `test/mock-ws.test.mjs` compares every served
frame with the fixture's own block key-for-key and value-for-value to prove it.

The three `*Derived` channels are **absent** from this recording, so they are absent from
the frames. That is legal and load-bearing: the row says derived channels are *"OMITTED,
not null"* and key presence is the whole validity test. The mock never writes one as null
(`socket-shape` fires if it does — canary `null-derived`).

### 2. The scale frame: two rows of the rename table

`measurements[].scale` is `null` on all 426 samples — this shot was pulled while the
gravimetric data still arrived on the machine block. `RENAMES` (rea-names.js) says exactly
where those two keys live now:

```
{ dead: 'weightFlow', live: 'weightFlow', on: 'scale', scope: 'machine',
  source: 'scale_controller.dart (WeightSnapshot.toJson); removed from MachineSnapshot in 633f6f68' }
{ dead: 'weight',     live: 'weight',     on: 'scale', … same commit }
```

So the derivation is: `timestamp`, `weight`, `weightFlow` verbatim from the recorded
machine block; `battery` and `timerValue` written **null**, because `WeightSnapshot.toJson`
writes both unconditionally and on this frame a null value — not an absent key — is the
absence signal.

The numbers are real gravimetric data: 181.56 g with the cup on the platform, tared to 0
at the start of the pour, **35.97 g** at the end against the recorded workflow's target
yield of 36.0.

**The caveat, stated:** the recording says no scale was attached, and the mock's scale
channel says one is (`{"status":"connected"}`, then frames). What it streams is recorded
real weight, carried under the key the handler uses today — but the *presence* of a scale
is the mock's claim, not the recording's. `--ws-scale absent` turns the channel into a
`{"status":"disconnected"}` envelope and no frames. See the deferred question in
the deferred-questions record.

### 3. Shot state: the mock's own sequencer, the recording's own ids

`ShotState` (idle/preheating/pouring/stopping/finished) is the **sequencer's** view, and
`feed-readers.js` warns in as many words that it is not the machine's enum and must not be
compared to it. So the mock does **not** map machine substates onto it — that mapping does
not exist in the handler and inventing one would be inventing a server. Instead:

* `state` follows the **playback phase**, which is genuinely the mock's own sequencer
  state: `pre-shot → preheating`, `in-shot → pouring`, `post-shot → finished`;
* `shotId` is the recorded shot's id; `machineState`, `machineSubstate` and `profileFrame`
  are the current recorded frame's own values;
* the terminal frame's `decision.reason` is the recording's `stopReason` — `machineEnded`,
  which is a `ShotDecisionReason` name;
* `machineHasAutonomousSAW` is a **session default of `false`** and is scriptable. Nothing
  records it; it is flagged here rather than left to be discovered.

### 4. Devices: the recorded list, the session's connection state

`devices[]` is `GET /api/v1/devices` verbatim — the same `DeviceListEntry.toJson` rows the
aggregator builds — with this session's connection state applied. The session **starts
where the recording stands**: the recorded list has one machine `connected`, so the session
does too, and `connectionStatus.phase` is `ready` rather than contradicting its own list.

`connectionStatus` writes all five keys unconditionally (`phase`, `foundMachines`,
`foundScales`, `pendingAmbiguity`, `error`) because `DevicesStateAggregator._buildSnapshot`
builds the map literally — on this frame an **absent** key is malformed, the opposite of
the machine snapshot's rule.

** is exercisable end to end.** A run script sets `devices.pendingAmbiguity` and the
frame parks in a selection session with `foundMachines` populated; a `connect` command
clears it, because `_connectDevice` routes a connect-while-parked to
`selectMachine`/`selectScale` — the answer, not a fresh connect. Consuming the state
without sending the answer is half the contract, and now both halves can be driven.

The command replies are the handler's own strings, silence included:

| sent | answered |
|---|---|
| no `command` key | `{"error": "Missing \"command\" field"}` |
| `connect`/`disconnect` with no `deviceId` | `{"error": "Missing \"deviceId\" for connect"}` |
| a `deviceId` not in the list | `{"error": "Device not found: <id>"}` |
| `connect` on a listed device | `{deviceId, operation, outcome, state, connectionError}`, then a state frame |
| `disconnect` | no reply — the state frame is the whole answer |
| anything else | **nothing**: the Dart switch has no default |

### 5. Display and update

`DisplayState` is genuinely this server's own state, so it is `session` throughout:
`brightness` is what `setBrightness` set, the wake lock is what the client asked for, and
`platformSupported` is `{brightness: true, wakeLock: true}` because this server really does
accept and reflect both. A non-int, out-of-range or unknown command is **dropped in
silence** — `display_handler.dart` logs a warning and sends nothing, and reproducing that
silence is the point: a helpful refusal would be a field the client could learn from its
instrument and never see from its server.

`update` carries the recorded `fullVersion` as `currentVersion` and holds `latestVersion`
**null** — "not known yet", never "up to date". `check` moves the phase to `error` saying
the offline mock has no recorded update service, rather than answering `idle` with a null
latest version, which reads as a clean bill of health. `install` answers the handler's own
unsupported-platform envelope, `{error, url}`, with a null url because none is recorded.

### 6. Sensors

An id the mock has no source for gets ReaPrime's own answer — `{"error":"not found"}` **and
the socket closes**. That close is the client's re-discovery trigger: the id
derives from the machine's deviceId, so a machine swap mints a new one and the old id is
dead for good. A socket that stayed open and silent would suppress the re-discovery, so
the default is the honest one.

With `--ws-sensors derived` (or `"sensors": "derived"` in a script) a `*-puckestimator` id
streams the recording's estimator channels under their live names, straight off `RENAMES`:

```
fusedConf → confidence   vAbs → absorbedVolume   estFlags → flags
detEventCount → collapseEventCount   estLag → lag
fusedR1 → r1   fusedR2 → r2   fusedC → compliance
```

**`rev`, `sigmaQ` and `lagConfidence` are ABSENT.** `encodeSample` always writes those six
today; this recording predates them, and the mock does not synthesise an always-present
channel. A frame that claimed them would be exactly the lie the instrument exists to stop.
Nothing sources a milk probe: the recorded `milkTemperature` is `0.0` on every sample,
which is an absence, not a measurement, so the milk-probe id gets the not-found close.

### 7. Plugins

No plugin payload is recorded anywhere. ReaPrime answers a plugin that is not loaded — or
an endpoint that is not of websocket type — with 404/400 **before** the upgrade, so the
socket never opens; the mock does the same. A socket that opened and then carried invented
events would be worse than one that never opens, and plugin absence degrades to
feature-absent, never to an error banner.

## Cadence, phases, and fire-and-forget

```bash
python3 tools/mock_rea.py                      # 10 Hz, the real cadence
python3 tools/mock_rea.py --ws-rate 15         # the 15 Hz loop proof
python3 tools/mock_rea.py --ws-phase in-shot   # start and stay mid-pour
python3 tools/mock_rea.py --ws-script <frames file>
```

**The default is 10 Hz** because that is what the channel does in a shot
(`rea-ws-channels.js`: *"The workhorse, ~10 Hz in a shot. The 15 Hz/66 ms figure elsewhere
is the render budget, not the socket rate."*). The recording's own sampling is 66.7 ms, so
at `--ws-rate 15` playback runs at wall-clock speed and the frame stamps advance in step
with it. **Frame timestamps are the recording's, verbatim** — at any other rate they
advance faster or slower than the wall clock, which matters to anything reading the frame
stamp as elapsed time and matters not at all to the store, whose staleness is measured from
arrival.

The phases map onto the recording's own `state.substate` transitions:

| phase | frames |
|---|---|
| `pre-shot` | the 90 recorded `espresso/preparingForShot` samples |
| `in-shot` | the remaining 336 (`preinfusion`, then `pouring`) |
| `post-shot` | the last recorded frame, **held** at the same cadence |
| `idle` | **no frames at all** |

`idle` is empty because **not one frame in the fixture set carries a machine state of
idle** — every recorded sample is mid-espresso. Holding an `espresso/preparingForShot`
frame and calling the phase idle would be the instrument relabelling a recording. The gap
is real, it is on the bench list, and it is written up in
the deferred-questions record.

**Fire and forget.** No channel replays history on connect:

* the telemetry channels start their playback clock **at connect**, so a second subscriber
  gets its own shot from the beginning rather than the first one's backlog, and what a
  chart draws is what that client buffered — the thing a loop proof is actually measuring;
* the state channels send their **current** state once and nothing older, which is
  ReaPrime's own behaviour: `_stateStream` is a `BehaviorSubject` (devices_handler.dart:15)
  and display/update listen the same way. One current frame is the state, not a backlog.

`socket-history` fires on **over-delivery**: more frames than the requested rate can
produce in the span they arrived over (canary `history-on-connect`). Two frames close
together prove nothing — the pump deliberately does not coalesce late steps, so a starved
reader sees exactly that — but a stream that delivers more than its own clock allows can
only be sending frames that predate the connection. `socket-cadence` fires when the
measured median gap is not the rate that was asked for (canary `cadence`); when too few
frames arrive to measure at all, the non-blocking `socket-thin` says so rather than failing
the build on the box's load.

## The run script

```json
{
  "rate": 15,
  "loop": false,
  "timeline": [{"phase": "pre-shot", "frames": 4},
               {"phase": "in-shot"},
               {"phase": "post-shot", "seconds": 2}],
  "waterLevels": {"currentLevel": 62.5, "refillLevel": 5.0},
  "shotSettings": {"steamSetting": 0, "targetSteamTemp": 160, "…": "…"},
  "devices": {"pendingAmbiguity": "machinePicker", "connected": []},
  "sensors": "derived",
  "scale": "derived",
  "machineHasAutonomousSAW": false
}
```

Everything a script can set is a **rate, a phase order, or a value no recording carries.**
Nothing in a script can change a recorded number: it chooses which recorded frames play and
when, never what they say. `waterLevels` is in **millimetres** (`{currentLevel, refillLevel}`
— mm→mL is skin-side and the 68-entry tank table has no ReaPrime counterpart) and
`shotSettings` must be the eight `De1ShotSettings` keys.

`shotSettings` is deliberately **not** derived from the recorded workflow's `steamSettings`:
`Workflow.steamSettings` and `De1ShotSettings` are different models, and mapping one onto
the other would be inventing a server. (The recorded workflow also carries a steam target
of 170 °C, which is a recorded value and not a bound — steam bounds live only in
`src/lib/machine-limits.js` and are reached through the R adapter.)

## What the checker asks, and the canaries

`python3 tools/check_mock_contract.py` now opens all ten rows. Its socket rules:

| rule | what it asks | canary |
|---|---|---|
| `socket-unvouched` | every row is served and every served channel has a row | — (parity is over two documents) |
| `socket-key-drift` | every key the contract table names is read by the **client** module for that channel | `--ws-canary key-drift` |
| `socket-shape` | keys vouched, required present, no dead name, no null derived channel | `--ws-canary dead-key`, `--ws-canary null-derived` |
| `socket-upgrade` | nine rows answer 101; the plugin row answers 404 first | — |
| `socket-cadence` | the measured rate is the requested one | `--ws-canary cadence`, a sixth of the rate |
| `socket-history` | no burst at the head of the stream | `--ws-canary history-on-connect` |

It runs **against the served fixture set only** (or with a canary), the same rule
`check_query_isolation` follows: pointing `--fixtures-dir` at a REST canary corpus says
nothing about the sockets, and a timing-sensitive probe has no business running inside the
twelve REST canary runs while the whole tree's suites compete for the box.

A derived frame cannot be canaried with a wrong file on disk the way a fixture can, so the
canaries bend **one derivation at a time** inside `ws_frames.Script`. Each fires exactly
one rule — a canary that trips someone else's rule proves nothing about its own — and
`test/mock-ws.test.mjs` asserts that.

`socket-key-drift` is the rule worth understanding: the client is held to the contract
table by `gate-d` and the mock is held to it by this checker, **separately**. A key that gets
renamed upstream and reaches one document but not the other would otherwise produce frames
nobody reads, silently, for as long as nobody looks. Naming a key the client never mentions
is now a build failure.
