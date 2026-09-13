import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, BENCH } from '../harness/index.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

async function mount() {
    const page = await browser.newPage({ geometry: BENCH });
    await page.mount('<div style="position:relative;width:600px;height:360px"><ui-screensaver id="saver" anchor="container" brightness-supported></ui-screensaver></div>', ['/src/components/ui-screensaver.js']);
    await page.eval(`window.__makeSettings = initial => {
        const values={screensaverEnabled:true,screensaverType:'image',screensaverImages:[],screensaverCycleMinutes:10,language:'en',clockFormat:'24h',...initial};
        const listeners=new Map();
        return {value:key=>values[key],load:async()=>{},subscribe(key,fn){if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);fn();return()=>listeners.get(key).delete(fn)},set(key,value){values[key]=value;for(const fn of listeners.get(key)||[])fn()}};
    };true`);
    return page;
}

async function until(page, expression) {
    assert.equal(await page.eval(`(async()=>{const end=performance.now()+5000;while(performance.now()<end){if(${expression})return true;await new Promise(resolve=>setTimeout(resolve,20));}return false;})()`), true, expression);
}

test('decoded slides skip unreadable URLs; render failures advance, preserve wake behaviour and never select Black mode', async () => {
    const page = await mount();
    try {
        await page.recordEvents('#saver', ['ui-screensaver-dim', 'ui-screensaver-wake']);
        await page.eval(`(async()=>{
            const {attachScreensaver,SCREENSAVER_DEFAULT_IMAGE}=await import('/src/components/ui-screensaver.js');
            const make=colour=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const ctx=canvas.getContext('2d');ctx.fillStyle=colour;ctx.fillRect(0,0,4,4);return canvas.toDataURL()};
            window.__one=make('red');window.__two=make('blue');window.__fallback=SCREENSAVER_DEFAULT_IMAGE;
            window.__settings=window.__makeSettings({screensaverImages:['data:image/png;base64,BROKEN',__one,__two]});
            const host=document.querySelector('#saver');window.__detach=attachScreensaver(host,{settings:__settings});host.machineState='sleeping';
            return true;
        })()`);
        await until(page, `document.querySelector('#saver').image===window.__one && document.querySelector('#saver').shadowRoot.querySelector('img')?.naturalWidth>0`);
        await page.eval(`window.__oldImage=document.querySelector('#saver').shadowRoot.querySelector('img');__oldImage.dispatchEvent(new Event('error'));true`);
        await until(page, `document.querySelector('#saver').image===window.__two && document.querySelector('#saver').shadowRoot.querySelector('img')?.naturalWidth>0`);
        await page.eval(`__oldImage.dispatchEvent(new Event('error'));true`);
        await page.settle();
        assert.equal(await page.eval(`document.querySelector('#saver').image===window.__two`), true, 'an error from the previous node does not evict the next slide');
        await page.eval(`document.querySelector('#saver').shadowRoot.querySelector('img').dispatchEvent(new Event('error'));true`);
        await until(page, `document.querySelector('#saver').image===window.__fallback`);
        await page.eval(`document.querySelector('#saver').shadowRoot.querySelector('img').dispatchEvent(new Event('error'));true`);
        await until(page, `document.querySelector('#saver').image===''`);
        assert.equal(await page.eval(`document.querySelector('#saver').imageMode`), true);
        assert.equal((await page.recordedEvents()).filter(e => e.type === 'ui-screensaver-dim').length, 0, 'failed image content cannot dim the panel');
        await page.click('#saver >>> #blank');
        assert.equal((await page.recordedEvents()).filter(e => e.type === 'ui-screensaver-wake').length, 1, 'the wake control still works when every image is unavailable');
        await page.eval('__detach();true');
    } finally { await page.close(); }
});

test('explicit Black selection still spends the pending dim after Image selection', async () => {
    const page = await mount();
    try {
        await page.recordEvents('#saver', ['ui-screensaver-dim']);
        await page.eval(`(async()=>{const {attachScreensaver}=await import('/src/components/ui-screensaver.js');const host=document.querySelector('#saver');window.__settings=__makeSettings({});window.__detach=attachScreensaver(host,{settings:__settings});host.machineState='sleeping';return true})()`);
        await page.settle();
        assert.equal((await page.recordedEvents()).length, 0);
        await page.eval(`__settings.set('screensaverType','black');true`);
        await page.settle();
        assert.equal(await page.eval(`document.querySelector('#saver').imageMode`), false);
        assert.equal((await page.recordedEvents()).filter(e => e.type === 'ui-screensaver-dim').length, 1);
        await page.eval('__detach();true');
    } finally { await page.close(); }
});

test('detach aborts pending validation, and late callbacks cannot paint into a replacement attachment', async () => {
    const page = await mount();
    try {
        await page.eval(`(async()=>{
            const {attachScreensaver,SCREENSAVER_DEFAULT_IMAGE}=await import('/src/components/ui-screensaver.js');
            window.__fallback=SCREENSAVER_DEFAULT_IMAGE;window.__pending=[];window.__NativeImage=window.Image;
            window.Image=class {set src(value){this.url=value;if(value){this.naturalWidth=10;this.naturalHeight=10;__pending.push({image:this,finish:this.onload})}}};
            const host=document.querySelector('#saver');window.__first=__makeSettings({screensaverImages:['late-image']});
            window.__detach=attachScreensaver(host,{settings:__first});return true;
        })()`);
        await until(page, `window.__pending.length===1`);
        await page.eval(`(async()=>{__detach();window.Image=__NativeImage;const {attachScreensaver}=await import('/src/components/ui-screensaver.js');window.__nextDetach=attachScreensaver(document.querySelector('#saver'),{settings:__makeSettings({})});for(const item of __pending)item.finish?.();__first.set('screensaverType','black');return true;})()`);
        await page.settle();
        assert.equal(await page.eval(`document.querySelector('#saver').image===window.__fallback`), true);
        assert.equal(await page.eval(`document.querySelector('#saver').imageMode`), true);
        await page.eval('__nextDetach();true');
        await page.settle();
        assert.equal(await page.eval(`document.querySelector('#saver').image`), '');
    } finally { await page.close(); }
});
