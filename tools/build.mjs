/* Two-pass build.
   The site must open from file://, which rules out ES-module script tags, which
   means IIFE — and rollup refuses IIFE when a build emits more than one entry
   chunk. The marketing page and the app pages have different entry scripts, so
   they are built in separate passes into the same dist/. */
import { build } from 'vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentPlugin } from './content-plugin.mjs';

const root = process.cwd();
const r = p => resolve(root, p);

function fileProtocolFriendly() {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/\s+type="module"/g, ' defer')
        .replace(/\s+crossorigin/g, '')
        .replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
    },
  };
}

/* inlineDynamicImports is only legal with a single input. The app pass has five
   HTML inputs but they all share one entry script, so it emits one JS chunk
   either way and IIFE stays valid. */
const common = (input, name, emptyOutDir) => ({
  root,
  base: './',
  configFile: false,
  /* contentPlugin first: the CMS-edited words and stories go into the HTML
     before the file-protocol rewrite (or anything else) sees it. */
  plugins: [contentPlugin(), fileProtocolFriendly()],
  build: {
    outDir: 'dist',
    emptyOutDir,
    target: 'es2018',
    assetsInlineLimit: 0,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input,
      output: {
        format: 'iife',
        inlineDynamicImports: Object.keys(input).length === 1,
        entryFileNames: `assets/${name}.[hash].js`,
        chunkFileNames: `assets/${name}.[hash].js`,
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});

/* One pass per page. Five pages sharing an entry script makes rollup
   code-split, and IIFE forbids that — so each page is built on its own and
   ships a self-contained bundle. Costs a little duplication; buys a dist that
   opens from disk with no server. */
/* NOTE ON file://
   `index.html` still opens straight off disk — it is a self-contained
   marketing page and that was a requirement of the original brief.

   The signed-in pages no longer can, and this is a consequence of them
   becoming real rather than a regression: they fetch /api, and fetch is
   blocked on file://. There is also nothing to fetch, since the whole
   point is that a server holds the session. They are served by
   `npm start` like any other application. */
const PAGES = ['index', 'login', 'dashboard', 'courses', 'course', 'english', 'resources', 'stories', 'story'];

rmSync(r('dist'), { recursive: true, force: true });

for (const [i, page] of PAGES.entries()) {
  await build(common({ [page]: r(`${page}.html`) }, page, i === 0));
}

console.log(`\nbuilt ${PAGES.length} pages: ${PAGES.join(', ')}`);
