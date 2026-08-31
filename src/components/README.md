# src/components/

One Lit component per file - `ui-stepper.js`, `ui-bank.js`, `ui-dialog.js`,
`ui-chart-card.js`, and the rest of the library.

Every component is a Lit element with Shadow DOM, reads its own container and never
the viewport, and is
themed only through custom properties crossing the shadow boundary. A component
never declares an `@font-face` - that is `styles/document.css` alone.

**Start with [`CONVENTIONS.md`](CONVENTIONS.md).** It is the one file to read before
building a component: the base class, the one focus ring, the four selection dials,
the shared hit-area utility, the zero-`!important` mechanism and the vendor-stylesheet
pattern, each with its citation. The mechanism itself is `base.js` (Lit base class +
shared `css` fragments) and `../lib/base-conventions.js` (its DOM-free half).

`app-root.js` is a placeholder that exists so the skeleton boots; the shell replaces it.
