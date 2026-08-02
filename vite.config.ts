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
  // Linked from the hero and not built yet. With failOnError the 404 would stop
  // the build, and without failOnError the whole prerender guarantee goes with
  // it. Remove this line when the route lands; the test named "holds no path
  // that the router can actually serve" fails until somebody does.
  '/contact',
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
export const prerenderPages: Array<{
  path: string
  sitemap?: { exclude: boolean }
}> = [
  ...caseStudyPages,
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
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
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
