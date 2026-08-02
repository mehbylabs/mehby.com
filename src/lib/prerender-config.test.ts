import { expect, describe, it } from 'vitest'
import {
  NOT_PRERENDERED,
  isPrerendered,
  prerenderPages,
} from '../../vite.config'
import { getCaseStudies } from '#/lib/content'
import { getRouter } from '#/router'

// The prerender configuration is the reason this site has any SEO value at
// all, and every way it fails is quiet:
//
//   - a case study missing from `pages` ships as a client-rendered page that a
//     crawler sees empty,
//   - a path in the sitemap that nothing prerendered advertises a 404,
//   - `/dev/primitives` reaching either list publishes a scratch harness.
//
// None of those break a build. So the config is exercised here as data, from
// the same module vite.config.ts hands to the plugin, rather than trusted.

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

  it('declares every excluded path so the crawler cannot re-add it', () => {
    // Load-bearing, and the least obvious line in vite.config.ts. The
    // prerenderer seeds its `seen` set from startConfig.pages before it starts
    // crawling, and a crawled path that is NOT already seeded gets pushed into
    // startConfig.pages, which is the array the sitemap is built from. The
    // prerender filter runs after that push. So filtering alone keeps a path
    // out of the output and still advertises it in sitemap.xml.
    for (const path of NOT_PRERENDERED) {
      const declared = prerenderPages.find((page) => page.path === path)

      expect(
        declared,
        `${path} is filtered out of the prerender but not declared in ` +
          `\`pages\`, so the crawler will push its own copy into the sitemap`,
      ).toBeDefined()
      expect(
        declared?.sitemap?.exclude,
        `${path} is declared but not excluded from the sitemap`,
      ).toBe(true)
    }
  })

  it('keeps the primitives harness out of the sitemap, by name', () => {
    // Named rather than derived from NOT_PRERENDERED, because the test above
    // iterates that list and therefore proves nothing about a path that has
    // been deleted from it. Measured: removing '/dev/primitives' from the list
    // passed every other assertion in this file and shipped a sitemap entry
    // for the scratch harness.
    const declared = prerenderPages.find((p) => p.path === '/dev/primitives')

    expect(
      declared?.sitemap?.exclude,
      'the primitives harness is not declared with sitemap.exclude, so the ' +
        'sitemap advertises a page that is never prerendered',
    ).toBe(true)
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
})

describe('isPrerendered', () => {
  it('accepts the home page and every case study', () => {
    expect(isPrerendered({ path: '/' })).toBe(true)
    for (const study of getCaseStudies()) {
      expect(isPrerendered({ path: `/work/${study.slug}` })).toBe(true)
    }
  })

  it('rejects the primitives harness', () => {
    // Auto-discovery finds it: it is a static path with a component, so it is
    // in TSS_PRERENDABLE_PATHS whether or not anything links to it.
    expect(
      isPrerendered({ path: '/dev/primitives' }),
      'the scratch harness would be published',
    ).toBe(false)
  })

  it('rejects anything under /dev, not just the page that exists today', () => {
    // A second harness page added later must not have to remember to update
    // this list.
    expect(isPrerendered({ path: '/dev/anything-else' })).toBe(false)
  })
})

describe('the excluded list stays honest', () => {
  it('holds no path that the router can actually serve', () => {
    // The list exists for two different reasons, and one of them expires:
    // /dev/primitives is excluded because it is private, and /contact is
    // excluded because it does not exist yet and `failOnError` would stop the
    // build on its 404. When /contact ships, leaving it here would silently
    // keep the site's primary call to action out of the sitemap. This fails
    // the moment that route lands, which is the moment somebody can act on it.
    const routes = new Set(
      Object.values(getRouter().routesById).map((r) => r.fullPath),
    )

    for (const path of NOT_PRERENDERED) {
      if (path.startsWith('/dev/')) continue

      expect(
        routes.has(path),
        `${path} is excluded from prerender and sitemap because it had no ` +
          `route. It has one now, so remove it from NOT_PRERENDERED in ` +
          `vite.config.ts`,
      ).toBe(false)
    }
  })

  it('excludes the call to action the hero links to but nothing serves', () => {
    // Pins the reason the mechanism exists. Without this, deleting /contact
    // from the list passes every other test here and fails only at build time.
    expect(NOT_PRERENDERED).toContain('/contact')
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
