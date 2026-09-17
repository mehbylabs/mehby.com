import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { clientDir, htmlFor } from './support/built'

// Per route metadata, read off the prerendered HTML on disk.
//
// Deliberately not a DOM assertion. Every tag this file checks exists to serve
// a crawler or a link unfurler, and most of those do not execute JavaScript. A
// meta tag injected after hydration is invisible to every one of them, and
// `expect(page.locator('meta[property="og:title"]'))` cannot tell the two cases
// apart: it passes identically whether the tag shipped in the HTML or appeared
// a second later. That is the same class of mistake as asserting
// `response.ok()` and calling it a test.
//
// So this reads bytes, like tests/e2e/prerender.spec.ts, and requires a build.
// It fails rather than skips when the build output is missing, because a
// metadata test that quietly proves nothing is worse than no metadata test.

const SITE = 'https://mehby.com'

/** React escapes attribute values, so they come back out before comparison. */
const decode = (value: string) =>
  value
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** Every meta tag in the document, keyed by its `name` or its `property`. */
const metaOf = (html: string) => {
  const map = new Map<string, Array<string>>()
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
    const key = tag.match(/\b(?:name|property)="([^"]*)"/)?.[1]
    const content = tag.match(/\bcontent="([^"]*)"/)?.[1]
    if (key === undefined || content === undefined) continue
    map.set(key, [...(map.get(key) ?? []), decode(content)])
  }
  return map
}

const canonicalOf = (html: string) =>
  [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /rel="canonical"/.test(tag))
    .map((tag) => decode(tag.match(/href="([^"]*)"/)?.[1] ?? ''))

// The document title, which means the one in the head.
//
// Scoped there deliberately. <title> is not unique to HTML: it is also how an
// inline <svg> carries its accessible name, and the architecture diagrams on
// every case study use one. Matching the whole document counted those as
// second document titles and failed a page whose head is perfectly correct.
//
// The assertion this feeds still means what it meant: exactly one title in the
// head, because two is a document where a stale default was never removed and
// which one a crawler honours is not ours to decide.
const titleOf = (html: string) => {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? ''
  return [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].map(
    ([, inner]) => decode(inner),
  )
}

// The shipped copy, pinned. Written out here rather than imported from the
// route files on purpose: importing the source would make this test agree with
// whatever the routes say, including "", and the point is to hold them to a
// specific set of sentences somebody wrote and read.
const PAGES = [
  {
    path: '/',
    file: '/',
    title: 'Mohamed Elhedi Ben Yedder, full stack product engineer',
    description:
      'I build and ship full stack products end to end, from an empty repository to something people use. CTO and co-founder of CoaChess, available for freelance work.',
    image: '/og/default.png',
  },
  {
    path: '/about',
    file: 'about',
    title: 'About Mohamed Elhedi Ben Yedder, full stack product engineer',
    description:
      'I am a full stack product engineer. I work in React and TypeScript on the front, Python on the back, and I own the infrastructure underneath when the product needs it.',
    image: '/og/default.png',
  },
  {
    path: '/contact',
    file: 'contact',
    title: 'Start a conversation with Mohamed Elhedi Ben Yedder',
    description:
      'Tell me what you are building and what is in the way. The form reaches me directly, the address is printed beside it, and I reply to everything.',
    image: '/og/default.png',
  },
  {
    path: '/writing',
    file: 'writing',
    title: 'Writing by Mohamed Elhedi Ben Yedder',
    description:
      'Notes on the work behind the case studies. Nothing is published yet, so this page says so plainly rather than padding itself with placeholders.',
    image: '/og/default.png',
  },
  {
    path: '/work/coachess',
    file: 'work/coachess',
    title: 'CoaChess, a case study by Mohamed Elhedi Ben Yedder',
    description:
      'A chess coaching platform with four customer-facing surfaces, a B2B side for academies, and self-hosted live video.',
    image: '/og/coachess.png',
  },
  {
    path: '/work/helmdeck',
    file: 'work/helmdeck',
    title: 'Helmdeck, a case study by Mohamed Elhedi Ben Yedder',
    description:
      'Open-source mission control for AI coding agents, built on the open Agent Client Protocol.',
    image: '/og/helmdeck.png',
  },
  {
    path: '/work/volt-tunisia',
    file: 'work/volt-tunisia',
    title: 'VoltTunisia, a case study by Mohamed Elhedi Ben Yedder',
    description:
      'The national electric vehicle companion for Tunisia, built around the tariff and tax rules drivers actually face.',
    image: '/og/volt-tunisia.png',
  },
] as const

for (const page of PAGES) {
  test.describe(`${page.path} metadata`, () => {
    test('carries its own title and description in the shipped HTML', () => {
      const html = htmlFor(page.file)

      // Exactly one title element. Two is a document where a stale default was
      // never removed, and which one a crawler honours is not ours to decide.
      expect(titleOf(html)).toEqual([page.title])
      expect(metaOf(html).get('description')).toEqual([page.description])
    })

    test('declares its canonical address, once, absolutely', () => {
      const html = htmlFor(page.file)
      const canonical = `${SITE}${page.path}`

      // A relative canonical is legal and useless here: the same document is
      // reachable at a preview deployment host, and a relative href points the
      // crawler at that copy instead of at the site.
      expect(canonicalOf(html)).toEqual([canonical])
    })

    test('carries a complete OpenGraph card', () => {
      const meta = metaOf(htmlFor(page.file))

      expect(meta.get('og:title')).toEqual([page.title])
      expect(meta.get('og:description')).toEqual([page.description])
      expect(meta.get('og:url')).toEqual([`${SITE}${page.path}`])
      // Absolute, and it has to be. Every unfurler resolves og:image against
      // nothing, so a root-relative path is simply dropped and the card ships
      // without an image.
      expect(meta.get('og:image')).toEqual([`${SITE}${page.image}`])
      expect(meta.get('og:image:width')).toEqual(['1200'])
      expect(meta.get('og:image:height')).toEqual(['630'])
      expect(meta.get('og:image:alt')?.[0] ?? '').not.toBe('')
      expect(meta.get('og:type')).toEqual(['website'])
      expect(meta.get('og:site_name')).toEqual(['mehby.com'])
    })

    test('carries a complete Twitter card', () => {
      const meta = metaOf(htmlFor(page.file))

      expect(meta.get('twitter:card')).toEqual(['summary_large_image'])
      expect(meta.get('twitter:title')).toEqual([page.title])
      expect(meta.get('twitter:description')).toEqual([page.description])
      expect(meta.get('twitter:image')).toEqual([`${SITE}${page.image}`])
    })

    test('the share image it advertises was actually built', () => {
      const file = join(clientDir(), page.image)

      // public/og is gitignored and generated by scripts/og.mjs, so the way
      // this breaks is a build that skipped the generate step: every meta tag
      // still points at a PNG, and every one of them 404s.
      expect(
        existsSync(file),
        `${page.path} advertises ${page.image} but nothing was emitted at ${file}`,
      ).toBe(true)
      expect(readFileSync(file).subarray(0, 8).toString('hex')).toBe(
        '89504e470d0a1a0a',
      )
    })
  })
}

test.describe('the metadata as a set', () => {
  test('no two pages share a title', () => {
    // A title repeated across routes is the templated mush this exists to
    // avoid, and it is also what a search result page looks like when the head
    // option was copied and not edited.
    const titles = PAGES.map((page) => titleOf(htmlFor(page.file))[0])
    expect(
      new Set(titles).size,
      `duplicate titles: ${titles.join(' | ')}`,
    ).toBe(titles.length)
  })

  test('every canonical is an address the sitemap also advertises', () => {
    // Two documents in the crawler's eyes is the failure here, and it is
    // invisible from a browser: /writing and /writing/ both render, so the only
    // place the disagreement shows is between these two generated files. The
    // sitemap comes from the router's own paths, so the canonicals are the side
    // that has to agree with it.
    const sitemap = readFileSync(join(clientDir(), 'sitemap.xml'), 'utf8')
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

    expect(locs.length).toBe(PAGES.length)
    for (const page of PAGES) {
      const canonical = canonicalOf(htmlFor(page.file))[0]
      expect(
        locs,
        `${page.path} declares the canonical ${canonical}, which the sitemap ` +
          `does not list. The sitemap has: ${locs.join(', ')}`,
      ).toContain(canonical)
    }
  })

  test('nothing still carries the starter default', () => {
    for (const page of PAGES)
      expect(
        htmlFor(page.file),
        `${page.path} still advertises the scaffold title`,
      ).not.toContain('TanStack Start Starter')
  })

  test('every description is prose rather than a keyword list', () => {
    for (const page of PAGES) {
      const description = metaOf(htmlFor(page.file)).get('description')![0]

      expect(
        description.endsWith('.'),
        `${page.path} does not end in a stop`,
      ).toBe(true)
      expect(
        description.split(/\s+/).length,
        `${page.path} description is too short to be a sentence`,
      ).toBeGreaterThan(12)
      // A crawler truncates past roughly this, and a description written to be
      // truncated is a description nobody read back.
      expect(
        description.length,
        `${page.path} description is too long to survive a search result`,
      ).toBeLessThan(200)
      // The separators a keyword list is built from.
      expect(description).not.toMatch(/ \| | • |;\s*\w+\s*;/)
    }
  })

  test('no metadata anywhere breaks the em dash rule', () => {
    // PRODUCT.md's standing rule covers every piece of interface and content
    // copy, and metadata is copy: it is the first sentence most people read.
    for (const page of PAGES) {
      const html = htmlFor(page.file)
      const copy = [
        ...titleOf(html),
        ...[...metaOf(html).values()].flat(),
        ...canonicalOf(html),
      ]
      for (const text of copy) {
        expect(text, `${page.path} metadata contains an em dash`).not.toContain(
          '\u2014',
        )
        expect(text, `${page.path} metadata contains --`).not.toContain('--')
      }
    }
  })
})
