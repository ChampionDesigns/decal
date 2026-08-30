# src/components/

One Lit component per file - `ui-stepper.js`, `ui-bank.js`, `x-dialog.js`,
`chart-card.js` ... the 57-component inventory of `LAYOUT_SPEC_DRAFT.md` §5.

Every component is a Lit element with Shadow DOM (DECISIONS.md, "Stack"), reads its
own container and never the viewport (`LAYOUT_SPEC_DRAFT.md` §2.1 Rule 1), and is
themed only through custom properties crossing the shadow boundary (A6). A component
never declares an `@font-face` - that is `styles/document.css` alone (C9, Part 2 §7).

**Start with [`CONVENTIONS.md`](CONVENTIONS.md).** It is the one file to read before
building a component: the base class, the one focus ring, the four selection dials,
the shared hit-area utility, the zero-`!important` mechanism and the vendor-stylesheet
pattern, each with its citation. The mechanism itself is `base.js` (Lit base class +
shared `css` fragments) and `../lib/base-conventions.js` (its DOM-free half).

`app-root.js` is a placeholder that exists so the skeleton boots; the shell replaces it.
