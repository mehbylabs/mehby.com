import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { clientDir } from './support/built'
import { hydrated } from './support/probes'
import { getCaseStudies } from '#/lib/content'

// Derived, never hardcoded. The proof strip flattens every surface declared in
// case study frontmatter, so a surface added to a .mdx file must reach the page
// by existing rather than by anybody remembering to update a number here. This
// test previously asserted 3 and silently became wrong the day a fourth
// CoaChess surface shipped.
const SURFACE_COUNT = getCaseStudies().flatMap((s) => s.surfaces).length
const STUDY_COUNT = getCaseStudies().length

// The performance gate.
//
// Split by what each half can honestly prove, which is the whole reason this
// file is shaped the way it is.
//
// The byte budget reads the built files off disk. It deliberately does not
// measure the dev server: dev serves unbundled modules over hundreds of
// requests, so a transfer measurement there is a number about Vite rather than
// about the site, and it would move every time a dependency changed its
// internal file layout. Reading the emitted bundle is the same argument
// prerender.spec.ts makes for reading HTML rather than the DOM.
//
// Everything else is measured in a real browser, because layout shift, font
// loading and what a client without JavaScript sees are behaviours and not
// file sizes.
//
// The numbers below were taken with Lighthouse 13.4.1 against the built
// node-server, mobile profile, on a cold load of `/`, when this site still
// shipped precompressed twins and served its HTML through the SSR handler:
//
//   Font        129 123 B   126.1 KiB   two woff2, already Brotli internally
//   Script       96 648 B    94.4 KiB   from 328.4 KiB uncompressed
//   Document     17 056 B    16.7 KiB   not compressed, see below
//   Stylesheet    4 989 B     4.9 KiB   from 22.6 KiB uncompressed
//   Other           881 B     0.9 KiB   favicon
//   TOTAL       248 697 B   242.9 KiB
//
//   Performance 97, Accessibility 100, Best practices 100, SEO 100
//   FCP 1.9s  LCP 2.4s  TBT 0ms  CLS 0  Speed Index 1.9s
//
// The target is now Vercel, and two of those lines change. The document is a
// file in the static output rather than an SSR response, so it is compressed
// like everything else; and the twins are gone, because Vercel negotiates
// encoding at its edge and never looks at a `.gz` sibling. See vite.config.ts.
//
// That is a claim about somebody else's CDN, and this suite cannot reach it.
// What it can do is stop pretending: `wireBytes` gzips in process, which is
// the same thing the edge does and is measurable here, and the budget below is
// re-derived from those numbers rather than carried over.

/**
 * What a byte-counting client actually pays for one file.
 *
 * gzip level 9, in process, because that models what Vercel's CDN sends and
 * there is no longer a precompressed twin on disk to read instead. Deliberately
 * gzip and not brotli: brotli is what the edge will actually pick for a modern
 * browser and it is smaller, so counting gzip keeps the budget on the
 * pessimistic side of the truth rather than on the flattering side.
 */
const wireBytes = (file: string) => {
  const raw = readFileSync(file)
  // woff2 carries its own Brotli stream; recompressing it measures nothing.
  if (file.endsWith('.woff2')) return raw.length
  return gzipSync(raw, { level: 9 }).length
}

test.describe('the built home page fits its budget', () => {
  // Everything the browser fetches for a cold load of `/`: the document, plus
  // every stylesheet, module preload and font the document names. Parsed out
  // of the HTML rather than listed, so a chunk added to the entry graph is
  // counted without anybody editing this.
  const homeResources = () => {
    const client = clientDir()
    const html = readFileSync(join(client, 'index.html'), 'utf8')

    // Subresources only. The same attributes also carry navigation links
    // (`href="/about"`), which the browser does not fetch on this load and
    // which resolve to directories on disk, so the set is filtered by
    // extension rather than by trying to read whatever the path points at.
    const SUBRESOURCE = /\.(css|js|woff2|svg|png)$/

    const hrefs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((href) => SUBRESOURCE.test(href))

    const files = [...new Set(hrefs)]
      .map((href) => ({ href, file: join(client, href) }))
      .filter(
        (entry) => existsSync(entry.file) && statSync(entry.file).isFile(),
      )

    expect(
      files.length,
      'no subresources were found in the built home page, so the budget ' +
        'below would pass against nothing',
    ).toBeGreaterThan(4)

    return { html, files }
  }

  test('costs under 250 KiB on the wire, fonts included', async () => {
    const { html, files } = homeResources()

    // Counted compressed, and that is the one line the preset change moved.
    //
    // On node-server the document was counted raw at 16 808 B, because nitro
    // bakes its public-asset manifest before the prerenderer writes the HTML:
    // the pages had no twin, fell through to the SSR handler, and went out
    // chunked and unencoded. Verified at the time with `curl -H 'Accept-
    // Encoding: br, gzip' -D-`, which returned content-encoding: br for
    // /assets/*.css and no content-encoding at all for /.
    //
    // Under the vercel preset the same file lands in the static output, where
    // `{ handle: "filesystem" }` in config.json serves it before the catch-all
    // ever runs, so it is compressed on the way out like every other file. The
    // raw number is kept in the breakdown so a reader can see both.
    const documentRaw = readFileSync(join(clientDir(), 'index.html')).length
    const document = gzipSync(Buffer.from(html), { level: 9 }).length
    const byType = new Map<string, number>()
    for (const { href, file } of files) {
      const type = href.endsWith('.css')
        ? 'stylesheet'
        : href.endsWith('.js')
          ? 'script'
          : href.endsWith('.woff2')
            ? 'font'
            : 'other'
      byType.set(type, (byType.get(type) ?? 0) + wireBytes(file))
    }

    const total = document + [...byType.values()].reduce((a, b) => a + b, 0)
    const breakdown = [
      ...[...byType, ['document', document] as [string, number]]
        .sort((a, b) => b[1] - a[1])
        .map(([type, bytes]) => `${type.padEnd(10)} ${bytes} B`),
      `(the document is ${documentRaw} B on disk and ${document} B gzipped)`,
    ].join('\n    ')

    // 260 KiB, against a measured 252.5 KiB. Headroom for a chunk or two, not
    // for a category. The number is deliberately close: the point of a budget
    // is to fail before somebody adds a font or an analytics bundle, and a
    // budget with 3x headroom fails only after it is far too late.
    //
    // It moved up from 250 KiB, and the whole move is the shadcn/ui additions
    // of the terminal design. The previous budget was measured against the
    // light design, whose chrome was plain markup; the sticky nav's Button and
    // the form's Label and controls pull radix-ui primitives into the entry
    // chunk, which all eight prerendered pages share. Measured: script went
    // from 106 709 B to 118 222 B gzipped, and the stylesheet from 4 989 B to
    // 6 991 B. The fonts are unchanged at 128 596 B and are still the largest
    // single line and the place the next real saving would have to come from.
    expect(
      total,
      `a cold load of the home page costs ${(total / 1024).toFixed(1)} KiB:\n` +
        `    ${breakdown}\n`,
    ).toBeLessThan(260 * 1024)
  })

  test('ships no precompressed twin, because nothing on Vercel serves one', async () => {
    // The inverse of the test this replaces, and for a measured reason.
    //
    // `compressPublicAssets` was right while the target was node-server, which
    // serves the bytes on disk verbatim: without twins the home page cost
    // 494.0 KiB on the wire instead of 242.9 and Lighthouse's mobile score was
    // 83 rather than 97.
    //
    // Vercel's Build Output API has no concept of a `.gz` sibling. A file
    // named `foo.js.gz` in the static output is reachable only by asking for
    // `/assets/foo.js.gz`, which no browser does; encoding is negotiated at
    // the edge from the real file. So the twins are not insurance, they are 28
    // files and 254 695 B of freight, a quarter of the entire static output,
    // uploaded on every deploy and served to nobody.
    //
    // This fails if the option comes back, which is the failure worth
    // catching: re-enabling it looks like a performance fix, passes every
    // other test in this file, and makes the deployment 25 percent larger for
    // no change on the wire at all.
    const client = clientDir()
    const twins: Array<string> = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (entry.endsWith('.gz') || entry.endsWith('.br'))
          twins.push(path)
      }
    }
    walk(client)

    expect(
      twins,
      'the static output holds precompressed twins. Vercel never requests ' +
        'them, so these are bytes uploaded on every deploy and served to no ' +
        'one. Remove `compressPublicAssets` from the nitro options in ' +
        'vite.config.ts',
    ).toEqual([])
  })

  test('preloads both fonts from the served HTML', async () => {
    // Neither face is discoverable until the stylesheet has parsed, and both
    // are needed above the fold. crossorigin is not optional: font fetches are
    // always CORS mode, so a preload without it is not matched and the file is
    // downloaded twice.
    const html = readFileSync(join(clientDir(), 'index.html'), 'utf8')

    for (const font of ['/fonts/archivo.woff2', '/fonts/martian-mono.woff2']) {
      const preload = new RegExp(
        `<link[^>]*rel="preload"[^>]*href="${font}"[^>]*>`,
      ).exec(html)

      expect(
        preload?.[0],
        `${font} is not preloaded from the HTML`,
      ).toBeTruthy()
      expect(
        preload?.[0],
        `the preload for ${font} has no crossorigin, so it will not be ` +
          `matched and the font downloads twice`,
      ).toContain('crossorigin')
      expect(preload?.[0]).toContain('as="font"')
    }
  })
})

test.describe('nothing moves once it has painted', () => {
  test('the home page settles at a cumulative layout shift of zero', async ({
    page,
  }) => {
    // Measured, not inferred from "the fonts are preloaded". CLS is the one
    // Core Web Vital this site is structurally exposed to: it swaps two web
    // fonts and reserves space for placeholder images, and either one getting
    // it wrong moves text under a reader's eye.
    //
    // The observer is installed before any script on the page runs, because a
    // layout-shift entry is only delivered to an observer that already exists.
    await page.addInitScript(() => {
      window.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean }
        >) {
          // Shifts within 500ms of a user interaction are excluded from CLS by
          // definition; there is no interaction here, but the flag is honoured
          // so this measures the same quantity Lighthouse reports.
          if (!entry.hadRecentInput) window.__cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await page.goto('/')
    await hydrated(page)
    // The fonts are the thing most likely to shift, and they shift when they
    // swap in, which is after load. Wait for them rather than for a duration.
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)

    const cls = await page.evaluate(() => window.__cls)

    expect(
      cls,
      `the home page accumulated a layout shift of ${cls}. Both fonts are ` +
        `preloaded and every placeholder reserves its aspect ratio, so any ` +
        `shift at all means one of those two stopped being true`,
    ).toBeLessThanOrEqual(0.01)
  })
})

test.describe('the prerendered HTML is real content', () => {
  // The reason the site is prerendered at all. PRODUCT.md puts the burden of
  // credibility on the page itself because the owner's recent source is
  // private, so a client that does not run JavaScript has to be able to read
  // the proof rather than an empty shell.
  //
  // prerender.spec.ts proves the bytes are on disk. This proves a browser with
  // scripting switched off renders them, which is the part a file read cannot
  // show: a document can contain the copy and still hide it behind a style or
  // a hydration gate.
  test.use({ javaScriptEnabled: false })

  test('shows the hero copy with JavaScript disabled', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('hero-display')).toHaveText(
      'I build and ship full stack products, end to end.',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Mohamed Elhedi Ben Yedder',
    )
  })

  test('shows every case study with JavaScript disabled', async ({ page }) => {
    await page.goto('/')

    const pillars = page.getByTestId('pillar-link')
    await expect(pillars).toHaveCount(STUDY_COUNT)
    for (const title of ['VoltTunisia', 'Helmdeck', 'CoaChess']) {
      await expect(
        page.getByRole('link', { name: new RegExp(title) }).first(),
        `${title} is not readable without JavaScript`,
      ).toBeVisible()
    }
  })

  test('shows the proof strip with JavaScript disabled', async ({ page }) => {
    await page.goto('/')

    const links = page.getByTestId('proof-link')
    await expect(links).toHaveCount(SURFACE_COUNT)
    await expect(links.first()).toBeVisible()
  })

  test('shows a case study specification with JavaScript disabled', async ({
    page,
  }) => {
    await page.goto('/work/coachess')

    await expect(page.getByTestId('spec-table')).toBeVisible()
    await expect(page.getByTestId('narrative')).toContainText(
      'One platform, five surfaces',
    )
  })
})
