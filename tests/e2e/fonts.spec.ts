import { expect, test } from '@playwright/test'

// Permanent test. Fonts fail silently: a broken @font-face, a stale path, a
// wrong family name or a stray Google Fonts link all still render text, just in
// the wrong typeface. Nothing throws, no build breaks, and nobody notices until
// production. So the contract is pinned here.
//
// Note on what a network-only check would prove: nothing much. `rel=preload`
// downloads the file whether or not the @font-face that should consume it is
// valid, so "two woff2 requests happened" is satisfied even by a completely
// broken stylesheet. The load and axis assertions below are what actually prove
// the faces are usable.

const FONT_URLS = ['/fonts/archivo.woff2', '/fonts/martian-mono.woff2']
const FAMILIES = ['Archivo', 'Martian Mono']

test('the server-rendered HTML preloads both faces', async ({ request }) => {
  // Asserted against the raw response body, not the DOM, because the point of a
  // preload is to be visible to the browser's preload scanner before any
  // JavaScript runs. A link injected during hydration is too late to be useful.
  const html = await (await request.get('/')).text()

  for (const url of FONT_URLS) {
    const tag = html
      .match(/<link[^>]*rel="preload"[^>]*>/g)
      ?.find((t) => t.includes(url))

    expect(tag, `no preload link for ${url} in the server HTML`).toBeTruthy()
    expect(tag).toContain('as="font"')
    expect(tag).toContain('type="font/woff2"')
    // Without crossorigin the preload cannot be matched to the CORS-mode fetch
    // the font itself uses, and the browser downloads the file twice.
    expect(tag).toContain('crossorigin="anonymous"')
  }
})

test.describe('font loading', () => {
  test('both families resolve to loaded web font faces', async ({ page }) => {
    await page.goto('/')

    for (const family of FAMILIES) {
      const statuses = await page.evaluate(
        async (f) =>
          (await document.fonts.load(`400 16px "${f}"`)).map((x) => x.status),
        family,
      )

      expect(statuses, `no @font-face matched "${family}"`).not.toHaveLength(0)
      expect(statuses.every((s) => s === 'loaded')).toBe(true)
    }
  })

  test('the width axis is live on both families', async ({ page }) => {
    // This is the assertion that distinguishes "the real variable file loaded"
    // from "a same-named system font was substituted". Only the variable file
    // changes advance width in response to font-stretch. Compares ordering, not
    // pixel values, so it survives font version bumps.
    await page.goto('/')

    for (const family of FAMILIES) {
      const widths = await page.evaluate(async (f) => {
        await document.fonts.load(`400 64px "${f}"`)
        const el = document.createElement('span')
        el.textContent = 'Specification 0123'
        el.style.cssText = `position:absolute;white-space:nowrap;font-size:64px;font-family:"${f}"`
        document.body.append(el)

        const at = (stretch: string) => {
          el.style.fontStretch = stretch
          return el.getBoundingClientRect().width
        }
        // 75% and 112.5% sit inside both families' declared ranges (Archivo
        // 62-125, Martian Mono 75-112.5), so one set of stops covers both.
        const out = [at('75%'), at('100%'), at('112.5%')]
        el.remove()
        return out
      }, family)

      const [narrow, normal, wide] = widths
      expect(narrow, `${family}: 75% not narrower than 100%`).toBeLessThan(
        normal,
      )
      expect(wide, `${family}: 112.5% not wider than 100%`).toBeGreaterThan(
        normal,
      )
    }
  })

  test('exactly two woff2 files are fetched, both from our own origin', async ({
    page,
    baseURL,
  }) => {
    const woff2: Array<string> = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.endsWith('.woff2')) woff2.push(r.url())
    })

    await page.goto('/')
    // Exercise both families so any face the preloads did not cover would show
    // up as an extra request here.
    await page.evaluate(async () => {
      await Promise.all(
        ['Archivo', 'Martian Mono'].map((f) =>
          document.fonts.load(`400 16px "${f}"`),
        ),
      )
      await document.fonts.ready
    })

    // Exactly two, not "at least two": a duplicate means the preload failed to
    // match the font fetch and the file was downloaded twice.
    expect(woff2.sort()).toEqual(FONT_URLS.map((u) => `${baseURL}${u}`).sort())
  })

  test('nothing is requested from a third party', async ({ page, baseURL }) => {
    // Deliberately not an allow-list of known font CDNs. The invariant is that
    // this site is wholly self-hosted, so any off-origin request at all is the
    // failure, whether it is fonts.googleapis.com, a CDN someone reached for,
    // or a host nobody thought to enumerate. Self-hosting fonts is also a
    // privacy obligation in the EU, which makes it worth pinning permanently.
    const foreign: Array<string> = []
    page.on('request', (r) => {
      if (!r.url().startsWith(`${baseURL}/`)) foreign.push(r.url())
    })

    await page.goto('/')
    await page.evaluate(async () => {
      await Promise.all(
        ['Archivo', 'Martian Mono'].map((f) =>
          document.fonts.load(`400 16px "${f}"`),
        ),
      )
      await document.fonts.ready
    })

    expect(foreign).toEqual([])
  })
})
