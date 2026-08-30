# CANARY — deliberately violates adaptation 3 (SCOPE Part 10 §13, "NEUTRALISE dies").
#
# NOT A TOOL. Nothing imports this and nothing runs it. It exists so that
# `tools/selfcheck.py --residue-scan` can be proved to still bite:
# `test/tools-port.test.mjs` points the residue scan at this directory and asserts a
# NON-ZERO exit. "Every guard ships with a canary — all three old-guard failures were
# guards that silently stopped covering their target" (Part 8 §2, Gate C).
#
# The lines below are the hack as the Slate battery actually carried it: pin the
# fixed-size canvas, strip the scaling transform, do it before every shot.

NEUTRALISE = """
(() => {
  for (const id of ['scaling-container','scaled-content']) {
    const el = document.getElementById(id);
    if (el) Object.assign(el.style, {width:'1920px',height:'1200px',overflow:'hidden',transform:'none'});
  }
  return true;
})()
"""


async def shot(cdp, name):
    await cdp.js(NEUTRALISE)
