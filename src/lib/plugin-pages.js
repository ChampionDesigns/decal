/**
 * The plugin pages this skin links to, named once.
 */

export const DYE2_PLUGIN = Object.freeze({
    id: 'dye2.reaplugin',
    page: 'bean-picker',
});

/** DYE2's plugin id, for matching a manifest in the listing. */
export const DYE2_PLUGIN_ID = DYE2_PLUGIN.id;

/** The one DYE2 endpoint this skin opens as a page. See `DYE2_PLUGIN` for why this one. */
export const DYE2_PAGE_ENDPOINT = DYE2_PLUGIN.page;
