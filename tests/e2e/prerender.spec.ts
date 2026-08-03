import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
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
// Requires a build. `bun run build` writes .output; this file deliberately
// fails rather than skips when it is absent, because a test that quietly
// proves nothing is worse than no test.

const OUTPUT = '.output'

/** Every path the build prerenders and advertises. */
const PAGES = [
  { path: '/' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/writing/' },
  { path: '/work/coachess' },
  { path: '/work/helmdeck' },
  { path: '/work/volt-tunisia' },
] as const

const clientDir = () => {
  expect(
    existsSync(OUTPUT),
    `${OUTPUT} does not exist. Run \`bun run build\` before \`bun run test:e2e\`; ` +
      `these assertions read the prerendered HTML from disk`,
  ).toBe(true)

  // Found rather than hard-coded: the client output directory is the adapter's
  // to name, and pinning ".output/public" here would turn an adapter change
  // into a failure that blames prerendering.
  const found: Array<string> = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry === 'index.html') found.push(dir)
    }
  }
  walk(OUTPUT)

  const root = found
    .slice()
    .sort((a, b) => a.length - b.length)
    .find((dir) => existsSync(join(dir, 'index.html')))

  expect(root, `no index.html anywhere under ${OUTPUT}`).toBeTruthy()
  return root!
}

const htmlFor = (path: string) => {
  const base = clientDir()
  const file =
    path === '/' ? join(base, 'index.html') : join(base, path, 'index.html')

  expect(
    existsSync(file),
    `${file} was not emitted, so ${path} ships as a client-rendered page and ` +
      `a crawler that does not run JavaScript sees an empty document`,
  ).toBe(true)
  return readFileSync(file, 'utf8')
}

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
    const OWN_ORIGIN = 'https://mehby.com'

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
