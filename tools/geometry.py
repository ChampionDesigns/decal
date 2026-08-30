#!/usr/bin/env python3
"""geometry.py — the capture matrix, PARSED from `test/harness/geometry.js`.

Gate B change 2 is "each state is captured at the geometry matrix, not one size:
1281x801 @ dsf 1.5 (bench), 1920x1200 (desktop), 1000x600 (floor)" (SCOPE Part 8 §2).
Gate A's harness already owns those three numbers in `test/harness/geometry.js`, and
they are the same three numbers.

So this file PARSES that module rather than restating it. By construction, not by
copy — the same argument `test/harness/server.js` makes for reading index.html's
importmap at serve time: a copy drifts silently, and the day someone changes the
bench geometry the Python side would keep photographing the old one and every
capture would still look green. If the JS stops having the shape this parser
expects, this raises rather than guessing.

The parse is deliberately narrow: `export const NAME = Object.freeze({ ... });`
blocks with `name`/`width`/`height`/`deviceScaleFactor` keys, plus the
`CAPTURE_MATRIX` array that fixes their ORDER (bench, desktop, floor — Part 8 §2
change 2 lists it that way and the capture sets are named after it).
"""
from __future__ import annotations

import pathlib
import re
from typing import NamedTuple

REPO = pathlib.Path(__file__).resolve().parents[1]
GEOMETRY_JS = REPO / "test" / "harness" / "geometry.js"

_BLOCK = re.compile(r"export\s+const\s+(\w+)\s*=\s*Object\.freeze\(\{(.*?)\}\)\s*;", re.S)
_MATRIX = re.compile(r"export\s+const\s+CAPTURE_MATRIX\s*=\s*Object\.freeze\(\[(.*?)\]\)", re.S)
_KEY = {
    "name": re.compile(r"\bname\s*:\s*'([^']+)'"),
    "width": re.compile(r"\bwidth\s*:\s*([0-9.]+)"),
    "height": re.compile(r"\bheight\s*:\s*([0-9.]+)"),
    "deviceScaleFactor": re.compile(r"\bdeviceScaleFactor\s*:\s*([0-9.]+)"),
}


class Geometry(NamedTuple):
    name: str
    width: int
    height: int
    dsf: float

    @property
    def label(self) -> str:
        d = f"{self.dsf:g}"
        return f"{self.width}x{self.height}@dsf{d}"


def _parse() -> tuple[dict[str, Geometry], list[Geometry]]:
    if not GEOMETRY_JS.exists():
        raise SystemExit(f"geometry.py: {GEOMETRY_JS} is missing — Gate A's harness owns the numbers")
    src = GEOMETRY_JS.read_text()

    by_const: dict[str, Geometry] = {}
    for const, body in _BLOCK.findall(src):
        got = {}
        for key, rx in _KEY.items():
            m = rx.search(body)
            if not m:
                break
            got[key] = m.group(1)
        if len(got) != len(_KEY):
            continue  # not a geometry object; ignore quietly
        by_const[const] = Geometry(
            name=got["name"],
            width=int(float(got["width"])),
            height=int(float(float(got["height"]))),
            dsf=float(got["deviceScaleFactor"]),
        )

    m = _MATRIX.search(src)
    if not m:
        raise SystemExit("geometry.py: no CAPTURE_MATRIX in geometry.js — Gate B change 2 has no order")
    order = [c.strip() for c in m.group(1).split(",") if c.strip()]
    missing = [c for c in order if c not in by_const]
    if missing:
        raise SystemExit(f"geometry.py: CAPTURE_MATRIX names {missing}, which did not parse as geometries")

    return {by_const[c].name: by_const[c] for c in by_const}, [by_const[c] for c in order]


BY_NAME, CAPTURE_MATRIX = _parse()
BENCH = BY_NAME["bench"]
DESKTOP = BY_NAME["desktop"]
FLOOR = BY_NAME["floor"]


def select(names: str | None) -> list[Geometry]:
    """`--geometry bench,floor` -> the matrix filtered, in matrix order."""
    if not names:
        return list(CAPTURE_MATRIX)
    want = [n.strip() for n in names.split(",") if n.strip()]
    unknown = [n for n in want if n not in BY_NAME]
    if unknown:
        raise SystemExit(f"unknown geometry {unknown}; have {sorted(BY_NAME)}")
    return [g for g in CAPTURE_MATRIX if g.name in want]


if __name__ == "__main__":
    print(f"parsed from {GEOMETRY_JS}")
    for g in CAPTURE_MATRIX:
        print(f"  {g.name:8s} {g.label}")
