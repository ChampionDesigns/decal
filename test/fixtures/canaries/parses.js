/**
 * CANARY - deliberately does not parse.
 *
 * THE HOLE THIS EXISTS FOR. `lost-stylesheet` catches a stray backtick inside a `css`
 * tagged template, which is the failure that has cost this project three sessions. It
 * cannot catch the same mistake inside an `html` template, and the reason is one line:
 * the block scanner extracts a template only when its tag is `css`
 * (scripts/lib/authored-css.js:188, `lastIdent === 'css'`). An `html` template is never
 * handed to a guard at all, so every signature in guard has nothing to look at.
 *
 * Found the way these always are: an agent hit the trap in an `html`
 * template, ran `npm run guards`, was told guard was OK, and lost a debugging cycle to a
 * green gate over a file that no longer parsed.
 *
 * WHY THIS CANARY IS SHAPED DIFFERENTLY FROM ITS NEIGHBOURS. Every other file in this
 * directory is valid JavaScript that violates a rule about its CONTENT, so the scanner can
 * read it. This one violates a rule about the file ITSELF, and the only way to violate it
 * is to be unparseable. That is also why the two guards do not replace each other: in a
 * `css` template the tail is usually still valid JavaScript and the file parses, which is
 * exactly why `lost-stylesheet` has to reason about comment openers and braces instead.
 * Here the tail is markup, so a parser is both the cheapest detector and the complete one.
 *
 * NOTHING MAY IMPORT THIS FILE. It is read as bytes by `parses`, which spawns
 * `node --check` over it, and it is outside guard's own scan roots (src, styles, tools,
 * index.html) so a real run never meets it.
 *
 * The trap is on the marked line: a backtick inside an HTML comment closes the template
 * that opened two lines above it, and everything after it is markup where JavaScript is
 * expected.
 */

const html = (strings, ...values) => strings.raw.join('');

export const face = html`
    <div class="row">
        <!-- the trap: this ` closes the template -->
        <span>a step</span>
    </div>`;
