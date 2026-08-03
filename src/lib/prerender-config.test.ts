import { expect, describe, it } from 'vitest'
import { prerenderPages } from '../../vite.config'
import { getCaseStudies } from '#/lib/content'
import { getRouter } from '#/router'

// The prerender configuration is the reason this site has any SEO value at
// all, and every way it fails is quiet:
//
//   - a case study missing from `pages` ships as a client-rendered page that a
//     crawler sees empty,
//   - a path in the sitemap that nothing prerendered advertises a 404,
//   - a page whose only declared spelling is `sitemap: { exclude: true }`
//     disappears from the sitemap while still rendering perfectly in a browser.
//
// None of those break a build. So the config is exercised here as data, from
// the same module vite.config.ts hands to the plugin, rather than trusted.
//
// This file used to be roughly twice this length. Four of its cases were about
// `NOT_PRERENDERED`, the list of paths built and withheld, and that list is
// gone: it held '/contact' until the route landed and '/dev/primitives' until
// the harness was deleted before deploy, and with both removed it was an empty
// array behind a `prerender.filter` that could no longer reject anything. Four
// tests iterating an empty list is four tests that pass without asserting
// anything. They are deleted rather than left green.
//
// What replaces them is the failure that is live now rather than the one that
// expired. Nothing is withheld any more, but two spellings of /writing are
// declared and only one is advertised, so the way a page vanishes from the
// sitemap today is a canonical spelling quietly dropped from the list while
// its excluded alias stays.

describe('prerenderPages', () => {
  it('enumerates every case study slug from the content loader', () => {
    const expected = getCaseStudies().map((study) => `/work/${study.slug}`)

    // Not a hard-coded list. The loader is the source of truth for which case
    // studies exist, so a fourth .mdx file has to appear here for free or the
    // enumeration is decorative.
    expect(expected.length).toBeGreaterThan(0)
    for (const path of expected) {
      expect(
        prerenderPages.map((page) => page.path),
        `${path} is not in the prerender page list, so it would only be ` +
          `reachable if the crawler happened to find a link to it`,
      ).toContain(path)
    }
  })

  it('does not exclude any case study from the sitemap', () => {
    for (const study of getCaseStudies()) {
      const page = prerenderPages.find((p) => p.path === `/work/${study.slug}`)!

      expect(
        page.sitemap?.exclude,
        `/work/${study.slug} is excluded from the sitemap, which is the ` +
          `entire reason it is prerendered`,
      ).not.toBe(true)
    }
  })

  it('declares nothing the router cannot serve', () => {
    // A declared path with no route behind it is a 404 the prerenderer will
    // fetch and, with failOnError, a broken build. Worth catching here because
    // the build failure names a fetch rather than a stale line in a config.
    //
    // Compared modulo the trailing slash, because that difference is exactly
    // what this file is full of: the router spells the writing index
    // `/writing/` and serves both, and neither spelling is wrong to declare.
    const served = new Set(
      Object.values(getRouter().routesById)
        .map((route) => route.fullPath)
        .filter(Boolean)
        .map(withoutTrailingSlash),
    )

    for (const page of prerenderPages) {
      // Case study paths are behind /work/$slug, which is in `served` under
      // that literal spelling rather than per slug.
      if (page.path.startsWith('/work/')) continue

      expect(
        served.has(withoutTrailingSlash(page.path)),
        `${page.path} is declared for prerender and nothing in the router ` +
          `serves it. failOnError will stop the build on its 404`,
      ).toBe(true)
    }
  })
})

describe('the sitemap advertises every page, under exactly one spelling', () => {
  it('leaves no route advertised only under an excluded alias', () => {
    // The live hazard, and the one that replaced the harness cases.
    //
    // /writing is declared twice: `/writing`, advertised, and `/writing/`,
    // excluded, because the server answers 307 on the second. Delete the first
    // line and everything still works. The page renders, the alias resolves,
    // the build passes, `advertises nothing it did not prerender` in
    // prerender.spec.ts passes because the remaining entry is excluded rather
    // than dangling, and the page is simply gone from sitemap.xml.
    //
    // Measured: removing '/writing' from SITEMAP_CANONICAL_ONLY in
    // vite.config.ts passes every other assertion in this file.
    const declared = new Map<string, Array<{ excluded: boolean }>>()
    for (const page of prerenderPages) {
      const key = withoutTrailingSlash(page.path)
      declared.set(key, [
        ...(declared.get(key) ?? []),
        { excluded: page.sitemap?.exclude === true },
      ])
    }

    for (const [path, spellings] of declared) {
      expect(
        spellings.some((spelling) => !spelling.excluded),
        `every declared spelling of ${path} is excluded from the sitemap, so ` +
          `the page renders, resolves, and is advertised nowhere`,
      ).toBe(true)
    }
  })

  it('advertises the call to action', () => {
    // /contact was withheld from the prerender for as long as nothing served
    // it: the hero linked to a route that did not exist and failOnError would
    // have stopped the build on the 404. The route landed and the exclusion
    // went, and this is what stops it coming back by any route. The site's
    // only conversion being the one page a crawler cannot read is a failure
    // every browser-driven test on this site would pass.
    const routes = new Set(
      Object.values(getRouter().routesById).map((r) => r.fullPath),
    )

    expect(routes.has('/contact'), 'nothing serves /contact').toBe(true)
    expect(
      prerenderPages.find((page) => page.path === '/contact')?.sitemap?.exclude,
      '/contact is declared with sitemap.exclude, so the page a visitor is ' +
        'sent to convert on is advertised nowhere',
    ).not.toBe(true)
  })
})

describe('the router serves every case study slug', () => {
  it('resolves /work/$slug rather than a static route per study', () => {
    const routes = Object.values(getRouter().routesById).map((r) => r.fullPath)

    expect(
      routes,
      'there is no dynamic case study route, so the enumerated prerender ' +
        'paths have nothing to render',
    ).toContain('/work/$slug')
  })
})

/** '/' stays '/'; everything else loses a trailing slash. */
function withoutTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/$/, '') : path
}
