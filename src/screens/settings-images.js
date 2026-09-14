/**
 * The screensaver picture controller, one per settings store.
 *
 * Binds `screensaver-images.js` to the settings store for reading and writing and to
 * `screensaver-image-io.js` for inspecting a file and verifying a URL.
 */
import { createScreensaverImages } from '../lib/screensaver-images.js';
import { inspectScreensaverFile, verifyScreensaverImage } from '../components/screensaver-image-io.js';

const controllers = new WeakMap();

/** The controller for this store, made once and reused. Null without a store and a view. */
export function settingsImagesFor(settings, view) {
    if (!settings || !view) return null;
    if (controllers.has(settings)) return controllers.get(settings);
    const controller = createScreensaverImages({
        read: () => settings.value('screensaverImages'),
        write: (urls) => settings.set('screensaverImages', urls),
        inspect: (file, options) => inspectScreensaverFile(view, file, options),
        verify: (url, options) => verifyScreensaverImage(view, url, options),
    });
    controllers.set(settings, controller);
    settings.subscribe('screensaverImages', () => { void controller.refresh(); });
    void controller.refresh();
    return controller;
}
