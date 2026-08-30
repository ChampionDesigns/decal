/**
 * <ui-toast> — the transient notice surface.
 *
 * It paces the notices slotted into it: adopting them, timing them, playing them in
 * and out, and capping how many show at once. It creates nothing except through
 * show(); a consumer may slot its own element and take it back at any time.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

export const DEFAULT_TOAST_DURATION = 2400;

export const DEFAULT_MAX_VISIBLE = 3;

export const TOAST_TONES = Object.freeze(['info', 'ok', 'warn', 'danger']);

const LAYER_ENTRY_EVENT = 'open-change';

const LAYER_ENTRY_REASON = 'layer-entry';

const INTERRUPTING_TONE = 'danger';

const STATE_ATTR = 'data-ui-toast';

const DISMISS_ATTR = 'data-ui-toast-dismiss';

/* A press on one of these is the control doing its job, not a dismissal. */
const NATIVE_INTERACTIVE =
    'a[href], button, input, select, textarea, summary, label, ' +
    '[tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [contenteditable]';

function readDuration(raw) {
    if (raw === null || raw === '') return DEFAULT_TOAST_DURATION;
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms < 0) return DEFAULT_TOAST_DURATION;
    return ms;
}

function applyAssertiveRole(notice) {
    if (notice.getAttribute('tone') === 'danger' && !notice.hasAttribute('role')) {
        notice.setAttribute('role', 'alert');
    }
}

/* A modal dialog and its backdrop live in the top layer, which no z-index can
   reach, so a notice that must appear over one has to take that layer too. */
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.showPopover === 'function';

function readMs(value) {
    const first = String(value || '0s').split(',')[0].trim();
    const ms = first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export class UiToast extends UiElement {
    static styles = [css`
        :host {
            position: fixed;
            z-index: var(--ui-z-toast);
            inset-inline: var(--_ui-toast-inset);
            inset-block-start: auto;
            inset-block-end: var(--_ui-toast-inset);
            pointer-events: none;

            --_ui-toast-inset: var(--ui-space-4);
            --_ui-toast-scale: .9;
        }

        :host([popover]) {
            margin: 0;
            border: 0;
            padding: 0;
            overflow: visible;
            inline-size: auto;
            block-size: auto;
            background-color: transparent;
            color: inherit;
        }

        :host([placement="top"]) {
            inset-block-start: var(--_ui-toast-inset);
            inset-block-end: auto;
        }

        :host([anchor="container"]) {
            position: absolute;
        }

        .stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--ui-space-2);
        }

        :host([placement="top"]) .stack {
            flex-direction: column-reverse;
        }

        ::slotted(*) {
            box-sizing: border-box;
            pointer-events: auto;
            max-inline-size: min(100%, var(--ui-measure));
            padding: var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius-xl);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-size: var(--ui-text-nav);
            box-shadow: var(--ui-elev-2);

            overflow-wrap: anywhere;

            transition:
                opacity var(--ui-dur-slow) var(--ui-ease),
                transform var(--ui-dur-slow) var(--ui-ease);
        }

        /* background-color, never the shorthand: the shorthand resets background-clip. */
        ::slotted([tone="ok"]) {
            color: var(--ui-status-ok);
            border-color: var(--ui-status-ok);
        }

        ::slotted([tone="warn"]) {
            color: var(--ui-tint-power);
            border-color: var(--ui-tint-power);
        }

        ::slotted([tone="danger"]) {
            color: var(--ui-status-danger);
            border-color: var(--ui-status-danger);
        }

        ::slotted([data-ui-toast="enter"]),
        ::slotted([data-ui-toast="exit"]) {
            opacity: 0;
            transform: scale(var(--_ui-toast-scale));
        }

        ::slotted([data-ui-toast="shown"]) {
            opacity: 1;
            transform: scale(1);
        }

        @media (prefers-reduced-motion: reduce) {
            ::slotted(*) {
                transition: none;
            }
        }
    `];

    /* notice -> { duration, remaining, startedAt, handle }, insertion-ordered. */
    #clocks = new Map();

    #leaving = new Set();

    #observer = new MutationObserver((records) => this.#onMutations(records));

    #ready = false;

    #paused = false;

    #watching = [];

    #onClick = (event) => this.#handlePress(event);

    #onFocusIn = () => this.#pause();

    #onFocusOut = (event) => {
        if (!event.relatedTarget || !this.contains(event.relatedTarget)) this.#resume();
    };

    connectedCallback() {
        super.connectedCallback();

        if (!this.hasAttribute('role')) {
            this.setAttribute('role', 'status');
            this.setAttribute('aria-live', 'polite');
            this.setAttribute('aria-atomic', 'false');
        }

        this.#observer.observe(this, { childList: true });
        this.addEventListener('click', this.#onClick);
        this.addEventListener('focusin', this.#onFocusIn);
        this.addEventListener('focusout', this.#onFocusOut);
        this.#syncLayer();

        this.#adoptExisting(true);
        this.#syncDangerWatch();
        requestAnimationFrame(() => { this.#ready = true; });
    }

    disconnectedCallback() {
        this.#observer.disconnect();
        this.#unwatchLayer();
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('focusin', this.#onFocusIn);
        this.removeEventListener('focusout', this.#onFocusOut);
        for (const clock of this.#clocks.values()) clearTimeout(clock.handle);

        for (const notice of this.#clocks.keys()) notice.removeAttribute(STATE_ATTR);
        this.#clocks.clear();
        this.#leaving.clear();
        this.#ready = false;
        this.#paused = false;
        super.disconnectedCallback();
    }

    firstUpdated() {
        this.#adoptExisting(true);
    }

    #syncLayer() {
        if (!SUPPORTS_POPOVER || !this.isConnected) return;

        if (this.getAttribute('anchor') === 'container') {
            if (this.hasAttribute('popover')) {
                if (this.matches(':popover-open')) this.hidePopover();
                this.removeAttribute('popover');
            }
            return;
        }

        if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
        try {
            if (this.matches(':popover-open')) this.hidePopover();
            this.showPopover();
        } catch {
        }

        if (!this.matches(':popover-open')) return;
        this.dispatchEvent(new CustomEvent('open-change', {
            bubbles: true,
            composed: true,
            detail: { open: true, reason: LAYER_ENTRY_REASON },
        }));
    }

    get #holdsDanger() {
        for (const notice of this.#clocks.keys()) {
            if (notice.getAttribute('tone') === INTERRUPTING_TONE) return true;
        }
        return false;
    }

    #syncDangerWatch() {
        const wanted = this.isConnected && SUPPORTS_POPOVER
            && this.getAttribute('anchor') !== 'container' && this.#holdsDanger;
        if (!wanted) {
            this.#unwatchLayer();
            return;
        }
        const roots = [document, this.getRootNode()].filter(
            (node, i, all) => node && typeof node.addEventListener === 'function' && all.indexOf(node) === i,
        );
        if (roots.length === this.#watching.length && roots.every((r, i) => r === this.#watching[i])) return;
        this.#unwatchLayer();
        for (const root of roots) root.addEventListener(LAYER_ENTRY_EVENT, this.#onForeignOpen, true);
        this.#watching = roots;
    }

    #unwatchLayer() {
        for (const root of this.#watching) root.removeEventListener(LAYER_ENTRY_EVENT, this.#onForeignOpen, true);
        this.#watching = [];
    }

    #onForeignOpen = (event) => {
        if (event.target === this) return;
        if (event.detail?.open !== true) return;
        if (event.detail?.reason === LAYER_ENTRY_REASON) return;
        if (!this.#holdsDanger) return;
        queueMicrotask(() => {
            if (!this.isConnected || !this.#holdsDanger) return;
            if (this.getAttribute('anchor') === 'container') return;
            this.#syncLayer();
        });
    };

    /* The notices being paced, oldest first. */
    get notices() {
        return [...this.#clocks.keys()];
    }

    get maxVisible() {
        if (!this.hasAttribute('max-visible')) return DEFAULT_MAX_VISIBLE;
        const n = Number(this.getAttribute('max-visible'));
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_MAX_VISIBLE;
    }

    /* show(message, duration, type) -> the notice element. */
    show(message, { tone = 'info', duration = null } = {}) {
        const notice = document.createElement('div');
        notice.textContent = String(message ?? '');
        notice.setAttribute('tone', TOAST_TONES.includes(tone) ? tone : 'info');
        if (duration !== null && duration !== undefined) notice.setAttribute('duration', String(duration));
        applyAssertiveRole(notice);
        this.appendChild(notice);
        this.#adopt(notice);
        return notice;
    }

    dismiss(notice) {
        if (!this.#clocks.has(notice)) return false;
        clearTimeout(this.#clocks.get(notice).handle);
        this.#clocks.delete(notice);
        this.#leaving.add(notice);
        notice.setAttribute(STATE_ATTR, 'exit');

        /* The duration is read, not listened for: a zero-second transition fires no
           transitionend, which would strand every notice. */
        const out = readMs(getComputedStyle(notice).transitionDuration);
        if (out === 0) this.#remove(notice);
        else setTimeout(() => this.#remove(notice), out);

        this.#syncDangerWatch();
        return true;
    }

    clear() {
        for (const notice of this.notices) this.dismiss(notice);
    }

    #adoptExisting(initial) {
        for (const child of [...this.children]) this.#adopt(child, initial);
    }

    /* Idempotent by the state attribute, so show() can adopt synchronously and the
       observer can adopt the same node again later. */
    #adopt(notice, initial = !this.#ready) {
        if (notice.nodeType !== Node.ELEMENT_NODE) return;
        if (this.#clocks.has(notice) || this.#leaving.has(notice)) return;
        if (notice.hasAttribute(STATE_ATTR)) return;

        applyAssertiveRole(notice);

        notice.setAttribute(STATE_ATTR, initial ? 'shown' : 'enter');
        this.#clocks.set(notice, { duration: 0, remaining: 0, startedAt: 0, handle: 0 });

        if (!initial) {
            /* Two frames: the first lets the engine take enter as the starting style, the
               second changes it. */
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (this.#clocks.has(notice)) notice.setAttribute(STATE_ATTR, 'shown');
            }));
        }

        this.#startClock(notice);
        this.#enforceCap();

        this.#syncLayer();

        this.#syncDangerWatch();
    }

    #startClock(notice) {
        const duration = readDuration(notice.getAttribute('duration'));
        const clock = this.#clocks.get(notice);
        if (!clock) return;
        clock.duration = duration;
        clock.remaining = duration;
        /* Zero is sticky. */
        if (duration <= 0) return;
        if (!this.#paused) this.#schedule(notice);
    }

    #schedule(notice) {
        const clock = this.#clocks.get(notice);
        if (!clock || clock.remaining <= 0) return;
        clock.startedAt = Date.now();
        clock.handle = setTimeout(() => this.dismiss(notice, 'timeout'), clock.remaining);
    }

    #pause() {
        if (this.#paused) return;
        this.#paused = true;
        const now = Date.now();
        for (const clock of this.#clocks.values()) {
            if (!clock.handle) continue;
            clearTimeout(clock.handle);
            clock.handle = 0;
            clock.remaining = Math.max(0, clock.remaining - (now - clock.startedAt));
        }
    }

    #resume() {
        if (!this.#paused) return;
        this.#paused = false;
        for (const [notice, clock] of this.#clocks) {
            if (clock.duration > 0 && !clock.handle) this.#schedule(notice);
        }
    }

    #enforceCap() {
        const cap = this.maxVisible;
        if (cap <= 0) return;
        const live = this.notices;
        for (let i = 0; i < live.length - cap; i++) this.dismiss(live[i]);
    }

    #remove(notice) {
        this.#leaving.delete(notice);
        notice.removeAttribute(STATE_ATTR);
        notice.remove();
    }

    #noticeOf(node) {
        for (let el = node; el && el !== this; el = el.parentElement) {
            if (el.parentElement === this) return this.#clocks.has(el) ? el : null;
        }
        return null;
    }

    /* Any custom element between the press and the notice counts as interactive. */
    #isInteractive(target, notice) {
        for (let el = target; el && el !== notice; el = el.parentElement) {
            if (el.tagName.includes('-')) return true;
            if (el.matches?.(NATIVE_INTERACTIVE)) return true;
        }
        return false;
    }

    #handlePress(event) {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const notice = this.#noticeOf(target);
        if (!notice) return;
        /* Scoped to the notice: closest() would walk out through this region and into
           whatever the screen wrapped around it. */
        const marker = target.closest(`[${DISMISS_ATTR}]`);
        if (marker && notice.contains(marker)) {
            this.dismiss(notice, 'action');
            return;
        }
        if (this.#isInteractive(target, notice)) return;
        this.dismiss(notice, 'tap');
    }

    #onMutations(records) {
        for (const record of records) {
            for (const node of record.removedNodes) {
                const clock = this.#clocks.get(node);
                if (clock) {
                    clearTimeout(clock.handle);
                    this.#clocks.delete(node);
                }
                this.#leaving.delete(node);
            }
            for (const node of record.addedNodes) this.#adopt(node);
        }
        this.#syncDangerWatch();
    }

    render() {
        return html`<div id="stack" class="stack"><slot></slot></div>`;
    }
}

customElements.define('ui-toast', UiToast);
