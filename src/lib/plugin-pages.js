/**
 * plugin-pages.js — the plugin pages this skin links to, named once.
 *
 * A plugin can serve HTML of its own, and two surfaces in Decal send a person to one:
 * the Plugins leaf's Open button, and — since 27 August 2026 — the Live screen's DYE2
 * button. Neither of them may hold the spelling itself, for two different reasons, and
 * this file is where those two reasons meet.
 *
 * WHY NOT IN `plugins-store.js`, WHICH IS OTHERWISE THE RIGHT PLACE. `pageUrl` lives
 * there and it is the one thing in this skin that turns a plugin and one of its endpoints
 * into an address, so a constant naming an endpoint looks like it belongs beside it. It
 * cannot: the Live SKELETON may not import a store. That is not a preference, it is a
 * pinned law — `test/live-screen.test.mjs` asserts over the source text of the five
 * skeleton files that none of them matches `from '…/stores/…'`, and the module header for
 * `live-screen.js` says why in the same breath ("the screen talks to stores and the
 * generated client, never an endpoint"). `src/lib/` is the layer both a screen and a store
 * may read: "plain ES modules with no DOM access" (SCOPE Part 2 §2).
 *
 * WHY NOT AS A LITERAL AT EACH CALL SITE, which is what the old skin did. `dyeStrip.js`
 * knew the DYE2 namespace, `shot-rating.js` sniffed for a plugin id with
 * `.includes('dye2')`, and `api.js` spelled its own paths — three places that each knew
 * part of "which plugin, and which of its pages", none of which could notice when the
 * plugin moved. A name that appears twice is a name that will disagree with itself.
 *
 * ============================================================================
 * WHAT A "PAGE" IS, ON THE WIRE
 * ============================================================================
 * `GET /api/v1/plugins` answers one manifest per installed plugin, and each manifest
 * carries an `api` array whose entries are `{id, type, data}`. A `type: "http"` entry is
 * reachable at `GET /api/v1/plugins/{pluginId}/{endpointId}` and the plugin decides what
 * comes back — JSON for a data endpoint, `text/html` for a page. Nothing on the wire
 * distinguishes the two, which is the whole reason this file exists: WHICH http endpoint
 * is a page for a person is knowledge that lives in the skin, not in the listing.
 *
 * THE CONVENTION COVERS THREE OF THE SIX BUNDLED PLUGINS AND NOT THE FOURTH. Settings
 * Viewer and the Decent Profile Generator each declare exactly one http endpoint and call
 * it `ui`; `settings-bespoke-leaf.js`'s `pluginPage()` finds those by that name, which is
 * why the Plugins leaf can draw an Open button for them without being told anything.
 * DYE2 declares FOUR http endpoints and none of them is `ui`, so the convention finds
 * nothing and the Plugins row correctly draws no Open button — a list cannot guess which
 * of four is the front door. This file is where being TOLD is recorded.
 */

/**
 * DYE2 — Streamline's bean, grinder and equipment manager.
 *
 * `id` IS THE MANIFEST'S OWN SPELLING, read off a recorded `GET /api/v1/plugins`
 * (`tools/rea-fixtures/api__v1__plugins.json`): `"id": "dye2.reaplugin"`, `"name":
 * "Streamline/DYE2"`, `"author": "Streamline"`. It is NOT derived from the display name
 * and it is NOT matched by substring — `ui-rating-control.js`'s header records the old
 * skin's `installed.id.includes('dye2')` as an A3 violation ("a capability discriminator
 * must be an explicit named thing rather than a substring match"), and an exact id is what
 * replaces it.
 *
 * `page` IS BEN'S CHOICE, NOT A DERIVATION. Ben, 27 August 2026: "Have the button open the
 * bean picker page for now, I need to do more work on this though." The manifest's four
 * http endpoints are `beans`, `grinders`, `bean-picker` and `grinder-picker`; the first
 * two are data for a caller that knows DYE2's shape, and of the two pickers Ben named the
 * bean one. Nothing here inferred that and nothing here should: a plugin's front door is
 * the plugin author's business and, until DYE2 declares one, a person's.
 *
 * "FOR NOW" IS THE SCOPE AND IT IS HONOURED LITERALLY. This pair is a destination and
 * nothing more — no shot id, no bean id, no query string, no return path. The old skin's
 * handoff was `window.openDye2ForShot(shotId)`, a global the audit measured as undefined
 * on the bench, so every tap did nothing at all. When Ben settles what the handoff should
 * CARRY, this is the object it is added to, and both call sites get it at once.
 *
 * ============================================================================
 * THE PLUGIN ALREADY HAS A RETURN CHANNEL, AND THIS SKIN CANNOT HEAR IT
 * ============================================================================
 * Read at the pin, in the plugin's own source
 * (`assets/plugins/dye2.reaplugin/plugin.js`), because a destination is worth knowing the
 * shape of before anyone builds more on it:
 *
 *   `renderBeanPickerPage` answers 200 with `Content-Type: text/html; charset=utf-8` — so
 *       it really is a page for a person, which is what Ben said it was. All four http
 *       endpoints exist; the two `-picker` ones answer HTML and the other two answer JSON.
 *
 *   AND WHEN A BATCH IS PICKED, `<dye2-bean-picker>` DOES THREE THINGS: it PUTs the
 *       workflow itself, it dispatches `picker-done` with
 *       `{beanBatchId, coffeeName, coffeeRoaster}`, and it calls
 *       `window.parent.postMessage({type: 'dye2-picker-done', …}, '*')`. That last one is
 *       reachable only by an EMBEDDER — a parent frame — and this skin opens the page in a
 *       NEW CONTEXT, where there is no parent to receive it.
 *
 * THAT IS A REAL LIMITATION, STATED RATHER THAN QUIETLY ACCEPTED. Nothing is broken by it:
 * the picker writes the workflow itself, so a bean chosen there reaches the machine whether
 * or not this skin hears about it, and the Live rail reads that same document. What the
 * new-context path cannot do is know a bean was picked AT THAT MOMENT and redraw; the
 * reader comes back to a screen that catches up on its next read.
 *
 * IT IS ALSO EXACTLY THE DECISION BEN RESERVED. "I need to do more work on this though" is
 * the sentence, and the shape of that work is now visible: an embedder listening for
 * `dye2-picker-done` is what Slate's own iframe overlay is (`dyeStrip.js`
 * `openPluginOverlay` — live code with three callers, not the dead surface it has been
 * described as). Whether Decal wants that overlay — as a component inside a shadow root,
 * never a graft onto `document.body` — is his call, and not one to make by building it.
 */
export const DYE2_PLUGIN = Object.freeze({
    id: 'dye2.reaplugin',
    page: 'bean-picker',
});

/** DYE2's plugin id, for matching a manifest in the listing. */
export const DYE2_PLUGIN_ID = DYE2_PLUGIN.id;

/** The one DYE2 endpoint this skin opens as a page. See `DYE2_PLUGIN` for why this one. */
export const DYE2_PAGE_ENDPOINT = DYE2_PLUGIN.page;
