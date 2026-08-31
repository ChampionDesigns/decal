/**
 * `describe` for the suites that read ReaPrime Dart source. It skips the whole suite when
 * REA_ROOT names no checkout, so a clone without one reports skipped rather than failed.
 */
import { describe as nodeDescribe } from 'node:test';

import { REA_SOURCE_PRESENT } from '../../scripts/lib/rea-source.js';

export const describe = REA_SOURCE_PRESENT ? nodeDescribe : nodeDescribe.skip;
