import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-freshness-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const ROW = 'machine-steam-temp';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a settings reading is only "now" while the feed is', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount over a real boot');
    });

    after(async () => { await page?.close(); });

    const reading = () => page.evalFn((row) => window.__freshness.readingOf(row), ROW);
    const frame = (patch) => page.evalFn((p) => window.__freshness.frame(p), patch);

    test('the shell runs exactly one staleness clock, with no screen asking for it', async () => {
        assert.equal(await page.evalFn(() => window.__freshness.tickers()), 1,
            'the feeds are the shell\'s, so their age is too');
    });

    test('a fresh frame is printed as a current reading', async () => {
        await frame({ steamTemperature: 150 });
        const said = await reading();
        assert.ok(said, `the ${ROW} row must be on the page`);
        assert.match(String(said.printed), /150/, 'the machine is talking, so the number is drawn');
        assert.notEqual(said.printed, said.dash);
    });

    test('a silent interruption stops the row calling it "now"', async () => {
        await frame({ steamTemperature: 150 });
        assert.match(String((await reading()).printed), /150/);

        await page.evalFn(() => window.__freshness.quietFor(5000));

        assert.equal(await page.evalFn(() => window.__freshness.feedStatus()), 'stale',
            'the shell aged it although the Live screen is not mounted');
        const said = await reading();
        assert.equal(said.printed, said.dash,
            'a reading nobody has taken for five seconds is not a current reading');
    });

    test('a frame that arrives after the gap brings the reading back', async () => {
        await page.evalFn(() => window.__freshness.quietFor(5000));
        assert.equal((await reading()).printed, (await reading()).dash);

        await frame({ steamTemperature: 151 });

        const said = await reading();
        assert.match(String(said.printed), /151/,
            'a frame is proof the source is back, and the row says so again');
    });

    test('an explicit socket close reads the same way as the silent gap', async () => {
        await frame({ steamTemperature: 150 });
        assert.match(String((await reading()).printed), /150/);

        await page.evalFn(() => window.__freshness.closeSocket());

        assert.equal(await page.evalFn(() => window.__freshness.feedStatus()), 'stale',
            'a source that said it went is a fact, not an age');
        const said = await reading();
        assert.equal(said.printed, said.dash,
            'the two interruptions must not read differently on the same page');

        await page.evalFn(() => window.__freshness.quietFor(600));
        const after_ = await reading();
        assert.equal(after_.printed, after_.dash);
    });
});
