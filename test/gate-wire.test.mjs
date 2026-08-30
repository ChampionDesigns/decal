
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    REPO_ROOT,
    BUILTIN_EVENTS,
    LEDGER_PATH,
    collectFiles,
    classifyValue,
    parseConstants,
    parseImports,
    resolveModule,
    findWrappers,
    forOfBindings,
    resolvePairArray,
    firstArgument,
    matchBracket,
    lineLocator,
    loadLedger,
    applyLedger,
    formatReport,
    runGateWire,
} from '../scripts/gate-wire.js';

const FIXTURES = join(REPO_ROOT, 'test/fixtures/gate-wire');
const gate = (name, extra = {}) => runGateWire({ root: join(FIXTURES, name), ...extra });
const events = (list) => list.map((v) => v.event).sort();
const knows = (report, name) => Boolean(report.emitters[name] || report.listeners[name]);

describe('gate-wire canaries — every rule fails on its fixture', () => {
    test('UNHEARD EMIT: a literal dispatch nothing listens for', () => {
        const r = gate('dead-emit');
        assert.equal(r.ok, false);
        assert.deepEqual(events(r.deadEmits), ['never-heard']);
        assert.deepEqual(r.orphanListeners, []);
        assert.equal(r.deadEmits[0].sites[0].file, 'src/component.js');
        assert.ok(r.deadEmits[0].sites[0].line > 0);
    });

    test('A REMOVE IS NOT A HEARING — the same fixture removes the listener it never adds', () => {
        const source = readFileSync(join(FIXTURES, 'dead-emit/src/component.js'), 'utf8');
        assert.match(source, /removeEventListener\('never-heard'/);
        assert.deepEqual(events(gate('dead-emit').deadEmits), ['never-heard'],
            'a removeEventListener must not put a name in the heard set');
    });

    test('ORPHAN LISTENER: a literal listener nothing emits', () => {
        const r = gate('orphan-listener');
        assert.equal(r.ok, false);
        assert.deepEqual(events(r.orphanListeners), ['never-emitted']);
        assert.deepEqual(r.deadEmits, []);
    });

    test('UNRESOLVED: a computed name position is refused, out loud, with the expression', () => {
        const r = gate('unresolvable');
        assert.equal(r.ok, false, 'unresolved is a FAILING category, never a silent pass');
        assert.equal(r.unresolved.length, 2);
        const exprs = r.unresolved.map((u) => u.expr).join('\n');
        assert.match(exprs, /addEventListener\(NAMES\[i\]/);
        assert.match(exprs, /CustomEvent\(`x-\$\{kind\}`/);
        for (const u of r.unresolved) {
            assert.equal(u.file, 'src/component.js');
            assert.ok(u.line > 0);
            assert.ok(u.why);
        }
        assert.ok(!knows(r, 'a-change') && !knows(r, 'b-change'),
            'and the array it indexes is NOT harvested — refusing means refusing');
    });

    test('WRAPPER: the unheard wrapped name is caught, the heard one is not', () => {
        const r = gate('wrapper');
        assert.equal(r.ok, false);
        assert.deepEqual(events(r.deadEmits), ['wrapped-dead']);
        assert.ok(r.emitters['wrapped-heard'], 'the wrapper attributes both call sites');
        assert.deepEqual(r.unresolved, [],
            "the wrapper's own new CustomEvent(type, …) is not a second site, and not unresolved");
    });

    test('MIXED TABLE: the builtin drops out, the custom name is caught', () => {
        const r = gate('mixed-table');
        assert.equal(r.ok, false);
        assert.deepEqual(events(r.orphanListeners), ['custom-x']);
        assert.ok(!knows(r, 'beforetoggle'), 'the builtin in the same table is in neither set');
    });

    test('STALE LEDGER: an entry that vouches nothing the gate reports fails the gate', () => {
        const stale = { entries: [{ event: 'long-gone', kind: 'unheard-emit', sites: [], reason: 'was consumed by the old gallery', added: '2026-08-29' }] };
        const r = gate('table-loop', { ledger: stale });
        assert.equal(r.ok, false, 'an exemption must never outlive its excuse');
        assert.equal(r.staleLedger.length, 1);
        assert.equal(r.staleLedger[0].event, 'long-gone');
        assert.match(formatReport(r), /STALE/);
    });

    test('LEDGER WITHOUT A REASON: rejected, because the reason IS the exemption', () => {
        const noReason = { entries: [{ event: 'never-heard', kind: 'unheard-emit', sites: ['src/component.js:10'], added: '2026-08-29' }] };
        const r = gate('dead-emit', { ledger: noReason });
        assert.equal(r.ok, false);
        assert.equal(r.ledgerErrors.length, 1);
        assert.match(r.ledgerErrors[0].why, /non-empty "reason"/);
        assert.deepEqual(events(r.deadEmits), ['never-heard'], 'and it vouches nothing');
    });

    test('LEDGER WITH AN UNKNOWN KIND: rejected rather than quietly ignored', () => {
        const bad = { entries: [{ event: 'never-heard', kind: 'probably-fine', reason: 'because I said so' }] };
        const r = gate('dead-emit', { ledger: bad });
        assert.equal(r.ok, false);
        assert.equal(r.ledgerErrors.length, 1);
    });
});

describe('gate-wire controls — the rules do not over-fire', () => {
    test('TABLE LOOP: Object.values(FROZEN_TABLE) registration resolves, both import forms', () => {
        const r = gate('table-loop');
        assert.equal(r.ok, true, formatReport(r));
        for (const name of ['step-change', 'value-commit', 'exit-remove', 'step-action']) {
            assert.ok(r.listeners[name], `${name} is heard through the loop / the constant`);
            assert.ok(r.emitters[name], `${name} is emitted`);
        }
        assert.deepEqual(r.unresolved, []);
    });

    test('THE DECOY IS NOT A WRAPPER — the required canary, on the fixture', () => {
        const r = gate('decoy');
        assert.equal(r.ok, true, formatReport(r));
        assert.deepEqual(Object.keys(r.emitters), ['offset-change']);
        for (const arg of ['slot-change', 'slide']) {
            assert.ok(!knows(r, arg), `${arg} is a reason in detail, not an event name`);
        }
    });

    test('BUILTINS: absent from both sets, both directions', () => {
        const r = gate('builtins');
        assert.equal(r.ok, true);
        assert.deepEqual(r.emitters, {});
        assert.deepEqual(r.listeners, {});
    });

    test('THE POSITION RULE: a frozen table of ids that ride in detail is not a name table', () => {
        const r = gate('position');
        assert.equal(r.ok, true, formatReport(r));
        for (const id of ['move-left', 'delete', 'insert-after']) {
            assert.ok(!knows(r, id), `${id} never stands in an event-name position`);
        }
        assert.ok(r.emitters['step-action'] && r.listeners['step-action']);
    });

    test('PROSE IS NOT CODE: a header that names a dead event in both directions', () => {
        const r = gate('prose');
        assert.equal(r.ok, true, formatReport(r));
        assert.ok(!knows(r, 'commented-only-event'));
        const source = readFileSync(join(FIXTURES, 'prose/src/component.js'), 'utf8');
        assert.match(source, /@fires commented-only-event/, 'and the fixture really does name it');
        assert.match(source, /new CustomEvent\('commented-only-event'/);
    });

    test('LEDGER ON DISK: a vouched violation is reported VOUCHED and does not fail', () => {
        const r = gate('ledger');
        assert.equal(r.ok, true, formatReport(r));
        assert.deepEqual(r.deadEmits, []);
        assert.equal(r.vouched.length, 1);
        assert.equal(r.vouched[0].event, 'ui-toast-dismiss');
        assert.match(formatReport(r), /VOUCHED/);
        assert.equal(loadLedger(join(FIXTURES, 'ledger')).entries.length, 1,
            'read off disk, not injected — the path the real gate takes');
    });

    test('a missing ledger is an empty ledger, never an error', () => {
        assert.deepEqual(loadLedger(join(FIXTURES, 'dead-emit')), { entries: [] });
    });
});

describe('the resolver', () => {
    test('classifyValue: strings, frozen tables, and everything else OPAQUE', () => {
        assert.deepEqual(classifyValue("'step-action';"), { kind: 'string', value: 'step-action' });
        const table = classifyValue("Object.freeze({A: 'a-x', B: 'b-x'})");
        assert.equal(table.kind, 'object');
        assert.deepEqual(table.values, ['a-x', 'b-x']);
        assert.deepEqual(classifyValue("Object.freeze(['a', 'b'])").values, ['a', 'b']);
        assert.deepEqual(classifyValue("['a', 'b'];").values, ['a', 'b']);
        assert.equal(classifyValue("Object.freeze({A: 'a', B: someExpr})").kind, 'opaque',
            'one non-literal value makes the whole table opaque — no partial guessing');
        assert.equal(classifyValue('buildName(prefix);').kind, 'opaque');
    });

    test('parseConstants / parseImports', () => {
        const code = "export const A = 'a-x';\nconst B = 'b-x';\nimport { C, D as E } from './x.js';\n";
        const consts = parseConstants(code);
        assert.equal(consts.get('A').value, 'a-x');
        assert.equal(consts.get('B').value, 'b-x');
        const imports = parseImports(code);
        assert.deepEqual(imports.get('C'), { imported: 'C', spec: './x.js' });
        assert.deepEqual(imports.get('E'), { imported: 'D', spec: './x.js' });
    });

    test('a name declared twice with different values is opaque, not the last one seen', () => {
        const consts = parseConstants("const A = 'one';\nfunction f() { const A = 'two'; }\n");
        assert.equal(consts.get('A').kind, 'opaque');
    });

    test('resolveModule: relative, the import-map src/ prefix, and bare = external', () => {
        assert.equal(resolveModule('src/screens/a.js', '../lib/b.js'), 'src/lib/b.js');
        assert.equal(resolveModule('src/screens/a.js', './b.js'), 'src/screens/b.js');
        assert.equal(resolveModule('src/screens/a.js', 'src/components/c.js'), 'src/components/c.js');
        assert.equal(resolveModule('src/screens/a.js', 'lit'), null, 'vendor is external, never guessed');
    });

    test('findWrappers: the type argument must BE the first parameter', () => {
        const real = "class X {\n    #emit(type, detail) {\n        this.dispatchEvent(new CustomEvent(type, { detail }));\n    }\n    next() {}\n}\n";
        assert.deepEqual([...findWrappers(real).keys()], ['#emit']);
        const decoy = "class X {\n    #emit(reason) {\n        this.dispatchEvent(new CustomEvent('offset-change', { detail: { reason } }));\n    }\n    next() {}\n}\n";
        assert.deepEqual([...findWrappers(decoy).keys()], [], 'the decoy shape is not a wrapper');
    });

    test('forOfBindings and the pair-array shape', () => {
        const loops = forOfBindings('for (const name of Object.values(T)) host.addEventListener(name, f);');
        assert.equal(loops.length, 1);
        assert.equal(loops[0].kind, 'value');
        assert.equal(loops[0].iter, 'Object.values(T)');
        const pair = forOfBindings('for (const [type, fn] of listeners) socket.addEventListener(type, fn);');
        assert.equal(pair[0].kind, 'pair');
        assert.deepEqual(resolvePairArray("const listeners = [\n    ['open', a],\n    ['close', b],\n];", 'listeners'), ['open', 'close']);
        assert.equal(resolvePairArray("const listeners = [\n    [key, a],\n];", 'listeners'), null,
            'a pair whose head is not a literal makes the whole array unresolved');
    });

    test('firstArgument and matchBracket', () => {
        assert.deepEqual(firstArgument("f('a-x', {})", 1).value, 'a-x');
        assert.equal(firstArgument('f(NAME, {})', 1).expr, 'NAME');
        assert.equal(firstArgument('f(T.KEY, {})', 1).expr, 'T.KEY');
        assert.equal(firstArgument('f(names[i], {})', 1).kind, 'opaque');
        assert.equal(matchBracket("f('a)b')", 1), 7, 'a bracket inside a string does not close it');
    });

    test('lineLocator finds a site by its own text, and says when it could not', () => {
        const locate = lineLocator('one\ntwo\nnew CustomEvent("x")\n');
        assert.deepEqual(locate('emit', 'new CustomEvent("x"'), { line: 3, exact: true });
        assert.equal(locate('emit', 'nothing like this').exact, false);
    });

    test('applyLedger matches an unresolved entry by file:line', () => {
        const violations = {
            deadEmits: [],
            orphanListeners: [],
            unresolved: [{ file: 'src/x.js', line: 41, expr: 'addEventListener(names[i], …)' }],
        };
        const ledger = { entries: [{ event: 'names[i]', kind: 'unresolved', sites: ['src/x.js:41'], reason: 'hand-checked: the array is local and both names are heard' }] };
        const applied = applyLedger(ledger, violations);
        assert.equal(applied.vouched.length, 1);
        assert.deepEqual(applied.alive.unresolved, []);
        assert.deepEqual(applied.stale, []);
    });
});

describe('gate-wire over this repo', () => {
    const report = runGateWire();

    test('it scans every .js under src/ and nothing else', () => {
        const files = collectFiles();
        assert.ok(files.length >= 200, `${files.length} files scanned`);
        assert.equal(report.files, files.length);
        assert.ok(files.every((f) => f.path.startsWith('src/') && f.path.endsWith('.js')));
        assert.ok(files.some((f) => f.path === 'src/components/ui-compare-bar.js'));
        assert.ok(!files.some((f) => f.path.startsWith('vendor/') || f.path.startsWith('tools/')));
    });

    const BAR = 'src/components/ui-compare-bar.js';
    test('THE DECOY, ON THE REAL FILE THE RULE WAS WRITTEN AGAINST', () => {
        const fromBar = (name) => [...(report.emitters[name] || []), ...(report.listeners[name] || [])]
            .filter((s) => s.file === BAR);
        assert.equal(fromBar('offset-change').length, 1, "the decoy's ONE real event is attributed to it");
        for (const arg of ['slot-change', 'slide']) {
            assert.deepEqual(fromBar(arg), [],
                `'${arg}' is a reason in detail — it must not enter the universe from ui-compare-bar`);
        }
    });

    test('the historical indirections still resolve — no wolf-crying on the real tree', () => {
        for (const name of ['step-change', 'value-commit', 'exit-condition-change', 'lever-change', 'exit-remove']) {
            assert.ok(report.listeners[name], `${name} is heard through the EDITOR_EDIT loop`);
        }
        for (const name of ['header-action', 'library-open', 'favourite-select']) {
            assert.ok(report.listeners[name], `${name} is heard through the INTENT_EVENTS loop`);
        }
        assert.ok(report.listeners['ui-app-fit'], 'FIT_EVENT resolves across the import');
        assert.ok(report.listeners['step-action'], 'STEP_ACTION resolves across the import map prefix');
    });

    test('every reported site carries a file and a real line', () => {
        const all = [...Object.values(report.emitters).flat(), ...Object.values(report.listeners).flat()];
        assert.ok(all.length > 100, `${all.length} sites`);
        for (const s of all) {
            assert.match(s.file, /^src\/.*\.js$/);
            assert.ok(Number.isInteger(s.line) && s.line > 0, JSON.stringify(s));
        }
    });

    test('it reports its own cost, every run', () => {
        assert.ok(report.scanMs > 0);
        assert.match(formatReport(report), /^gate-wire: \d+ files, scan [\d.]+ ms$/m);
    });

    test('the verdict is well formed whichever way it goes', () => {
        assert.equal(typeof report.ok, 'boolean');
        for (const key of ['deadEmits', 'orphanListeners', 'unresolved', 'vouched', 'staleLedger', 'ledgerErrors']) {
            assert.ok(Array.isArray(report[key]), key);
        }
        assert.equal(report.ok, report.deadEmits.length + report.orphanListeners.length
            + report.unresolved.length + report.staleLedger.length + report.ledgerErrors.length === 0);
    });

    test('the ledger ships with the repo, and its absence is not an error', () => {
        /* Under tools/, not beside the audit notes: the vouches are part of the gate and
           have to travel with it. */
        assert.equal(LEDGER_PATH, 'tools/wire-ledger.json');
        assert.ok(Array.isArray(loadLedger().entries));
        assert.equal(report.ledgerReadError, null);
    });

    test('BUILTIN_EVENTS is fixed, visible, and covers the names this tree really uses', () => {
        for (const name of ['click', 'change', 'input', 'keydown', 'pointerdown', 'focusin',
            'scroll', 'resize', 'slotchange', 'beforetoggle', 'close', 'cancel', 'open',
            'error', 'abort', 'message', 'hashchange']) {
            assert.ok(BUILTIN_EVENTS.has(name), name);
        }
        for (const name of ['step-action', 'exit-add', 'offset-change', 'library-open']) {
            assert.ok(!BUILTIN_EVENTS.has(name), `${name} is a skin event and must stay visible`);
        }
    });
});
