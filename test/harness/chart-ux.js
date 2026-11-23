import { mountSelectorApp } from './selector-ux.js';
import {
    convertedShot, recordedShotList, RECORDED_SHOT_IDS, withoutTarget, withShotFlag,
} from '../fixtures/chart-shots.js';

export const CHART = 'app-root >>> editor-screen >>> #chart-panel';
export const PICKER = `${CHART} >>> #picker`;
export const TITLE = 'app-root >>> editor-screen >>> #editor-title';

export const USABLE_ID = RECORDED_SHOT_IDS[2];
export const DE1_ID = RECORDED_SHOT_IDS[0];

const SECOND_PAGE = 5;

export function chartShotData() {
    const first = recordedShotList();
    const items = first.items.map((item) => structuredClone(item));
    const de1Index = items.findIndex((item) => item.id === DE1_ID);
    items[de1Index] = withShotFlag(items[de1Index], true);
    const noTargetId = items[2].id;
    items[2] = withoutTarget(items[2]);
    const older = items.slice(10, 10 + SECOND_PAGE).map((item, i) => ({
        ...structuredClone(item),
        id: `${item.id.slice(0, -4)}${String(9000 + i)}`,
        timestamp: `2026-08-11T0${SECOND_PAGE - i}:00:00.000000`,
    }));
    const usable = convertedShot(USABLE_ID);
    const de1 = withShotFlag(convertedShot(DE1_ID), true);
    const noTarget = { ...withoutTarget(convertedShot(DE1_ID)), id: noTargetId };
    return {
        items: [...items, ...older],
        shots: { [USABLE_ID]: usable, [DE1_ID]: de1, [noTargetId]: noTarget },
        noTargetId,
        firstPage: items.length,
        olderIds: older.map((item) => item.id),
    };
}

export async function mountChartApp(page, data = chartShotData(), { starts = 1 } = {}) {
    const mounted = await mountSelectorApp(page);
    const opened = await page.evalFn(async (shotData, startCount) => {
        const { items, shots } = shotData;
        window.__shotReads = [];
        window.__uxRoutes = (u, method) => {
            if (method !== 'GET') return null;
            if (u.pathname === '/api/v1/shots') {
                const limit = Number(u.searchParams.get('limit')) || 20;
                const offset = Number(u.searchParams.get('offset')) || 0;
                window.__shotReads.push({ limit, offset, order: u.searchParams.get('order') });
                return { body: { items: items.slice(offset, offset + limit), total: items.length, limit, offset } };
            }
            const id = u.pathname.match(/^\/api\/v1\/shots\/([^/]+)$/)?.[1];
            if (!id) return null;
            const key = decodeURIComponent(id);
            const record = shots[key];
            const hold = window.__shotHolds?.[key]?.promise ?? null;
            return record ? { body: record, hold } : { body: { error: 'Not recorded' }, status: 404, hold };
        };
        const { FIT_STARTS } = await import('/src/lib/puck-multistart.js');
        __ux.boot.profileEditor.open(__ux.loaded);
        __ux.root.goto('editor');
        for (let i = 0; i < 100 && __ux.root.route !== 'editor'; i++) await new Promise(r => setTimeout(r, 20));
        await __ux.settle();
        const screen = __ux.screen();
        const panel = screen.shadowRoot.getElementById('chart-panel');
        panel.fitStarts = FIT_STARTS.slice(0, startCount);
        __ux.chart = () => __ux.screen().shadowRoot.getElementById('chart-panel');
        __ux.waitFit = async () => {
            for (let i = 0; i < 1500; i++) {
                const p = __ux.chart();
                if (p.fitResult && !p.fitResult.running) { await __ux.settle(); return true; }
                await new Promise(r => setTimeout(r, 20));
            }
            return false;
        };
        window.__shotHolds = {};
        __ux.holdShot = (key) => {
            let release;
            const promise = new Promise((r) => { release = r; });
            window.__shotHolds[key] = { promise, release: () => { delete window.__shotHolds[key]; release(); } };
        };
        __ux.releaseShot = (key) => window.__shotHolds[key]?.release();
        __ux.until = async (source) => {
            for (let i = 0; i < 250; i++) {
                if (Function(`return (${source})`)()) { await __ux.settle(); return true; }
                await new Promise(r => setTimeout(r, 20));
            }
            return false;
        };
        return { route: __ux.root.route, panel: Boolean(panel) };
    }, data, starts);
    return { ...mounted, ...opened };
}

export async function showChartTab(page) {
    await page.evalFn(async () => {
        __ux.screen().tab = 'chart';
        await __ux.settle();
    });
}
