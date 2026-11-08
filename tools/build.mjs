/* Two-pass build.
   The site must open from file://, which rules out ES-module script tags, which
   means IIFE — and rollup refuses IIFE when a build emits more than one entry
   chunk. The marketing page and the app pages have different entry scripts, so
   they are built in separate passes into the same dist/. */
import { build } from 'vite';
import { rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

/* One pass per page. Nine pages sharing an entry script makes rollup
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
const PAGES = ['index', 'login', 'dashboard', 'courses', 'payment', 'course', 'english', 'resources', 'stories', 'story'];

rmSync(r('dist'), { recursive: true, force: true });

for (const [i, page] of PAGES.entries()) {
  await build(common({ [page]: r(`${page}.html`) }, page, i === 0));
}

/* ── the Moodle front page ───────────────────────────────────
   glow(test).mata9.com shows this landing page on its own home page: a
   script in Moodle's Additional HTML swaps the body for the landing markup
   and loads this page's CSS and JS from here. It used to load them by their
   hashed names, which every deploy renames and deletes, so each merge to
   main quietly left Moodle's home page unstyled for anyone without the old
   files cached (every new visitor, every incognito window).

   These two copies never change name. Moodle points at /embed/landing.css
   and /embed/landing.js once, and every deploy updates what is behind them.
   They are served no-cache (revalidate each load) with CORS open; see the
   /embed/* block in netlify.toml and setHeaders in server/app.js. */
const indexHtml = readFileSync(r('dist/index.html'), 'utf8');
const built = ext => {
  const m = indexHtml.match(new RegExp(`(?:href|src)="\\./(assets/[^"]+\\.${ext})"`));
  if (!m) throw new Error(`embed: no .${ext} bundle referenced by dist/index.html`);
  return readFileSync(r(`dist/${m[1]}`), 'utf8');
};
mkdirSync(r('dist/embed'), { recursive: true });
/* The CSS names its font relative to itself (./x.woff2 next to it in
   assets/); one directory over, that has to say ../assets/x.woff2. */
writeFileSync(r('dist/embed/landing.css'),
  built('css').replace(/url\((["']?)\.\/(?!\.)/g, 'url($1../assets/'));
writeFileSync(r('dist/embed/landing.js'), built('js'));

console.log(`\nbuilt ${PAGES.length} pages: ${PAGES.join(', ')}`);
console.log('embed: dist/embed/landing.css, dist/embed/landing.js (stable names for Moodle)');
