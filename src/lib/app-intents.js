/**
 * What a screen's INTENT means to the shell.
 */

export const HEADER_ACTION_ROUTES = Object.freeze({
    'Edit profile': 'editor',
    Settings: 'settings',
});

export const HEADER_ACTION_MACHINE = Object.freeze({
    Sleep: 'sleep',
});

/** The one header action that has to seat a record before it routes. */
export const EDIT_ACTION = 'Edit profile';

/** The events the shell listens for. One place, so the add/remove pair cannot drift. */
export const INTENT_EVENTS = Object.freeze(['header-action', 'library-open', 'favourite-select']);

export function intentFor(type, detail = null) {
    switch (type) {
        case 'header-action': {

            if (detail?.action === EDIT_ACTION) {
                return {
                    kind: 'edit',
                    route: 'editor',
                    profileId: typeof detail.profileId === 'string' && detail.profileId
                        ? detail.profileId : null,
                };
            }
            /* A MACHINE ACTION IS ANSWERED BEFORE A ROUTE, because the two tables are
             * disjoint and a name in both would be a bug the reader could not see. */
            const command = HEADER_ACTION_MACHINE[detail?.action];
            if (command) return { kind: 'machine', command };
            const route = HEADER_ACTION_ROUTES[detail?.action];
            return route ? { kind: 'route', route } : null;
        }
        case 'library-open':
            return { kind: 'route', route: 'selector' };
        case 'favourite-select': {
            const profileId = detail?.value;
            return profileId ? { kind: 'arm', profileId: String(profileId) } : null;
        }
        default:
            return null;
    }
}
