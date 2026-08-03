import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { BUILD_DIR, clientDir, htmlFor } from './support/built'
import { getCaseStudies } from '#/lib/content'

// Prerendering, asserted against the files on disk.
//
// Every other test in this suite drives a browser, which is exactly why none of
// them can prove this. A client-rendered page and a prerendered one are
// indistinguishable once JavaScript has run: the DOM is identical, the
// screenshot is identical, and every assertion in home.spec.ts passes either
// way. The difference is what a crawler that does not execute JavaScript
// receives, and the only place that is visible is the HTML file itself.
//
// This is the failure `failOnError` exists to stop: a route that throws during
// prerender is otherwise dropped silently and ships as client-only, losing the
// SEO value that is the entire reason this site is prerendered. So the check
// reads bytes.
//
// Requires a build. `bun run build` writes the adapter's output directory;
// this file deliberately fails rather than skips when it is absent, because a
// test that quietly proves nothing is worse than no test. See support/built.ts
// for where that directory is and why it is found rather than named.

/** The one origin this site publishes itself under. */
const SITE = 'https://mehby.com'

/** Every path the build prerenders and advertises. */
const PAGES = [
  { path: '/' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/writing' },
  { path: '/work/coachess' },
  { path: '/work/helmdeck' },
  { path: '/work/volt-tunisia' },
] as const

test.describe('the home page is on disk, rendered', () => {
  test('carries the hero copy in the HTML, not only after hydration', async () => {
    const html = htmlFor('/')

    // The display line and the name. Both are rendered by React, so their
    // presence in a static file is the proof that React ran at build time.
    expect(
      html,
      'the prerendered home page does not contain the hero display line, so ' +
        'it was shipped as a client-rendered shell',
    ).toContain('I build and ship full stack products, end to end.')
    expect(html).toContain('Mohamed Elhedi Ben Yedder')
    expect(html).toContain('CTO and co-founder of CoaChess')
  })

  test('carries the proof links as real anchors', async () => {
    const html = htmlFor('/')

    for (const href of [
      'https://coachess.net',
      'https://app.coachess.net',
      'https://live.coachess.net',
    ]) {
      expect(html, `${href} is not in the prerendered HTML`).toContain(href)
    }
  })
})

test.describe('every address the site publishes is one the gate checks', () => {
  // scripts/verify-links.mjs stops the build when a URL in case study
  // frontmatter does not resolve. PRODUCT.md is why that is allowed to break a
  // build: the owner's recent source is private and no metrics may be
  // published, so a short strip of live addresses carries the whole burden of
  // credibility, and a dead one is the site making a false claim about a
  // product being live to the audience it is trying to convince.
  //
  // The gate reads the frontmatter. This reads what the pages actually
  // painted. That gap is where the failure lives, and it is not hypothetical:
  // ProofStrip.tsx used to carry its own hardcoded copy of the three CoaChess
  // URLs, so a fourth address added there, or a third removed from the
  // frontmatter, would have been published without the gate ever seeing it.
  //
  // Deliberately every external href on every prerendered page rather than
  // just the proof strip. The rule is about the site, not about one component,
  // so a hardcoded URL dropped into a case study narrative or a footer is
  // covered without anybody extending this.
  test('no built page links off-origin to an address the gate never sees', () => {
    const studies = getCaseStudies()
    const verified = new Set([
      ...studies.flatMap((study) => study.surfaces.map((s) => s.href)),
      ...studies.flatMap((study) => (study.source ? [study.source] : [])),
    ])

    expect(
      verified.size,
      'the gate has nothing to verify, so this proves nothing',
    ).toBeGreaterThan(0)

    // Addresses that are not claims about a live product, and are therefore
    // not the gate's business. mailto is not an HTTP resource; the canonical
    // and og:url point at this site's own pages, which prerender.spec.ts
    // already proves exist.
    const OWN_ORIGIN = SITE

    const unverified = new Map<string, Array<string>>()
    for (const { path } of PAGES) {
      const html = htmlFor(path)
      for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
        const href = match[1]
        if (href === OWN_ORIGIN || href.startsWith(`${OWN_ORIGIN}/`)) continue
        if (verified.has(href)) continue
        unverified.set(href, [...(unverified.get(href) ?? []), path])
      }
    }

    expect(
      [...unverified].map(([href, pages]) => `${href} on ${pages.join(', ')}`),
      'these off-origin addresses are published by the built site and are in ' +
        'no case study frontmatter, so scripts/verify-links.mjs never checks ' +
        'them and the build cannot tell when one dies',
    ).toEqual([])
  })
})

test.describe('every case study is on disk, rendered', () => {
  const STUDIES = [
    { slug: 'coachess', title: 'CoaChess', body: 'Three surfaces, three jobs' },
    {
      slug: 'helmdeck',
      title: 'Helmdeck',
      body: 'Why a protocol rather than adapters',
    },
    {
      slug: 'volt-tunisia',
      title: 'VoltTunisia',
      body: 'The domain is the hard part',
    },
  ]

  for (const study of STUDIES) {
    test(`/work/${study.slug} is prerendered with its narrative`, async () => {
      const html = htmlFor(`/work/${study.slug}`)

      expect(html).toContain(study.title)
      // The frontmatter reaching the file proves the server function ran; the
      // body reaching it proves the MDX glob resolved. They fail separately.
      expect(
        html,
        'the frontmatter rendered but the MDX body did not',
      ).toContain(study.body)
      expect(html, 'the specification table did not render').toContain(
        `Specification: ${study.title}`,
      )
    })
  }
})

test.describe('the scratch harness is not published', () => {
  test('emits no HTML for /dev', async () => {
    const base = clientDir()

    expect(
      existsSync(join(base, 'dev')),
      'the primitives harness was prerendered. It is a test fixture, not a ' +
        'page, and prerendering it publishes it',
    ).toBe(false)
  })
})

test.describe('the routing table Vercel is handed', () => {
  // config.json is the whole reason /sitemap.xml stopped being a 404, so it is
  // asserted rather than assumed.
  //
  // On node-server the sitemap sat on disk and answered 404 over HTTP, because
  // nitro bakes its public-asset manifest before the TanStack Start plugin
  // writes the file, so nothing in the manifest knew it existed and every
  // request fell through to the SSR handler. The vercel preset does not fix
  // that manifest. It routes around it: `{ handle: "filesystem" }` runs before
  // the catch-all, so Vercel serves whatever is in the static directory
  // whether or not nitro's manifest ever heard of it.
  //
  // That means the fix is one line in a generated file, and the line is
  // ordering-sensitive. If the catch-all were ever emitted above the
  // filesystem handle, every static file on this site would go back to being
  // rendered by the app, and the only symptom would be a sitemap and a
  // robots.txt that 404 in production while passing every test that reads
  // disk.
  const config = () =>
    JSON.parse(readFileSync(join(BUILD_DIR, 'config.json'), 'utf8')) as {
      routes: Array<{ handle?: string; src?: string; dest?: string }>
    }

  test('serves files before it falls through to the server function', () => {
    const routes = config().routes

    const filesystem = routes.findIndex(
      (route) => route.handle === 'filesystem',
    )
    const catchAll = routes.findIndex(
      (route) => route.src === '/(.*)' && route.dest === '/__server',
    )

    expect(
      filesystem,
      'config.json has no `{ handle: "filesystem" }` entry, so nothing serves ' +
        'the static output and every request is rendered by the app',
    ).toBeGreaterThanOrEqual(0)
    expect(
      catchAll,
      'config.json has no catch-all to the server function, so anything that ' +
        'is not a prerendered file 404s',
    ).toBeGreaterThanOrEqual(0)
    expect(
      filesystem,
      'the catch-all is matched before the filesystem handle, so sitemap.xml ' +
        'and robots.txt are handed to the SSR router, which has no route for ' +
        'either and answers 404. This is exactly the node-server failure the ' +
        'preset was changed to avoid',
    ).toBeLessThan(catchAll)
  })
})

test.describe('robots.txt', () => {
  // Absent entirely before this. Not a preset problem and not fixed by one: no
  // file existed to serve, so both presets were right to 404 it.
  const robots = () => {
    const file = join(clientDir(), 'robots.txt')
    expect(
      existsSync(file),
      'no robots.txt was emitted. public/robots.txt is copied into the static ' +
        'output by the build, so its absence means the file was deleted rather ' +
        'than that the copy failed',
    ).toBe(true)
    return readFileSync(file, 'utf8')
  }

  test('names a sitemap that was actually built, at the address it claims', () => {
    const line = robots().match(/^Sitemap:\s*(\S+)$/m)

    expect(
      line?.[1],
      'robots.txt declares no Sitemap. A crawler that has not already found ' +
        'sitemap.xml has no way to, which is most of what this file is for',
    ).toBeTruthy()

    const url = new URL(line![1])

    // The origin, checked against the one the pages themselves declare. Two
    // places write this host down and they can disagree silently: a robots.txt
    // pointing at the wrong origin is still a valid robots.txt.
    expect(
      url.origin,
      `robots.txt points at ${url.origin}, but every canonical on the site ` +
        `points at ${SITE}`,
    ).toBe(SITE)

    // And the file is really there. An absolute URL to a 404 is worse than no
    // Sitemap line, because a crawler stops looking once it has been given one.
    expect(
      existsSync(join(clientDir(), url.pathname)),
      `robots.txt advertises ${url.href} but nothing was emitted at ` +
        `${url.pathname}`,
    ).toBe(true)
  })

  test('closes nothing the site is prerendered to expose', () => {
    // The site is prerendered so a crawler that does not run JavaScript can
    // read it. A Disallow with a path in it would be undoing that, and it is
    // the kind of line that gets added during a staging deploy and left.
    const disallowed = [...robots().matchAll(/^Disallow:\s*(\S+)$/gm)].map(
      (match) => match[1],
    )

    expect(
      disallowed,
      `robots.txt closes ${disallowed.join(', ')} to crawlers. Every page on ` +
        `this site is prerendered specifically to be readable without ` +
        `JavaScript; a Disallow is working against that`,
    ).toEqual([])
  })
})

test.describe('the sitemap', () => {
  const sitemap = () => {
    const file = join(clientDir(), 'sitemap.xml')
    expect(
      existsSync(file),
      'no sitemap.xml was emitted, so nothing tells a crawler which pages exist',
    ).toBe(true)
    return readFileSync(file, 'utf8')
  }

  test('lists the home page and every case study', async () => {
    const xml = sitemap()

    expect(xml).toContain('<loc>https://mehby.com/</loc>')
    for (const slug of ['coachess', 'helmdeck', 'volt-tunisia']) {
      expect(xml, `/work/${slug} is prerendered but not advertised`).toContain(
        `<loc>https://mehby.com/work/${slug}</loc>`,
      )
    }
  })

  test('lists nothing under /dev', async () => {
    // The prerender `filter` keeps /dev out of the output but NOT out of the
    // sitemap: the sitemap is built from startConfig.pages and only honours
    // `sitemap.exclude`. Two mechanisms, one rule, and this is the half that
    // is easy to believe is already handled.
    expect(
      sitemap(),
      'the sitemap advertises a path under /dev. It is excluded from the ' +
        'prerender but not from the sitemap, so it points at a 404',
    ).not.toContain('/dev')
  })

  test('advertises one address per page', async () => {
    // Two <loc> entries that resolve to the same file is duplicate content
    // handed to a crawler on purpose, and it is quiet: every entry has a page
    // behind it, so the check below passes and nothing else notices.
    //
    // Not hypothetical. The site footer linked to '/writing' while the route's
    // fullPath, and its own canonical link, are '/writing/'. The prerenderer
    // crawls links, so it discovered the second spelling, emitted a single
    // writing/index.html, and listed both addresses.
    const base = clientDir()
    const seen = new Map<string, Array<string>>()

    for (const match of sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = new URL(match[1]).pathname
      const file =
        path === '/' ? join(base, 'index.html') : join(base, path, 'index.html')
      seen.set(file, [...(seen.get(file) ?? []), path])
    }

    const duplicated = [...seen.values()].filter((paths) => paths.length > 1)

    expect(
      duplicated,
      `the sitemap advertises more than one address for the same prerendered ` +
        `file: ${duplicated.map((p) => p.join(' and ')).join('; ')}`,
    ).toEqual([])
  })

  test('advertises nothing it did not prerender', async () => {
    // A sitemap entry with no file behind it is a 404 handed to a crawler on
    // purpose. Checks the whole list rather than the known-bad paths, so a
    // route added later is covered.
    const base = clientDir()
    const locs = [...sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]).pathname,
    )

    expect(locs.length, 'the sitemap is empty').toBeGreaterThan(0)

    for (const path of locs) {
      const file =
        path === '/' ? join(base, 'index.html') : join(base, path, 'index.html')
      expect(
        existsSync(file),
        `the sitemap advertises ${path} but nothing was prerendered for it`,
      ).toBe(true)
    }
  })
})
