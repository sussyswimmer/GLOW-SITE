import { defineConfig } from 'vite';

/* The brief asks for a build that opens from file:// as well as from a host.
   That rules out ES-module script tags (blocked by CORS on file://), so the
   bundle is emitted as a single IIFE and the module attributes are stripped
   from the built HTML. */
function fileProtocolFriendly() {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',          // dev serves real ES modules — only rewrite the built HTML
    enforce: 'post',
    transformIndexHtml(html) {
      /* `defer`, not nothing: module scripts are deferred by default, so simply
         dropping the attribute would turn this into a blocking classic script
         in <head> that executes before <body> exists. */
      return html
        .replace(/\s+type="module"/g, ' defer')
        .replace(/\s+crossorigin/g, '')
        .replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
    },
  };
}

import { resolve } from 'node:path';
import { contentPlugin } from './tools/content-plugin.mjs';

export default defineConfig({
  base: './',
  /* contentPlugin first: it fills the {{tokens}} and story markers from
     content/ (what the CMS edits) before anything else sees the HTML. */
  plugins: [contentPlugin(), fileProtocolFriendly()],
  build: {
    target: 'es2018',
    assetsInlineLimit: 0,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index:     resolve(process.cwd(), 'index.html'),
        login:     resolve(process.cwd(), 'login.html'),
        dashboard: resolve(process.cwd(), 'dashboard.html'),
        courses:   resolve(process.cwd(), 'courses.html'),
        course:    resolve(process.cwd(), 'course.html'),
        english:   resolve(process.cwd(), 'english.html'),
        resources: resolve(process.cwd(), 'resources.html'),
        stories:   resolve(process.cwd(), 'stories.html'),
        story:     resolve(process.cwd(), 'story.html'),
      },
      output: {
        /* One IIFE per page: multi-page + no ES modules (file:// blocks them)
           means each entry has to be self-contained rather than share chunks. */
        format: 'iife',
        inlineDynamicImports: false,
        manualChunks: undefined,
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
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
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
});
