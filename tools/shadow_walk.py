#!/usr/bin/env python3
"""shadow_walk.py — the three shadow-DOM adaptations, in one place.

SCOPE Part 10 §13 ("Capture — what is taken from Decal, and how") lists three
adaptations the audit's instruments need before they can be pointed at a Lit tree.
All three live here so the battery and the probe cannot drift apart on them, and so
the capture agent's "VERIFY present, never work to do" precondition check has one
file to look at.

ADAPTATION 1 — THE ELEMENT WALK PIERCES SHADOW ROOTS.
    "The existing walker queries document.querySelectorAll('body *'); against a Lit
    tree it would see the screen hosts and almost nothing else. The Decal walker
    recurses into every element.shadowRoot, collecting the same record shape, and
    records each element's ANCHOR PATH — the chain of custom-element hosts down to it
    (`live-screen ▸ chart-card ▸ ui-button "1:1"`) — which the comparison uses as
    identity."
    `WALK_JS` below. The anchor path is the record's new `anchor` key; the host chain
    it was built from is kept as `hosts` because adaptation 2 needs it.

ADAPTATION 2 — CONSTRUCTED STYLESHEETS GET NAMES.
    "Lit's `static styles` become adoptedStyleSheets entries with no href; the probe
    labels each by its owning component tag so a provenance row reads
    `chart-card (adopted)` rather than an empty string."
    `label_sheet()` below. CDP gives a constructed sheet no sourceURL and no owner
    node, so the owning tag is recovered from the element's own position:

      * a `:host`/`:host-context` selector is a rule from the element's OWN shadow
        root, so the label is the element's own tag;
      * anything else that matched an element inside a shadow root came from THAT
        root's adopted sheets, so the label is the innermost host in the chain
        (`hosts[-1]`) — which is also right for `::slotted(...)`.

    Documented as a heuristic because it is one; it is a single function and reverses
    in one edit.

ADAPTATION 3 — NEUTRALISE DIES.
    "The baseline runs needed the 1920×1200 canvas pinned and the scaling transform
    stripped before every shot; Decal has nothing to neutralise. ANY RESIDUE OF
    THAT HACK IN THE PORTED BATTERY IS ITSELF A FINDING."
    There is no such constant in this tree, and `selfcheck.py` fails if one appears.
    Both instruments call the check before their first shot.

The 18-property appearance surface (`PROPS`) and the record keys are carried
UNCHANGED from `probe_provenance.py`, because the baseline corpus in
`slate-audit-2026-08-16/prov-baseline/` is the comparison's other half and a shape
change there is a shape change to the oracle. The only delta is the two added keys.
"""
from __future__ import annotations

import json
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[1]

#: The separator SCOPE Part 10 §13 writes anchor paths with.
ANCHOR_SEP = " ▸ "

#: The appearance surface — 18 properties, unchanged from the audit's probe.
PROPS = [
    "background-color", "color", "border-top-color", "border-top-width",
    "border-top-left-radius", "font-size", "font-weight", "font-family",
    "height", "min-height", "width", "padding-left", "box-shadow",
    "letter-spacing", "text-transform", "opacity", "gap", "background-image",
]
CAMEL = {
    "background-color": "backgroundColor", "color": "color",
    "border-top-color": "borderTopColor", "border-top-width": "borderTopWidth",
    "border-top-left-radius": "borderTopLeftRadius", "font-size": "fontSize",
    "font-weight": "fontWeight", "font-family": "fontFamily",
    "height": "height", "min-height": "minHeight", "width": "width",
    "padding-left": "paddingLeft", "box-shadow": "boxShadow",
    "letter-spacing": "letterSpacing", "text-transform": "textTransform",
    "opacity": "opacity", "gap": "gap", "background-image": "backgroundImage",
}

#: Baseline record keys, in the order prov-baseline writes them, plus the two the
#: shadow walk adds. `selfcheck.py` and the smoke run compare against this.
BASELINE_KEYS = ["i", "tag", "id", "cls", "role", "aria", "inline", "text", "rect",
                 "style", "moved", "frozen", "prov"]
ADDED_KEYS = ["anchor", "hosts"]

#: Adaptation 1. Sets `window.__probeEls` (index-aligned with the returned records)
#: because DOM.querySelectorAll does NOT pierce shadow roots: the caller resolves a
#: nodeId per element with Runtime.evaluate + DOM.requestNode instead, which does.
WALK_JS = r"""
(() => {
  const SEP = %SEP%;
  const CAMEL = %CAMEL%;
  const CONTROL = 'button,select,input,textarea,a[href],label,[role=button],[role=tab],'
                + '[role=radio],[role=switch],[role=option],[role=menuitem],[contenteditable]';
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','LINK','TEMPLATE','HEAD','META','TITLE','NOSCRIPT']);
  const out = [], els = [], seen = new Map();
  let i = 0;

  const ownText = (el) => [...el.childNodes]
      .filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')
      .trim().replace(/\s+/g, ' ');

  // A leaf descriptor: tag, plus #id or its own short text when it has one. Any
  // literal separator in the text is replaced so an anchor path never re-splits.
  const descriptor = (el) => {
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const t = ownText(el).replace(/▸/g, '-').slice(0, 24);
    if (t) d += ' "' + t + '"';
    return d;
  };

  const consider = (el, hosts) => {
    if (i > 1400) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.closest && el.closest('script,style,svg,head')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    if (r.bottom < -50 || r.top > 4000 || r.right < -50 || r.left > 3000) return;
    const isControl = el.matches(CONTROL);
    const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
                || cs.borderTopWidth !== '0px' || cs.borderLeftWidth !== '0px'
                || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none';
    const hasOwnText = !!ownText(el);
    if (!isControl && !paints && !hasOwnText) return;
    if (r.width * r.height < 80 && !isControl) return;

    let anchor = hosts.concat(descriptor(el)).join(SEP);
    const n = (seen.get(anchor) || 0) + 1;
    seen.set(anchor, n);
    if (n > 1) anchor += ' ·' + n;   // identity must be unique within a state

    el.setAttribute('data-probe-id', String(i));
    const style = {};
    for (const [k, v] of Object.entries(CAMEL)) style[k] = cs[v];
    out.push({
      i, tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 300),
      role: el.getAttribute('role') || '',
      aria: ['aria-pressed','aria-selected','aria-checked','aria-label','aria-disabled']
              .map((a) => el.getAttribute(a) ? a + '=' + el.getAttribute(a) : null).filter(Boolean).join(' '),
      inline: (el.getAttribute('style') || '').slice(0, 200),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      style,
      anchor,
      hosts: hosts.slice(),
    });
    els.push(el);
    i++;
  };

  // Shadow content first, then light-DOM children: the shadow root is where a
  // component's own chrome lives and where its light children get slotted, so
  // shadow-first is closest to visual order. Each descent through a shadowRoot
  // pushes that element's tag onto the host chain; light-DOM descent does not.
  const visit = (el, hosts) => {
    if (i > 1400) return;
    consider(el, hosts);
    if (el.shadowRoot) {
      const inner = hosts.concat(el.tagName.toLowerCase());
      for (const c of el.shadowRoot.children) visit(c, inner);
    }
    for (const c of el.children) visit(c, hosts);
  };

  document.querySelectorAll('[data-probe-id]').forEach((e) => e.removeAttribute('data-probe-id'));
  for (const c of document.body.children) visit(c, []);
  window.__probeEls = els;
  return out;
})()
""".replace("%CAMEL%", json.dumps(CAMEL)).replace("%SEP%", json.dumps(ANCHOR_SEP))

#: Re-read the 18 properties for exactly the elements the walk kept. Indexed off
#: `window.__probeEls`, so it works inside shadow roots where a selector query would
#: not reach.
FINGERPRINT_JS = r"""
(() => {
  const CAMEL = %CAMEL%;
  const els = window.__probeEls || [];
  const out = {};
  for (let k = 0; k < els.length; k++) {
    const cs = getComputedStyle(els[k]);
    const s = {};
    for (const [p, c] of Object.entries(CAMEL)) s[p] = cs[c];
    out[String(k)] = s;
  }
  return out;
})()
""".replace("%CAMEL%", json.dumps(CAMEL))


# --------------------------------------------------------------------------- #
# Adaptation 2 — naming constructed stylesheets
# --------------------------------------------------------------------------- #

_HOST_SEL = re.compile(r"(^|,)\s*:host\b", re.I)


def label_sheet(sheets: dict, sheet_id: str, selector: str, tag: str,
                hosts: list[str], rule_origin: str = "") -> str:
    """The provenance row's `sheet` value.

    `sheets` is the CDP `CSS.styleSheetAdded` index: styleSheetId -> header dict.
    A sheet with a sourceURL keeps its filename, exactly as the baseline corpus has
    it (`app.css`, `slate-live.css`). A constructed sheet — Lit's `static styles` —
    has none, and gets `<owning tag> (adopted)`.

    USER-AGENT RULES GET SAID OUT LOUD. They carry no styleSheetId at all, so the
    audit's version rendered them as an empty string — indistinguishable, in a Lit
    tree, from the unnamed constructed sheet this adaptation exists to name. A
    control whose winning value is a browser default is a real and interesting
    result (the base fixture's bare `<input>` is one), so it reads `<user-agent>`.
    """
    if sheet_id.startswith("<"):
        return sheet_id            # <inline> / <attr>: an element's own style attribute
    if rule_origin == "user-agent":
        return "<user-agent>"
    header = sheets.get(sheet_id) or {}
    # Query strings live in the last path segment; `index.html?state=x` is the same
    # document as `index.html` and must not read as two different sheets.
    name = (header.get("sourceURL") or "").split("?")[0].split("#")[0].split("/")[-1]
    if name:
        return name
    if hosts or header.get("isConstructed"):
        owner = tag if _HOST_SEL.search(selector or "") else (hosts[-1] if hosts else tag)
        return f"{owner} (adopted)" if owner else "<adopted:unowned>"
    origin = header.get("origin") or rule_origin or "?"
    return f"<inline:{origin}>"


# --------------------------------------------------------------------------- #
# The token perturbation, generated from the tree's own token sheets
# --------------------------------------------------------------------------- #

_DECL = re.compile(r"(--ui-[a-z0-9-]+)\s*:\s*([^;{}]+);")
#: Comments are stripped BEFORE the declaration scan. `--ui-*` names appear in the
#: token sheets' prose constantly — the oracle transcriptions quote them — and
#: `_DECL` cannot tell a sentence from a declaration. With `setdefault` keeping the
#: FIRST match, one prose mention shadowed the real thing: `--ui-tint-lever` was read
#: from the "NO ORACLE ANSWER for --ui-status-ok and --ui-tint-lever: neither
#: renders …" comment, its garbage value then failed `_NUM`, and the lever channel
#: colour was silently absent from the perturbation — so anything painted with it
#: would have measured FROZEN. Stripping first also stops a commented-OUT
#: declaration being perturbed as if it were live.
_COMMENT = re.compile(r"/\*.*?\*/", re.S)
_NUM = re.compile(r"^(-?\d*\.?\d+)([a-z%]*)$", re.I)
#: Multi-value shadow tokens. Matched on the NAME because their bodies
#: (`0 3px 12px rgb(0 0 0 / .35)`) parse as neither a colour nor a number. The
#: family is `--ui-elev-1/2/3` today; `shadow` is kept so a token named for the
#: property rather than the role is covered too. Missing them meant `box-shadow` —
#: one of the 18 measured properties — read FROZEN for every component that uses
#: elevation, which is a manufactured theming hole.
_SHADOWY = re.compile(r"shadow|elev", re.I)
_COLOUR_KEYWORDS = frozenset({"transparent", "currentcolor"})

_GARISH = ["#ff00aa", "#ccff00", "#00ffff", "#ff6600", "#0000ff", "#00ff88",
           "#ff00ff", "#ffcc00", "#88ff00", "#2d0036", "#7a00a0", "#330000"]


def token_sheets() -> list[pathlib.Path]:
    return [REPO / "styles" / "tokens.css", REPO / "styles" / "chart-channels.css"]


def build_perturb_js() -> tuple[str, dict]:
    """The drastic `:root` perturbation, derived from the token sheets themselves.

    The audit's probe hard-coded ~90 `--slate-*` overrides. Deriving them instead
    means the measurement cannot go quietly stale as tokens are added: a token that
    appears next week is perturbed the first time the probe runs, and a control that
    does not move under it is a theming hole (Part 10 §13, the token-adoption
    measurement).

    Tokens whose value is `var(...)`/`calc(...)` are deliberately NOT overridden —
    they derive from tokens that ARE, so they move on their own, and overriding them
    would hide a component that reads the derived token correctly.

    RETURNS `(js, report)`. The report is the point: a token this function cannot
    perturb is a hole in the measurement, and until it was reported the holes were
    invisible — four tokens fell out of the derivation through a bare `continue` and
    the only number anyone saw was the total. `report["skipped"]` is what
    `selfcheck.py` fails on and what the probe writes into `RUN.json`; `derived` and
    `motion` are the two DELIBERATE exclusions and are listed by name so the reader
    can tell an intended exclusion from an accident.
    """
    decls: dict[str, str] = {}
    for sheet in token_sheets():
        if not sheet.exists():
            continue
        for name, value in _DECL.findall(_COMMENT.sub("", sheet.read_text())):
            decls.setdefault(name, value.strip())

    lines, colour_i = [], 0
    derived: list[str] = []
    motion: list[str] = []
    skipped: list[dict] = []
    for name, value in decls.items():
        v = value.strip()
        low = v.lower()
        if "var(" in low or "calc(" in low:
            derived.append(name)                        # derived; moves on its own
            continue
        if _SHADOWY.search(name):
            new = "0 0 0 9px #ff00aa"
        elif (low.startswith("#") or low.startswith("rgb") or low.startswith("hsl")
              or low.startswith("oklch") or low in _COLOUR_KEYWORDS):
            # A COLOUR KEYWORD IS A COLOUR. `transparent` arrived with the preset row's
            # selection idiom (Ben, 23 Aug 2026: numbers with a line underneath, no
            # fill), and without this branch it fell through to the numeric matcher and
            # was reported as unperturbable — a token the drill could not prove is read.
            # Perturbing it to a garish colour is exactly the proof wanted: the cell
            # fills, so the dial IS being read.
            new = _GARISH[colour_i % len(_GARISH)]
            colour_i += 1
        elif "font-family" in name or "serif" in low or "system-ui" in low:
            new = '"Times New Roman", Times, serif'
        elif low.startswith("clamp(") or low.startswith("min(") or low.startswith("max("):
            new = "93px"
        elif low.startswith("cubic-bezier") or low.startswith("linear") or low.startswith("ease"):
            motion.append(name)                         # motion is outside the 18 props
            continue
        else:
            m = _NUM.match(v)
            if not m:
                skipped.append({"token": name, "value": v[:80], "why": "value is not a bare number"})
                continue
            num, unit = float(m.group(1)), m.group(2)
            sign = -1 if num < 0 else 1
            mag = abs(num)
            if unit in ("px",):
                new = f"{sign * (mag * 2 + 7):g}px"
            elif unit == "ms":
                new = f"{mag * 3 + 100:g}ms"
            elif unit in ("em", "rem", "ch", "cqi", "cqw", "%", "vw", "vh",
                          "dvh", "dvw", "svh", "svw", "lvh", "lvw"):
                # The dynamic/small/large viewport family is the same kind of length as
                # vw/vh and perturbs the same way. Added when --ui-live-foot-share
                # (18dvh, the Live band's proportional share) became the first token in
                # styles/ to use one and this drill reported it UNPERTURBED — which is
                # the coverage hole the perturbation self-check exists to find.
                new = f"{sign * (mag * 2 + 1):g}{unit}"
            elif unit == "":
                if mag <= 1:
                    new = "0.9"                          # opacity / density dials
                elif mag >= 100:
                    new = "900"                          # font weights, z-indexes
                else:
                    new = f"{mag * 3 + 1:g}"
            else:
                skipped.append({"token": name, "value": v[:80], "why": f"unhandled unit {unit!r}"})
                continue
        lines.append(f"  {name}: {new} !important;")

    css = (':root, [data-theme="dark"], [data-theme="light"] {\n'
           + "\n".join(lines) + "\n}")
    js = """
(() => {
  const css = %CSS%;
  let s = document.getElementById('__perturb');
  if (!s) { s = document.createElement('style'); s.id = '__perturb'; document.documentElement.appendChild(s); }
  s.textContent = css;
  return true;
})()
""".replace("%CSS%", json.dumps(css))
    report = {
        "tokens": len(decls),
        "overridden": len(lines),
        "derivedExcluded": sorted(derived),
        "motionExcluded": sorted(motion),
        "skipped": skipped,
        "sheets": [str(p.relative_to(REPO)) for p in token_sheets() if p.exists()],
    }
    return js, report


UNPERTURB_JS = "(() => { const s = document.getElementById('__perturb'); if (s) s.remove(); return true; })()"


if __name__ == "__main__":
    js, report = build_perturb_js()
    print(f"perturbation: {report['overridden']} of {report['tokens']} --ui-* tokens overridden, derived from")
    for s in token_sheets():
        print(f"  {s}")
    print(f"  deliberately excluded: {len(report['derivedExcluded'])} var()/calc()-derived, "
          f"{len(report['motionExcluded'])} motion")
    if report["skipped"]:
        print(f"  SKIPPED (holes in the measurement): {len(report['skipped'])}")
        for s in report["skipped"]:
            print(f"    {s['token']}: {s['why']} — {s['value']}")
    else:
        print("  skipped: none")
    print(f"anchor separator: {ANCHOR_SEP!r}")
    print(f"record keys: {BASELINE_KEYS} + {ADDED_KEYS}")
