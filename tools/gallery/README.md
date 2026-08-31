# tools/gallery/ — the component gallery

A plain page that mounts components in their states. **Scaffolding, not shipping
surface**: no build step, no framework, no state model. item #4
add entries.

Open `tools/gallery/index.html` from any static server rooted at the repo (the the render harness
harness serves exactly that — `page.goto('/tools/gallery/index.html')`).

## Adding a component

Edit `entries.js`. That is the whole procedure — nothing else in the gallery changes.

```js
{
    id: 'ui-stepper',                                  // unique; usually the tag name
    title: 'Stepper',
    module: '../../src/components/ui-stepper.js',      // relative to tools/gallery/
    notes: 'what to look at',
    states: [
        { id: 'resting',  title: 'Resting',  html: '<ui-stepper value="93"></ui-stepper>' },
        { id: 'narrow',   title: 'In a 380px container',
          hostStyle: { 'inline-size': '380px' },
          html: '<ui-stepper value="93"></ui-stepper>' },
    ],
}
```

**`hostStyle` sizes the container, not the viewport.** It is how a state says "at
380px", which is the only honest way to show a component that reads its own container
rather than the viewport (LAYOUT_SPEC_DRAFT Rule 1). The viewport is the capture
battery's business — it drives the geometry matrix (1281×801 @ dsf 1.5, 1920×1200,
1000×600) over these same states.

**State ids are capture filenames.** A state's full id is `<entry.id>--<state.id>`;
renaming one is a re-baseline, so pick identifiers, not labels.

## What the capture battery uses

```js
window.__gallery.ready            // resolves after the first state has settled
window.__gallery.states()         // [{ id, title, entryId, stateId }, …]
await window.__gallery.show(id)   // mounts it, resolves when settled
document.body.dataset.galleryState    // the id currently shown
document.body.dataset.gallerySettled  // '1' once settled; absent while mounting
```

or just navigate: `index.html?state=<id>&theme=<light|dark>`.

**Shoot on `gallerySettled`.** Settling awaits every element's `updateComplete`
through the shadow tree, then `document.fonts.ready`, then two frames. A capture
taken one frame early is a baseline that is wrong forever — and the first baseline is
a human review, not a diff (the contract check).

`test/render/gallery.render.test.mjs` drives all of this the way the battery will, so
a gallery that stops mounting fails a test rather than photographing an empty stage.

## Notes

* The importmap here mirrors `index.html`'s with `../../` paths — **same keys**,
  re-rooted values. `test/gallery-registry.test.mjs` asserts key-for-key equality, because
  keeping it in step by hand failed the first time it mattered: the `src/` prefix was
  missing here, so `import { UiElement } from 'src/components/base.js'` — the bare
  form `src/components/CONVENTIONS.md` documents four times — resolved in the app and
  in the the render harness harness and threw in the gallery. It was invisible because the one
  entry that exists imports a relative path, and it would have surfaced as
  `gallerySettled` never being set: the battery writing `unsettled` after 45 s per
  state, per theme, per geometry. (The the render harness harness does not have this problem: it
  parses `index.html`'s importmap at serve time.)
* The gallery is a separate document rather than a route, because the app is "one
  document" and a route change swaps which screen is mounted inside `<app-root>`
  A tool does not belong in that document.
* the CSS guards scans this page. `tools/` and `index.html` are scan roots and the scanner
  reads HTML `<style>` elements, so the ~120 lines of chrome CSS below are guarded
  like any component's: a tool whose chrome drifts from the palette lies about what
  it is showing. It was already written entirely in `--ui-*` tokens; the difference
  is that the guard now knows.
* The one entry that exists today is item #2's `base-fixture` — not a
  shipping component, but a real one, so the gallery and the battery have a subject
  from the first night.
