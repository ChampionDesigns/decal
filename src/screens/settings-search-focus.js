export function highlightSettingsTarget(screen, result) {
    let stopped = false;
    let marked = null;
    let previousTabIndex = null;
    const observer = new MutationObserver(() => mark());
    const mark = () => {
        if (stopped) return;
        const host = screen.shadowRoot?.getElementById(result.primitive ? 'leaf' : 'bespoke');
        const target = result.primitive
            ? [...(host?.shadowRoot?.querySelectorAll('[data-row]') ?? [])].find((row) => row.dataset.row === result.target)
            : host?.shadowRoot?.getElementById(result.target);
        if (!target || target === marked) return;
        marked?.part.remove('search-match');
        marked = target;
        target.part.add('search-match');
        previousTabIndex = target.getAttribute('tabindex');
        target.tabIndex = -1;
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        target.focus({ preventScroll: true });
        observer.disconnect();
    };
    screen.updateComplete.then(async () => {
        if (stopped) return;
        const hosts = ['leaf', 'bespoke'].map((id) => screen.shadowRoot?.getElementById(id)).filter(Boolean);
        await Promise.all(hosts.map((host) => host.updateComplete));
        if (stopped) return;
        for (const host of hosts) if (host.shadowRoot) observer.observe(host.shadowRoot, { childList: true, subtree: true });
        mark();
    });
    return () => {
        stopped = true;
        observer.disconnect();
        if (!marked) return;
        marked.part.remove('search-match');
        if (previousTabIndex === null) marked.removeAttribute('tabindex');
        else marked.setAttribute('tabindex', previousTabIndex);
    };
}
