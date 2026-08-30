# src/lib/

The carry-forward destination (A7): profile-folders, shot metrics, exit-validity,
machine-limits ... the PORT-AS-IS and PORT-WITH-CHANGES set from `CARRY_FORWARD.md`,
in the order Gates 1-7 set.

`profile-rules.js` closes Gate 7: the five `profileManager.js` behaviours transcribed
rather than ported, composing `profile-folders.js` (PORT-AS-IS) for the title ladder and
reaching the server only through an injected transport and the generated route table.

Plain ES modules with **no DOM access**, which is what makes them testable under
`node:test` without a browser.

One module here is not a port: `base-conventions.js` is the DOM-free half of the
base-element conventions (Wave 0a item #2). It lives here for exactly the reason
above - `src/components/base.js` imports `lit`, which cannot be imported under node,
so everything in item #2 that is pure logic (the token registries, the focus-variant
normalisation, the adopted-stylesheet merge) is split out to where it can be tested.
See `../components/CONVENTIONS.md`.
