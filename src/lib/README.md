# src/lib/

Pure logic with no DOM and no transport: profile-folders, shot metrics, exit-validity,
machine-limits ... the port-as-is and port-with-changes set,
in the order Gates 1-7 set.

`profile-rules.js` holds the five profile behaviours, transcribed
rather than ported, composing `profile-folders.js` (PORT-AS-IS) for the title ladder and
reaching the server only through an injected transport and the generated route table.

Plain ES modules with **no DOM access**, which is what makes them testable under
`node:test` without a browser.

One module here is not a port: `base-conventions.js` is the DOM-free half of the
base-element conventions. It lives here for exactly the reason
above - `src/components/base.js` imports `lit`, which cannot be imported under node,
so everything in item #2 that is pure logic (the token registries, the focus-variant
normalisation, the adopted-stylesheet merge) is split out to where it can be tested.
See `../components/CONVENTIONS.md`.
