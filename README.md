# Decal

An open-source ReaPrime skin for Decent Espresso and Bengle machines: Lit and Shadow
DOM, design tokens, container queries, landscape only, talking to ReaPrime over REST
and WebSocket.

## Running it

There is no build step. **The repo root is the served root** — ReaPrime serves the
skin directory as static files, so what is in the tree is what runs.

Install it on a machine by pointing ReaPrime at a zip of this tree:

```
POST /api/v1/webui/skins/install/url   {"url": "<url of the zip>"}
```

## Layout

| path | holds |
|---|---|
| `index.html` | the served entry point |
| `src/components/` | the component library — one element per file, no screen logic |
| `src/screens/` | the screens, composed from the library |
| `src/lib/` | DOM-free logic: models, derivations, formatting |
| `src/stores/` | state, one store per subject |
| `src/data/` | the address layer — every route and channel the skin uses |
| `styles/` | tokens and the document layer |
| `vendor/` | pinned third-party code, unmodified |
| `test/` | the suite, including render tests driven through headless Chrome |
| `tools/` | the mock server, fixtures and the gate scripts |

## Checks

```
npm run guards        # authored-CSS rules
npm run a8            # tests must not assert on source text
npm run gate-d        # route coverage against the pinned ReaPrime
npm run mock-contract # the mock answers what the fixtures record
npm run gate-wire     # every custom event has both an emitter and a listener
python3 tools/selfcheck.py
npm test              # the suite
```

`npm test` passes `--test-concurrency=4`. That cap is load-bearing: each render test
drives its own headless Chrome, and without it the suite becomes its own load source
and fails at random.

## Licence

See `LICENSE`.
