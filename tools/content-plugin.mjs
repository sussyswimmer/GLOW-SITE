/* ═══════════════════════════════════════════════════════════
   The Vite side of the content layer.

   One plugin, used by BOTH vite.config.js (dev) and tools/build.mjs
   (build), so a page can never look different on :5173 than it will in
   dist/. It does three replacements in HTML on its way out:

   - {{token.path}}      → content/landing.json values   (index.html)
   - <!--@stories-->     → the static story listing      (stories.html)
   - <!--@stories-json--> → the stories as inline JSON   (story.html)

   In dev, editing anything under content/ full-reloads the page, so the
   authoring loop is: edit → save → see it, same as editing the HTML.
   ═══════════════════════════════════════════════════════════ */

import { resolve } from 'node:path';
import { loadLanding, loadStories, injectTokens, storiesListMarkup, storiesJson } from './content.mjs';

export function contentPlugin() {
  /* Loaded per-transform rather than cached: the files are a few KB, and a
     cache here is exactly the kind that serves yesterday's copy in dev. */
  function inject(html) {
    if (html.includes('{{')) html = injectTokens(html, loadLanding());
    if (html.includes('<!--@stories-->') || html.includes('<!--@stories-json-->')) {
      const stories = loadStories();
      html = html
        .replace('<!--@stories-->', () => storiesListMarkup(stories))
        .replace('<!--@stories-json-->', () => storiesJson(stories));
    }
    return html;
  }

  return {
    name: 'glow-content',
    /* 'pre', so the tokens are gone before any other HTML transform —
       including the file-protocol plugin — ever sees the page. */
    transformIndexHtml: { order: 'pre', handler: inject },
    configureServer(server) {
      const contentDir = resolve(process.cwd(), 'content');
      server.watcher.add(contentDir);
      const reload = file => {
        if (file.startsWith(contentDir)) server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}
