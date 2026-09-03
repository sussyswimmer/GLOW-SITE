/* ═══════════════════════════════════════════════════════════
   /api, on a host with no process to listen on.

   This is a thin adapter, not a second server. It builds the SAME
   Fastify app as `npm start` and hands it one request at a time —
   `server/app.js` owns the routes, the session sealing, the CSRF
   origin check and the error shape, so there is nothing here that
   can drift out of step with the box the foundation may move to
   later.

   The only difference is `serveStatic: false`: on this host the CDN
   is already serving `dist/`, and the function is never asked for a
   file. Everything else — including the fact that sessions are
   stateless encrypted cookies with no store behind them — is what
   makes the app survive being run this way at all. A server that
   kept sessions in memory could not be.
   ═══════════════════════════════════════════════════════════ */

import { buildApp } from '../../server/app.js';

/* Built once per warm instance, not once per request. `??=` so concurrent
   first requests share one build rather than racing to make three. */
let building;
const getApp = () => (building ??= buildApp({ serveStatic: false }).then(async app => {
  await app.ready();
  return app;
}));

/* Hop-by-hop and length headers belong to the connection, not the message.
   Forwarding a stale content-length alongside a re-encoded body is the
   classic way to make a request hang or truncate. */
const DROP_IN = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length']);
const DROP_OUT = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length']);

export default async request => {
  const app = await getApp();
  const url = new URL(request.url);

  const headers = {};
  for (const [k, v] of request.headers) {
    if (!DROP_IN.has(k.toLowerCase())) headers[k] = v;
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const payload = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  const res = await app.inject({
    method: request.method,
    url: url.pathname + url.search,
    headers,
    payload,
  });

  /* Set-Cookie is the reason this loop appends rather than sets: a sign-in
     and a sign-out both write more than one, and collapsing them into a
     single comma-joined header silently loses all but the first. */
  const out = new Headers();
  for (const [k, v] of Object.entries(res.headers)) {
    if (v === undefined || DROP_OUT.has(k.toLowerCase())) continue;
    if (Array.isArray(v)) for (const one of v) out.append(k, String(one));
    else out.set(k, String(v));
  }

  return new Response(res.rawPayload, { status: res.statusCode, headers: out });
};

export const config = { path: '/api/*' };
