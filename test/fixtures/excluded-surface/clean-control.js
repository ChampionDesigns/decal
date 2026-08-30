// CONTROL. This file names every excluded symbol IN PROSE and must pass the scan.
//
// A comment-blind scanner produces a false positive here; a false positive earns an
// exemption; an exemption is how coverage dies. The same pairing guards the dead-name
// scan (test/rea-dead-names.test.mjs).
//
// Not built, and why — signalHeartbeat (imported, never called), previewLedStrip and
// clearLedStripPreview (POST /api/v1/machine/ledStrip/preview and .../preview/clear never
// existed), getValueFromStore and setValueInStore (the unencoded second KV path),
// resyncIfDrifted (ReaPrime's _setDe1DefaultsFor already does it),
// connectProfileGeneratedWebSocket (a socket nobody opens), reatsettingscache,
// currentShotSettings, updateShotSettingsCache, sendShotSettings, uploadMachineProfile,
// getDisplayState, isValidProfile, buildCalibrateBody, setCupWarmerPrewarm, and the
// orderBy query parameter no handler reads. Also /api/v1/machine/scale/calibrate, which
// is not a route.

export const NOTHING_IS_PORTED_HERE = true;
