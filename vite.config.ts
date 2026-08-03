import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import { getCaseStudies } from './src/lib/content'

// Prerendering is the reason this site has any SEO value, and PRODUCT.md makes
// that load-bearing: the owner's recent work is private, so the site itself has
// to carry the proof, and a crawler that does not run JavaScript has to be able
// to read it.
//
// `failOnError` is set below because it is the correct setting and because it
// is the one it is tempting to drop the first time it stops a build. Without
// it, a route that throws during prerender is skipped and ships as a
// client-only page: the site still works in a browser, every browser-driven
// test still passes, and the page is empty to everything that matters.
//
// It does not currently work. Measured against @tanstack/start-plugin-core as
// installed: prerender.js throws inside a `queue.add()` callback whose returned
// promise nobody awaits, and queue.start() resolves through onSettled whether
// tasks errored or not. So a throwing route logs, is dropped from the output,
// stays in the sitemap, and the build exits 0. Verified by making
// /work/volt-tunisia throw: three pages emitted instead of four, sitemap still
// advertising the fourth, exit code 0.
//
// The flag stays, because it is the right declaration and it starts working the
// day that is fixed. The actual enforcement is tests/e2e/prerender.spec.ts,
// which reads the emitted HTML off disk and fails rather than skips when there
// is none. `bun run build && bun run test:e2e` is the gate, not the build alone.
// There is no hook available here to close the gap: every Vite plugin hook,
// buildEnd and closeBundle included, runs before nitro's post-build prerender.

/** Slugs come from the content loader, never from a list kept in step by hand. */
const caseStudyPages = getCaseStudies().map((study) => ({
  path: `/work/${study.slug}`,
}))

/**
 * Paths that must be neither prerendered nor advertised, and why each one is
 * here. Both entries are temporary in different ways, so the list is exported
 * and asserted in src/lib/prerender-config.test.ts rather than left to rot.
 */
export const NOT_PRERENDERED = [
  // A scratch harness for tests/e2e/primitives.spec.ts. It is auto-discovered
  // by the router generator whether or not anything links to it, so keeping it
  // unpublished takes an explicit exclusion.
  '/dev/primitives',
  // '/contact' used to sit here, because the hero linked to a route that did
  // not exist and failOnError would have stopped the build on its 404. The
  // route landed, so the exclusion went: leaving it would have kept the site's
  // primary call to action out of the sitemap permanently, which is the quiet
  // failure the test named "holds no path that the router can actually serve"
  // exists to force. /contact is prerendered like every other static page. Its
  // form is a client-side RPC to a server function, so the HTML a crawler gets
  // is complete and the endpoint behind it is unaffected by being static.
]

/**
 * Everything the prerenderer should visit, plus the exclusions declared so the
 * sitemap can see them.
 *
 * The declarations are not redundant with the filter below, and this is the
 * least obvious line in this file. The prerenderer seeds its `seen` set from
 * this array before it starts crawling; a crawled path that was NOT seeded gets
 * pushed into the same array, which is what the sitemap is built from, and the
 * filter runs after that push. So `filter` alone keeps a path out of the output
 * and still lists it in sitemap.xml, pointing a crawler at a 404. Declaring the
 * path here, with `sitemap.exclude`, is what closes that half.
 */
/**
 * Addresses that serve a page which is already advertised under another
 * spelling. Prerendered, because they resolve and a visitor can arrive on one;
 * kept out of the sitemap, because two <loc> entries for one document is
 * duplicate content handed to a crawler.
 *
 * `/writing/` is here, and it used to be `/writing`, which is the whole story.
 *
 * The route file is writing/index.tsx, so the router's full path for it is
 * `/writing/` and auto-discovery seeds that spelling. Its generated `to` type,
 * however, is `/writing`, so `<Link to>` can only ever produce the other one.
 * The canonical and the sitemap both used to follow the full path, on the
 * reasonable-sounding rule that the router's own address is authoritative.
 *
 * It is not. Measured against the built server, `/writing/` answers
 * `307 -> /writing`, so the address three declarations agreed on was the one
 * address the site refuses to serve. The redirect target wins: canonical,
 * sitemap and every link are `/writing` now, and this list holds the spelling
 * that redirects rather than the spelling that resolves.
 *
 * Both are still prerendered. `/writing/` has to be, because auto-discovery
 * seeds it and a filtered-out page that the crawler can still reach is how a
 * 404 gets into a sitemap; and because somebody will type it.
 */
const SITEMAP_ALIASES = ['/writing/']

/**
 * Addresses that resolve and are advertised, and that nothing else would put
 * in the list.
 *
 * `/writing` is here because auto-discovery cannot find it: it seeds from the
 * router's full paths, which spell this one `/writing/`. Without this line the
 * canonical spelling would be excluded as an alias, the redirecting spelling
 * would be the only one advertised, and the sitemap would point every crawler
 * at a 307.
 */
const SITEMAP_CANONICAL_ONLY = ['/writing']

export const prerenderPages: Array<{
  path: string
  sitemap?: { exclude: boolean }
}> = [
  ...caseStudyPages,
  ...SITEMAP_CANONICAL_ONLY.map((path) => ({ path })),
  ...SITEMAP_ALIASES.map((path) => ({
    path,
    sitemap: { exclude: true },
  })),
  ...NOT_PRERENDERED.map((path) => ({
    path,
    sitemap: { exclude: true },
  })),
]

/** Prefix match, so a second harness page added later is covered for free. */
export const isPrerendered = (page: { path: string }) =>
  !NOT_PRERENDERED.includes(page.path) && !page.path.startsWith('/dev/')

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      // The deploy target, named here rather than left to auto-detection.
      //
      // Nitro detects `vercel` from the VERCEL environment variable when it
      // builds on Vercel, so omitting this would still deploy correctly. It is
      // pinned anyway because the alternative is that `bun run build` on a
      // laptop and `bun run build` on Vercel produce different output shapes,
      // and every assertion in tests/e2e that reads the built files off disk
      // would then be checking an artefact nobody deploys.
      //
      // What it changes, measured against the node-server preset:
      //
      //   .output/public/        ->  .vercel/output/static/
      //   .output/server/        ->  .vercel/output/functions/__server.func/
      //   (nothing)              ->  .vercel/output/config.json
      //
      // config.json is the part that matters. It routes `{ handle:
      // "filesystem" }` before the `/(.*) -> /__server` catch-all, so every
      // prerendered document, the sitemap and the fonts are served as files by
      // Vercel's CDN and only a genuine miss reaches the server function. On
      // node-server all of it went through the SSR handler, which is why
      // /sitemap.xml answered 404 while sitting on disk.
      preset: 'vercel',
      rollupConfig: { external: [/^@sentry\//] },
      // `compressPublicAssets` is deliberately absent, and its absence is a
      // decision rather than an oversight.
      //
      // It used to be on, and it was right while the target was node-server:
      // that preset serves the bytes on disk verbatim, so without twins the
      // home page cost 494 KiB on the wire instead of 242.9 and Lighthouse's
      // mobile performance score was 83 rather than 97.
      //
      // Vercel does not read them. Its CDN negotiates Content-Encoding itself
      // for every response it serves, static or function, and the Build Output
      // API has no notion of a `.gz` sibling: `foo.js.gz` is just a file named
      // `foo.js.gz`, reachable only by asking for it by name, which no browser
      // does. Measured on the vercel preset with the option still set: 28
      // extra files, 254 695 B, a quarter of the whole static output, that
      // nothing would ever request.
      //
      // So this is not "we dropped compression". It is "the compression moved
      // to the edge, and shipping a second copy of every asset to a CDN that
      // ignores it is not insurance, it is freight."
      // tests/e2e/performance.spec.ts asserts the twins are gone and gzips in
      // process to model what the edge sends.
    }),
    tailwindcss(),
    tanstackStart({
      pages: prerenderPages,
      prerender: {
        enabled: true,
        // The home page links to all three case studies, so crawling would find
        // them even without the enumeration above. Both are kept: the
        // enumeration is the guarantee, and crawling is what catches a page
        // that becomes reachable without anybody adding it here.
        crawlLinks: true,
        failOnError: true,
        filter: isPrerendered,
      },
      sitemap: { enabled: true, host: 'https://mehby.com' },
    }),
    // MDX turns `.mdx` into JSX, so it has to produce that JSX before the
    // React plugin looks for it. `enforce: 'pre'` guarantees the ordering,
    // and sitting directly above viteReact() in the array keeps the reason
    // visible. Run it after React instead and React is handed raw markdown.
    //
    // remark-frontmatter is not optional here. Without it the YAML block is
    // not frontmatter to MDX at all, it is a setext heading followed by
    // prose, and every case study page opens by printing its own metadata.
    // gray-matter reads that same block on the server; this stops the page
    // rendering it twice.
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkFrontmatter] }) },
    viteReact(),
  ],
})

export default config
