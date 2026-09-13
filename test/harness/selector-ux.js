/** Full app fixture for profile UX. REST writes are local in-memory responses. */
export async function mountSelectorApp(page) {
    await page.mount('', ['/src/components/app-root.js']);
    return page.evalFn(async () => {
        const { createAppBoot } = await import('/src/lib/app-boot.js');
        const { createMemoryBackend } = await import('/src/lib/storage-backends.js');
        const { LAYERS } = await import('/src/lib/storage-routes.js');
        const { FEED } = await import('/src/stores/live-stores.js');
        const rawFetch = fetch.bind(window);
        const fixture = async path => {
            const name = path.replace(/^\/+|\/+$/g, '').replaceAll('/', '__').replaceAll('?', '~').replaceAll('&', '~') + '.json';
            const result = await rawFetch('/tools/rea-fixtures/' + name);
            if (!result.ok) return null;
            try { return await result.json(); } catch { return null; }
        };
        const records = await fixture('/api/v1/profiles?includeHidden=true');
        const visible = records.filter(r => r.visibility === 'visible');
        const loaded = visible.find(r => r.profile.title === 'Gentle and sweet') ?? visible[0];
        const selected = visible.find(r => r.profile.title === 'Classic Italian espresso') ?? visible[1];
        const workflow = await fixture('/api/v1/workflow');
        workflow.profile = structuredClone(loaded.profile);
        const kv = new Map([['favouriteProfiles', { 0: loaded.id }], ['favouriteProfilesSeeded', true]]);
        const calls = [], control = { failFavourite: false, holdFavourite: false,
            failProfile: false, holdProfile: false, release: null };
        const json = (value, status = 200) => new Response(JSON.stringify(value), {
            status, headers: { 'content-type': 'application/json' },
        });
        const fetchMock = async (url, init = {}) => {
            const u = new URL(url, location.href), method = init.method ?? 'GET';
            let body; try { body = JSON.parse(init.body); } catch { body = null; }
            calls.push({ path: u.pathname, method, body });
            const key = u.pathname.match(/\/store\/[^/]+\/(.+)$/)?.[1];
            if (key) {
                if (method === 'GET') return kv.has(key) ? json(kv.get(key)) : json({}, 404);
                if (key === 'favouriteProfiles') {
                    if (control.holdFavourite) await new Promise(resolve => control.release = resolve);
                    if (control.failFavourite) return json({ error: 'Storage unavailable' }, 503);
                }
                kv.set(key, body); return json(body);
            }
            if (u.pathname === '/api/v1/profiles') {
                if (method === 'GET') return json(records);
                if (control.holdProfile) await new Promise(resolve => control.release = resolve);
                if (control.failProfile) return json({ error: 'Profile service unavailable' }, 503);
                const added = { id: 'profile:imported', profile: body.profile ?? body,
                    visibility: 'visible', isDefault: false, metadata: {} };
                records.push(added); return json(added, 201);
            }
            if (u.pathname === '/api/v1/workflow') {
                if (method !== 'GET') Object.assign(workflow, body);
                return json(workflow);
            }
            if (u.pathname === '/api/v1/plugins') return json([{
                id: 'decent-profile.reaplugin', name: 'Decent Profile Generator', loaded: true,
            }]);
            if (u.pathname === '/api/v1/machine/info') return json({ model: 'Bengle', version: '282', serialNumber: 'Bengle', GHC: true, extra: { profileModeCaps: 15 } });
            if (method !== 'GET') return json(body ?? {});
            const data = await fixture(u.pathname + u.search);
            return data === null ? json({ error: 'Not recorded' }, 503) : json(data);
        };
        const boot = createAppBoot({ fetch: fetchMock,
            createSocket: url => ({ url, addEventListener() {}, removeEventListener() {}, close() {}, send() {} }),
            backends: { [LAYERS.local]: createMemoryBackend(), [LAYERS.session]: createMemoryBackend() },
            location: { hostname: '127.0.0.1', protocol: 'http:' }, importModule: s => import(s),
        });
        const root = document.createElement('app-root'); root.boot = boot;
        document.getElementById('mount').append(root);
        for (let i = 0; i < 250 && boot.state.phase !== 'ready'; i++) await new Promise(r => setTimeout(r, 20));
        boot.live.feed(FEED.MACHINE).accept({ timestamp: new Date().toISOString(), state: { state: 'idle', substate: 'idle' }, groupTemperature: 93, steamTemperature: 150, pressure: 0, flow: 0 });
        const screen = () => root.shadowRoot.querySelector('selector-screen,editor-screen,live-screen');
        const settle = async () => { await root.updateComplete; await screen()?.updateComplete; for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame); };
        root.goto('selector', { invoker: 'profile-picker' });
        for (let i = 0; i < 100 && root.route !== 'selector'; i++) await new Promise(r => setTimeout(r, 20));
        for (let i = 0; i < 100 && boot.library.get().status !== 'ready'; i++) await new Promise(r => setTimeout(r, 20));
        await settle();
        window.__ux = { root, boot, screen, settle, loaded, selected, records, workflow, calls, control, kv };
        return { phase: boot.state.phase, route: root.route, loaded: loaded.id, selected: selected.id };
    });
}
