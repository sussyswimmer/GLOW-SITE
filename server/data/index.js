/* Picks the adapter, once, at boot — and checks that whichever one was
   picked actually implements the whole surface. A missing export would
   otherwise surface as `data.getCatalog is not a function` on a live
   request, at whatever hour the learner happened to click the tab. */

import { config } from '../config.js';
import * as moodle from './moodle.js';
import * as mock from './mock.js';

const SURFACE = ['login', 'getLearner', 'getDashboard', 'getCourse', 'getCatalog', 'getSsoUrl', 'fetchMedia'];

const chosen = config.live ? moodle : mock;

const missing = SURFACE.filter(fn => typeof chosen[fn] !== 'function');
if (missing.length) {
  console.error(`\n  The "${config.DATA_SOURCE}" adapter is missing: ${missing.join(', ')}\n`);
  process.exit(1);
}

export const data = Object.fromEntries(SURFACE.map(fn => [fn, chosen[fn]]));

/* True when responses are illustrative rather than the foundation's own
   records. The UI shows a standing banner on the strength of this, so it
   is derived from configuration and never from a request. */
export const isDemo = !config.live;
