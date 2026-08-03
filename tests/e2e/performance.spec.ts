import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { hydrated } from './support/probes'

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
// server, mobile profile, on a cold load of `/`:
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

const OUTPUT = '.output'

const clientDir = () => {
  expect(
    existsSync(OUTPUT),
    `${OUTPUT} does not exist. Run \`bun run build\` before \`bun run test:e2e\`; ` +
      `these assertions read the built bundle from disk`,
  ).toBe(true)

  const found: Array<string> = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry === 'index.html') found.push(dir)
    }
  }
  walk(OUTPUT)

  const root = found.sort((a, b) => a.length - b.length)[0]
  expect(root, `no index.html anywhere under ${OUTPUT}`).toBeTruthy()
  return root
}

/**
 * What a byte-counting client actually pays for one file.
 *
 * Prefers the precompressed twin the build emits, because that is what the
 * server sends under content negotiation. Falls back to gzipping in process
 * rather than to the raw size, so a file that lost its twin is reported at
 * roughly what a compressing proxy would send instead of being counted at four
 * times its real cost and failing the budget for the wrong reason.
 */
const wireBytes = (file: string) => {
  for (const encoding of ['.br', '.gz']) {
    if (existsSync(file + encoding)) return statSync(file + encoding).size
  }
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

  test('costs under 260 KiB on the wire, fonts included', async () => {
    const { html, files } = homeResources()

    // Counted raw, because that is what goes over the wire. The prerendered
    // documents get no precompressed twin: nitro bakes its public-asset
    // manifest before the prerenderer writes the HTML, so the pages are served
    // by the SSR handler instead, chunked and unencoded. Verified against the
    // built server: `curl -H 'Accept-Encoding: br, gzip' -D-` returns
    // content-encoding: br for /assets/*.css and no content-encoding at all
    // for /.
    //
    // gzip would take this document from 16.4 KiB to 3.2 KiB, so it is the
    // largest remaining saving on the critical path and it is deliberately
    // inside the budget rather than excused out of it.
    const document = readFileSync(join(clientDir(), 'index.html')).length
    const documentIfCompressed = gzipSync(Buffer.from(html), {
      level: 9,
    }).length
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
      `(the document would be ${documentIfCompressed} B gzipped, but the ` +
        `preset serves it unencoded)`,
    ].join('\n    ')

    // 260 KiB, against a measured 242.9 KiB. Headroom for a chunk or two, not
    // for a category. The number is deliberately close: the point of a budget
    // is to fail before somebody adds a font or an analytics bundle, and a
    // budget with 3x headroom fails only after it is far too late.
    expect(
      total,
      `a cold load of the home page costs ${(total / 1024).toFixed(1)} KiB:\n` +
        `    ${breakdown}\n`,
    ).toBeLessThan(260 * 1024)
  })

  test('emits a precompressed twin for every text asset it serves', async () => {
    // Without these the node-server preset sends the bytes on disk verbatim.
    // Measured before compressPublicAssets was enabled: the home page cost
    // 494.0 KiB on the wire instead of 242.9, and Lighthouse's mobile
    // performance score was 83 rather than 97.
    const { files } = homeResources()

    // Nitro documents a 1 KB floor: below it the compressed form plus the
    // extra round trip is not worth the bytes, and jsx-runtime at 961 B sits
    // under it legitimately. The floor is honoured here rather than worked
    // around, so this fails for a real regression and not for a small chunk.
    const COMPRESSION_FLOOR = 1024

    const uncompressed = files
      .filter(({ href }) => href.endsWith('.js') || href.endsWith('.css'))
      .filter(({ file }) => statSync(file).size >= COMPRESSION_FLOOR)
      .filter(
        ({ file }) => !existsSync(`${file}.br`) && !existsSync(`${file}.gz`),
      )
      .map(({ href }) => href)

    expect(
      uncompressed,
      'these text assets have no precompressed twin, so the server sends ' +
        'them uncompressed under any Accept-Encoding',
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
    await expect(pillars).toHaveCount(3)
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
    await expect(links).toHaveCount(3)
    await expect(links.first()).toBeVisible()
  })

  test('shows a case study specification with JavaScript disabled', async ({
    page,
  }) => {
    await page.goto('/work/coachess')

    await expect(page.getByTestId('spec-table')).toBeVisible()
    await expect(page.getByTestId('narrative')).toContainText(
      'Three surfaces, three jobs',
    )
  })
})
