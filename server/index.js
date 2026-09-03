/* ═══════════════════════════════════════════════════════════
   GLOW — the server process.

   One process serves both halves: the built front end as static files
   and /api on the same origin. Everything it is, is in `app.js`; this
   file only starts it and stops it cleanly. The split exists so the
   same app can also be handed one request at a time by a serverless
   host, which has no process to listen on — see
   `netlify/functions/api.mjs`.
   ═══════════════════════════════════════════════════════════ */

import { buildApp } from './app.js';
import { config } from './config.js';
import { isDemo } from './data/index.js';

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    `GLOW server up — data source: ${config.DATA_SOURCE}${isDemo ? ' (DEMO DATA — not the foundation\'s records)' : ''}`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    app.log.info(`${signal} — shutting down`);
    await app.close();
    process.exit(0);
  });
}
