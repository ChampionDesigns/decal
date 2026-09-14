/**
 * The Settings machine pages and the Live rail edit one workflow document.
 *
 * Drives the shipped composition — one boot, one workflow store — and reads both surfaces
 * after a settings save, a rail press and a refused write.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-workflow-fixture.js'];
const STAGE = '<div id="stage"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('Settings and Live over one workflow document', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        assert.deepEqual(page.pageErrors, [], 'the boot must assemble without throwing');
    });

    after(async () => { await page?.close(); });

    const reset = () => page.evalFn(() => window.__wf.reset());

    test('the composition root takes the boot\'s store rather than building a second', async () => {
        await reset();
        assert.equal(await page.evalFn(() => window.__wf.sharesStore()), true,
            'a second store is a second answer to one document, which is the whole defect');
    });

    test('a target saved in Settings is what the rail then reads', async () => {
        await reset();
        const said = await page.evalFn(async () => {
            await window.__wf.openLeaf('machine-flush');
            const before_ = window.__wf.railTargets().flushTemp;
            const staged = await window.__wf.stage('machine-flush', 'flushTemp', 92);
            const commit = await window.__wf.commit();
            return {
                before: before_,
                staged: staged.staged,
                commit,
                railAfter: window.__wf.railTargets().flushTemp,
                served: window.__wf.served().rinseData.targetTemperature,
            };
        });

        assert.equal(said.before, 90, 'the rail opened on the served value');
        assert.equal(said.staged, true, 'a machine row stages rather than writing on the press');
        assert.equal(said.commit.ok, true, `the machine took the write: ${JSON.stringify(said.commit)}`);
        assert.equal(said.served, 92, 'the machine holds the new value');
        assert.equal(said.railAfter, 92,
            'and so does the store the Live rail is subscribed to');
    });

    test('a target stepped on the rail reaches an open settings page without a re-read', async () => {
        await reset();
        const said = await page.evalFn(async () => {
            await window.__wf.openLeaf('machine-flush');
            const onEntry = window.__wf.settingsValue('flushTemp');

            await window.__wf.railPress('flushTemp', 94);
            return {
                onEntry,
                settingsAfter: window.__wf.settingsValue('flushTemp'),
                served: window.__wf.served().rinseData.targetTemperature,
            };
        });

        assert.equal(said.onEntry, 90, 'the page opened on the served value');
        assert.equal(said.served, 94, 'the machine took the press');
        assert.equal(said.settingsAfter, 94,
            'the open settings page agrees with the machine rather than with its entry read');
    });

    test('an edit staged in Settings survives a rail press on another field', async () => {
        await reset();
        const said = await page.evalFn(async () => {
            await window.__wf.openLeaf('machine-flush');
            await window.__wf.stage('machine-flush', 'flushTemp', 95);
            const stagedBefore = window.__wf.changeCount();
            await window.__wf.railPress('flushFlow', 7);
            return {
                stagedBefore,
                stagedAfter: window.__wf.changeCount(),
                flushTemp: window.__wf.settingsValue('flushTemp'),
                flushFlow: window.__wf.settingsValue('flushFlow'),
            };
        });

        assert.equal(said.stagedBefore, 1);
        assert.equal(said.stagedAfter, 1, 'a document arriving must not clear a staged edit');
        assert.equal(said.flushTemp, 95,
            'a staged edit outranks the document, exactly as it does across a page re-read');
        assert.equal(said.flushFlow, 7, 'while the field the rail moved followed it');
    });

    test('a refused save leaves both surfaces on what the machine actually holds', async () => {
        await reset();
        const said = await page.evalFn(async () => {
            await window.__wf.openLeaf('machine-flush');
            window.__wf.refuse(true);
            await window.__wf.stage('machine-flush', 'flushTemp', 99);
            const commit = await window.__wf.commit();
            return {
                commit,
                rail: window.__wf.railTargets().flushTemp,
                served: window.__wf.served().rinseData.targetTemperature,
                stillStaged: window.__wf.changeCount(),
            };
        });

        assert.equal(said.commit.ok, false, 'a refused write is reported as one');
        assert.equal(said.served, 90, 'the machine never took it');
        assert.equal(said.rail, 90,
            'so the rail must not have been moved by a write that did not happen');
        assert.ok(said.stillStaged > 0, 'and the edit is still the person\'s to save');
    });
});
