import { expect, test } from '@playwright/test'
import { hydrated } from './support/probes'
import type { Locator, Page } from '@playwright/test'

// Permanent test. Design tokens fail silently in two distinct ways, and neither
// one breaks a build:
//
//   1. Tailwind v4 tree-shakes `@theme` variables. A token nothing references is
//      simply absent from the compiled CSS, so `var(--text-h1)` written by hand
//      anywhere outside this stylesheet resolves to nothing and the declaration
//      is dropped. `@theme static` is what stops that, and this test is what
//      proves `static` is still there.
//   2. A typo in the `@layer base` block leaves the page rendering perfectly
//      well in Times New Roman on white.
//
// So the contract is pinned against computed style in a real browser, not
// against the text of styles.css.
//
// ---------------------------------------------------------------------------
// This file absorbed tests/e2e/primitives.spec.ts. That file was the pinned
// record for Grid and SectionField, the two layout primitives the terminal
// design deleted: it measured the three colour grounds, their inherited
// leading, and the drawn grid rules. All of those are gone with the
// primitives, and the one invariant that outlived them, that the `--leading-*`
// tokens reach the elements that ship, is the second describe block below.
// ---------------------------------------------------------------------------

// Source of truth: DESIGN.md, and scripts/contrast.mjs for the colours.
const TOKENS: Record<string, string> = {
  '--color-bg': 'oklch(0.145 0.01 70)',
  '--color-panel': 'oklch(0.185 0.012 70)',
  '--color-panel-lift': 'oklch(0.225 0.014 70)',
  '--color-text': 'oklch(0.93 0.012 75)',
  '--color-muted': 'oklch(0.64 0.02 72)',
  '--color-orange': 'oklch(0.66 0.2 45)',
  '--color-amber': 'oklch(0.85 0.13 85)',
  '--color-green': 'oklch(0.75 0.16 150)',
  '--color-red': 'oklch(0.6 0.2 25)',
  '--color-edge': 'oklch(0.35 0.015 70)',
  '--color-edge-strong': 'oklch(0.52 0.02 70)',

  '--font-display': "'Archivo', system-ui, sans-serif",
  '--font-body': "'Archivo', system-ui, sans-serif",
  '--font-data': "'Martian Mono', ui-monospace, monospace",

  '--text-display': 'clamp(2.6rem, 7vw, 5.8rem)',
  '--text-h1': 'clamp(2.1rem, 4.2vw, 3.4rem)',
  '--text-h2': 'clamp(1.6rem, 2.6vw, 2.3rem)',
  '--text-h3': '1.375rem',
  '--text-body': '1.0625rem',
  '--text-data': '0.9375rem',
  '--text-fine': '0.8125rem',
}

const LEADING: Record<string, number> = {
  '--leading-display': 1.02,
  '--leading-h1': 1.08,
  '--leading-h2': 1.2,
  '--leading-body': 1.65,
}

const visit = async (page: Page, path: string) => {
  await page.goto(path)
  await hydrated(page)
}

const styleOf = (locator: Locator, props: Array<string>) =>
  locator.evaluate((el, names: Array<string>) => {
    const s = getComputedStyle(el)
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]))
  }, props)

test('every design token reaches the browser as a custom property', async ({
  page,
}) => {
  await visit(page, '/')

  const actual = await page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      names.map((n) => [n, style.getPropertyValue(n).trim()]),
    )
  }, Object.keys(TOKENS))

  for (const [name, expected] of Object.entries(TOKENS)) {
    expect(
      actual[name],
      `${name} is missing or wrong on :root. Either it is not declared in the ` +
        `@theme block in styles.css, or the block lost its \`static\` keyword ` +
        `and Tailwind tree-shook this token because nothing references it yet`,
    ).toBe(expected)
  }
})

test('the base layer paints the document from those tokens', async ({
  page,
}) => {
  await visit(page, '/')

  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body)
    return {
      background: s.backgroundColor,
      color: s.color,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
    }
  })

  // Chromium serialises an oklch() computed colour back as oklch(), so these
  // compare against the token values directly.
  expect(body.background).toBe(TOKENS['--color-bg'])
  expect(body.color).toBe(TOKENS['--color-text'])
  // The family name must be bare `Archivo`, not `Archivo Variable`. The
  // fontsource default name would fall back to system-ui without erroring.
  expect(body.fontFamily).toBe('Archivo, system-ui, sans-serif')
  expect(body.fontSize).toBe('17px') // --text-body, 1.0625rem
  expect(body.lineHeight).toBe('28.05px') // 1.65 * 17
})

test.describe('the leading tokens reach the elements that ship', () => {
  // The replacement for the primitives harness's `leading-*` utility test, and
  // a different assertion rather than the same one moved.
  //
  // That test proved Tailwind generates a utility from the --leading-*
  // namespace. Nothing on this site uses those utilities: every real element
  // reads `line-height: var(--leading-h1)` and friends from styles.css, so
  // the utilities could stop being generated tomorrow and no page would
  // change. What matters is that each token resolves on the element that
  // consumes it, because the failure the old comment described is real and is
  // reached the other way: a declaration deleted from styles.css leaves the
  // heading inheriting 1.65, which at --text-display is a 9.6rem line box.
  //
  // One element per token, and each is the only place that token is used at
  // this size on the site.
  const CONSUMERS = [
    { path: '/', selector: '.hero-display', token: '--leading-display' },
    { path: '/about', selector: '.page-title', token: '--leading-h1' },
    // .section-title, not .section-path-title. The path label is page
    // identity now and appears only beside an h1; an interior section heading
    // stands on its own.
    { path: '/', selector: '.section-title', token: '--leading-h2' },
    { path: '/work/coachess', selector: '.prose p', token: '--leading-body' },
  ] as const

  for (const consumer of CONSUMERS) {
    test(`${consumer.token} resolves on ${consumer.selector}`, async ({
      page,
    }) => {
      await visit(page, consumer.path)

      const element = page.locator(consumer.selector).first()
      await expect(
        element,
        `${consumer.selector} no longer exists on ${consumer.path}, so ` +
          `${consumer.token} has no shipping consumer to measure`,
      ).toBeVisible()

      const s = await styleOf(element, ['line-height', 'font-size'])
      const resolved = parseFloat(s['line-height']) / parseFloat(s['font-size'])

      expect(
        resolved,
        `${consumer.selector} on ${consumer.path} resolves to a leading of ` +
          `${resolved.toFixed(3)} rather than ${consumer.token}. A missing ` +
          `line-height declaration inherits 1.65, which at --text-display is a ` +
          `9.6rem line box`,
      ).toBeCloseTo(LEADING[consumer.token], 2)
    })
  }
})

// Measures a throwaway element that asks for long, delayed, infinite motion
// through the *style attribute*. Inline declarations outrank every normal
// declaration in every cascade layer, so beating them is a strictly stronger
// result than beating a utility class: if the base-layer !important wins here,
// it wins against any non-important utility Tailwind could ever emit.
//
// Chromium serialises computed times in seconds and may use exponent notation
// (0.01ms comes back as "1e-05s"), so durations are compared as numbers.
const measure = () => {
  const el = document.createElement('div')
  el.style.cssText =
    'animation: none 5s linear 2s infinite; transition: opacity 5s linear 2s'
  document.body.append(el)
  const s = getComputedStyle(el)
  const out = {
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: parseFloat(s.animationDuration),
    animationDelay: parseFloat(s.animationDelay),
    animationIterationCount: s.animationIterationCount,
    transitionDuration: parseFloat(s.transitionDuration),
    transitionDelay: parseFloat(s.transitionDelay),
  }
  el.remove()
  return out
}

test.describe('reduced motion', () => {
  test('is not applied when the user has expressed no preference', async ({
    page,
  }) => {
    await page.goto('/')
    const m = await page.evaluate(measure)

    // Guards the media query itself. Without this, a reset accidentally
    // written outside the @media would still pass the test below while
    // silently killing all motion for everyone.
    expect(m.matches).toBe(false)
    expect(m.animationDuration).toBe(5)
    expect(m.transitionDuration).toBe(5)
  })

  test('collapses animation and transition to an instant state change', async ({
    page,
  }) => {
    await page.goto('/')
    // Set explicitly rather than via `test.use({ reducedMotion: 'reduce' })`:
    // that context option does not reach the page under this Playwright and
    // config combination — matchMedia stayed false — which would have turned
    // this into a test that silently proved nothing.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const m = await page.evaluate(measure)

    expect(m.matches, 'reduced-motion emulation did not take').toBe(true)
    expect(m.animationDuration).toBeLessThan(0.001)
    expect(m.transitionDuration).toBeLessThan(0.001)
    // Not zero: durations are collapsed rather than removed so animationend
    // still fires and any JS sequencing on it does not stall.
    expect(m.animationDuration).toBeGreaterThan(0)
    // Delays are zeroed too. DESIGN.md specifies a *staggered* hero reveal, so
    // a surviving delay would still hold elements back for the length of the
    // stagger even with the duration collapsed.
    expect(m.animationDelay).toBe(0)
    expect(m.transitionDelay).toBe(0)
    // Without this an `infinite` animation still loops, just at 0.01ms per
    // iteration, firing animationiteration thousands of times a second.
    expect(m.animationIterationCount).toBe('1')
  })
})
