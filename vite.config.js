import { defineConfig } from 'vite';

import { contentPlugin } from './tools/content-plugin.mjs';

/* Production builds go through tools/build.mjs (configFile: false); this file is dev-server only. */
export default defineConfig({
  base: './',
  /* contentPlugin first: it fills the {{tokens}} and story markers from
     content/ (what the CMS edits) before anything else sees the HTML. */
  plugins: [contentPlugin()],
  /* In development the two halves run as two processes — Vite for hot
     reloading, the API on 8080 — but the browser must still see ONE
     origin, or the session cookie would be cross-site and dropped.
     Proxying /api through Vite keeps dev and production identical in the
     only respect that matters to auth. Run both with:
        npm run dev          (this)
        npm run dev:server   (the API) */
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT || 8080}`, changeOrigin: false },
    },
  },
});
