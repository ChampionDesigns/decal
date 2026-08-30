# i18n/source/

The authored string table. `i18n/en.json` (and one file per language after it) is
GENERATED from here by `scripts/build-i18n.js` and committed, so contributors need no
toolchain — and because a committed artifact can go stale silently (the old tree's
`app.css` did exactly that), `test/i18n-freshness.test.js` regenerates and fails on a
diff. Edit here, then run:

    node scripts/build-i18n.js          # write i18n/<lang>.json
    node scripts/build-i18n.js --check  # exit 1 if anything committed is stale

v1 ships English only (D2) — but the *mechanism* ships in v1, because retrofitting it
later costs every component. The old skin fetched a 1.5 MB CSV at boot and translated
by walking the document (`document.querySelectorAll('[data-i18n-key]')`, then
overwriting `textContent`); a `querySelectorAll` cannot cross a shadow boundary, so
that approach is not slow here, it is impossible. `src/lib/i18n.js` replaces it: a
reactive value each component reads.

## Files

| File | What |
|---|---|
| `strings.json` | the key set, in one place, one entry per line. Authored. |
| `<lang>.json` | a flat `{ "<key>": "<translation>" }` map for one language. Add one to add a language; none exist in v1. |

## The rules the generator enforces

* **A key IS its English text.** `t('Save')`, not `t('editor.save')`. An untranslated
  string therefore renders as English, never as a bare identifier (key-as-fallback,
  carried from the old module).
* **Lookup is case-insensitive**, so two keys differing only in case are a build
  error — one would silently shadow the other. Ask for the casing you want on screen:
  for English the caller's own casing is returned, so `t('OFF')` renders `OFF` even
  though the table stores `Off`.
* **Placeholders are `{name}`** and are filled by `t(key, params)` — never by
  concatenating at the call site, which cannot survive a word-order change. A
  translation whose placeholders disagree with the key fails the build.
* **A missing or empty translation is absent from the generated file**, never
  back-filled with English at build time; the runtime falls back to the key. That
  keeps "untranslated" visible in the coverage report the generator prints.
* **A translation for a key that no longer exists fails the build**, as does a
  language file in `i18n/` with no source here.

## Where these 534 entries came from

Seeded once, mechanically, from the string surface the Slate app actually asks for:
every literal `getTranslation()` key and `data-i18n-key` attribute in
`~/bengle/_skinlab/slate` (read-only). That scan found **543 distinct literal keys
across 68 files**, and the only subtraction from it is **9 case-variants collapsed**
onto the spelling they duplicate — 543 − 9 = **534**.

A further **7 keys are built at runtime** from variables (`${...}`) and were never part
of that 543: a source scan cannot know what they evaluate to, so the extractor drops
them before counting and lists them separately in its report. They are not missing
entries — the screens that need them will author them. The extractor and its report are
run state, not product: `realine-run/waves/0a/i18n-seed/`.

That is a starting inventory of the app being rewritten, not a specification. Entries
are deleted as screens land without them and added as screens need them; from here the
table is authored by hand. The old one-shot scripts do not come across — `wire_i18n.mjs`
codemodded `data-i18n-key` into a file this rewrite deletes, and Lit templates mark
translatable strings at authoring time, so there is nothing to codemod. `i18n_audit.mjs`'s
*idea* survives as the generator's coverage report ("which strings have no
translation?") and, later, as a lint over the new marking convention.
