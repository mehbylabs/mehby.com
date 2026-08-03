import { expect, test } from '@playwright/test'

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

// Source of truth: DESIGN.md, and scripts/contrast.mjs for the colours.
const TOKENS: Record<string, string> = {
  '--color-paper': 'oklch(0.97 0.008 85)',
  '--color-ink': 'oklch(0.22 0.02 265)',
  '--color-ultramarine': 'oklch(0.52 0.19 264)',
  '--color-ultramarine-deep': 'oklch(0.34 0.15 264)',
  '--color-rule': 'oklch(0.88 0.01 85)',
  '--color-rule-strong': 'oklch(0.62 0.012 85)',
  '--color-signal': 'oklch(0.56 0.16 45)',

  '--font-display': "'Archivo', system-ui, sans-serif",
  '--font-body': "'Archivo', system-ui, sans-serif",
  '--font-data': "'Martian Mono', ui-monospace, monospace",

  '--text-display': 'clamp(3rem, 9vw, 7.5rem)',
  '--text-h1': 'clamp(2.25rem, 4.5vw, 3.75rem)',
  '--text-h2': 'clamp(1.75rem, 2.8vw, 2.5rem)',
  '--text-h3': '1.333rem',
  '--text-body': '1.0625rem',
  '--text-data': '0.9375rem',
  '--text-fine': '0.8125rem',
}

test('every design token reaches the browser as a custom property', async ({
  page,
}) => {
  await page.goto('/')

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
  await page.goto('/')

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
  expect(body.background).toBe(TOKENS['--color-paper'])
  expect(body.color).toBe(TOKENS['--color-ink'])
  // The family name must be bare `Archivo`, not `Archivo Variable`. The
  // fontsource default name would fall back to system-ui without erroring.
  expect(body.fontFamily).toBe('Archivo, system-ui, sans-serif')
  expect(body.fontSize).toBe('17px') // --text-body, 1.0625rem
  expect(body.lineHeight).toBe('27.2px') // 1.6 * 17
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
