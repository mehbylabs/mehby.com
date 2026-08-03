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
 * `/writing` is here because the router's generated `to` type for that route
 * is `/writing` while its full path, its canonical link and the address the
 * sitemap advertises are all `/writing/`. So `<Link to="/writing">` is the
 * only spelling the typed API will accept and it is not the canonical one.
 * The disagreement was latent for as long as nothing linked to the page; the
 * site footer is the first thing that does, and the crawler immediately
 * discovered the second address and listed both.
 *
 * The canonical stays `/writing/`, which is what src/routes/writing/index.tsx
 * already argues for at length. This is the other half: the alias resolves,
 * self-canonicalises in its own HTML, and is not advertised.
 */
const SITEMAP_ALIASES = ['/writing']

export const prerenderPages: Array<{
  path: string
  sitemap?: { exclude: boolean }
}> = [
  ...caseStudyPages,
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
      rollupConfig: { external: [/^@sentry\//] },
      // Precompressed twins for every public asset, served by content
      // negotiation when the client sends Accept-Encoding.
      //
      // Measured, not assumed. Without this the node-server preset serves the
      // bytes on disk verbatim, and Lighthouse's network records showed
      // transfer size equal to resource size for every text asset: the home
      // page cost 494 KiB on the wire, of which 328 KiB was JavaScript and
      // 22.9 KiB was CSS that gzip takes to 79.7 KiB and 5.1 KiB. At the slow
      // 4G profile Lighthouse throttles mobile to, that difference is most of
      // a second of the critical path.
      //
      // Fonts are already woff2, which is Brotli-compressed internally, so
      // they are unaffected and remain the largest thing on the wire.
      //
      // This is a property of what is built, not of where it is deployed. A
      // CDN in front of the origin would compress on the fly, but the site
      // must not be fast only when something else is doing the work, and the
      // deploy target is not decided here.
      compressPublicAssets: { gzip: true, brotli: true },
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
