import { expect, test } from '@playwright/test'
import { hydrated } from './support/probes'
import type { Locator, Page } from '@playwright/test'

// Grid and SectionField, pinned against a real browser.
//
// The bug this file exists to prevent is an inheritance bug, and inheritance
// bugs are invisible in source review: a section that sets only a background
// looks complete, renders, and is wrong. `class="bg-ultramarine"` and
// `class="bg-ultramarine text-paper"` are one token apart in a diff and 3.02
// vs 5.26 apart on screen. So nothing here asserts on class names. Every
// assertion measures computed style, and the contrast ones re-measure the
// ratio in the browser rather than trusting that the right token was named.
//
// ---------------------------------------------------------------------------
// This drove /dev/primitives, a scratch harness that rendered all three tones
// side by side with a link and a paragraph in each. The harness is deleted and
// these assertions are re-pointed at the pages that ship. Two notes on what
// that cost and what it bought.
//
// It bought a real ultramarine-deep. The harness rendered one as a fixture;
// the only ultramarine-deep on the site is the footer, which is on every page,
// so the tone is now measured where a visitor actually meets it. That also
// means the "every tone" test can no longer scope itself to <main>, which it
// used to do precisely to avoid matching the footer.
//
// It cost the `leading-*` utility test, and the loss is instructive rather
// than regrettable. That test asserted that Tailwind generates a `leading-h1`
// class from the --leading-h1 theme token, and the only elements on the site
// that ever carried such a class were the harness's own probes. Every real
// heading reads `line-height: var(--leading-h1)` from styles.css instead. So
// the assertion was testing a mechanism the site does not use, and deleting
// the harness is what made that visible. It is replaced below by "the leading
// tokens reach the elements that ship", which measures the resolved ratio on
// the five real elements that consume the five tokens, and which fails for the
// thing the old comment was actually worried about: a heading silently
// inheriting 1.6.
// ---------------------------------------------------------------------------

const TOKENS = {
  paper: 'oklch(0.97 0.008 85)',
  ink: 'oklch(0.22 0.02 265)',
  ultramarine: 'oklch(0.52 0.19 264)',
  'ultramarine-deep': 'oklch(0.34 0.15 264)',
  rule: 'oklch(0.88 0.01 85)',
  'rule-strong': 'oklch(0.62 0.012 85)',
  'rule-on-color': 'oklch(0.82 0.05 264)',
  'signal-on-color': 'oklch(0.85 0.13 70)',
} as const

const LEADING = {
  '--leading-display': 0.95,
  '--leading-h1': 1.05,
  '--leading-h2': 1.15,
  '--leading-body': 1.6,
  '--leading-on-color': 1.68,
} as const

// WCAG 2.2 thresholds. Body text 4.5, large text and non-text UI 3.0.
const BODY_TEXT = 4.5
const NON_TEXT = 3.0

/**
 * Where each ground is met on the site, and a real element standing on it.
 *
 * All three are on the home page, which is deliberate: measuring the tones
 * against each other requires one document, and `/` is the only page that
 * carries two of them in <main> plus the footer's third.
 *
 * The copy selectors name elements that set no line-height of their own, so
 * what they report is what the tone handed down. That is the value a section
 * which forgot to declare anything would get, which is the failure being
 * looked for.
 */
const GROUNDS = [
  { tone: 'paper', copy: '.pillar-summary', rule: TOKENS['rule-strong'] },
  {
    tone: 'ultramarine',
    copy: '.hero-subline',
    rule: TOKENS['rule-on-color'],
  },
  {
    tone: 'ultramarine-deep',
    copy: '.footer-address',
    rule: TOKENS['rule-on-color'],
  },
] as const

/** Every prerendered page, for the assertions that discover rather than name. */
const PAGES = [
  '/',
  '/about',
  '/contact',
  '/writing',
  '/work/coachess',
  '/work/helmdeck',
  '/work/volt-tunisia',
] as const

declare global {
  interface Window {
    // Resolves any CSS colour — including the oklch() that getComputedStyle
    // hands back for these tokens — to sRGB, by painting one pixel and reading
    // it back. Chromium's canvas serialises fillStyle in the colour space it
    // was given, so the readback is the only route to component values.
    srgb: (color: string) => [number, number, number]
    contrast: (a: string, b: string) => number
  }
}

const installProbes = (page: Page) =>
  page.addInitScript(() => {
    window.srgb = (color) => {
      // Unparseable input leaves fillStyle at its previous value, which would
      // silently measure the wrong colour rather than fail. Reject it here.
      if (!CSS.supports('color', color)) {
        throw new Error(`not a colour: ${JSON.stringify(color)}`)
      }
      const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r / 255, g / 255, b / 255]
    }

    // WCAG 2.2 relative luminance, same formula scripts/contrast.mjs applies to
    // the token literals. Re-implemented here rather than imported because that
    // script is an executable gate with no exports, and because this side has a
    // different job: the script proves the numbers in DESIGN.md, this proves the
    // numbers the browser actually painted.
    window.contrast = (first, second) => {
      const lum = (color: string) => {
        const channels = window.srgb(color)
        const lin = (v: number) =>
          v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        const [r, g, bl] = channels.map(lin)
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl
      }
      const x = lum(first)
      const y = lum(second)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
  })

const visit = async (page: Page, path: string) => {
  await page.goto(path)
  // The home page runs a staggered reveal on the hero, and every page restores
  // scroll when React commits. Both move geometry under a measurement taken
  // too early. See `hydrated` in support/probes.
  await hydrated(page)
}

test.beforeEach(async ({ page }) => {
  await installProbes(page)
})

const styleOf = (locator: Locator, props: Array<string>) =>
  locator.evaluate((el, names: Array<string>) => {
    const s = getComputedStyle(el)
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]))
  }, props)

/** The first band of a given tone on whatever page is loaded. */
const field = (page: Page, tone: string) =>
  page.locator(`[data-tone="${tone}"]`).first()

// Walks focus with the keyboard rather than calling .focus(). :focus-visible is
// a heuristic on input modality, so a programmatic focus on a link does not
// necessarily match it, and a ring test that never engaged the selector would
// pass against a completely broken ring.
//
// Takes a CSS selector rather than a test id, because the elements it has to
// reach on the real pages are links inside composed sections and most of them
// carry no test id of their own.
async function tabTo(page: Page, selector: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const reached = await page.evaluate(
      (css) => document.activeElement?.matches(css) ?? false,
      selector,
    )
    if (reached) return
  }
  throw new Error(`never reached ${selector} by tabbing`)
}

// ---------------------------------------------------------------------------
// The grid used to paint eleven hairlines per band and three tests here pinned
// them: that they were drawn, that they sat behind the content, and that each
// one landed on a real track edge at each breakpoint. The drawn rules are gone
// — they read as a debug overlay across the headlines and tables they crossed,
// and the approved direction has no visible grid — so those three assertions
// were re-examined one at a time rather than deleted together.
//
//   "draws its gutters as real, painted hairlines"  DELETED. Every clause of it
//   was about elements that no longer exist. There is no weaker version of
//   "eleven painted lines" that is still true.
//
//   "draws every rule on a real column boundary, at every breakpoint" DELETED.
//   Its surviving half — that the grid resolves to 3, 6 and 12 columns at the
//   three tiers — is not lost: tests/e2e/responsive.spec.ts asserts exactly
//   that, from the browser's own resolved track list, at 375, 768 and 1280. The
//   half that is gone is the correspondence between a painted line and a track
//   edge, which had nothing left to correspond to.
//
//   "draws its rules behind the content, never over it"  RE-POINTED, below. The
//   overlay it guarded is deleted, so the test would now pass vacuously; what
//   it was really protecting is that nothing the grid renders can intercept a
//   click meant for the content. Turned into the assertion that the grid
//   renders no painting layer at all, which fails the moment somebody puts one
//   back, and which keeps the click-through check that caught the original bug.
// ---------------------------------------------------------------------------

test.describe('grid', () => {
  test('is geometry only, and paints nothing over the content', async ({
    page,
  }) => {
    // Measured on the case study hero, which is a link on a coloured band, so
    // it is both the drenched half of the site and a real navigation.
    await visit(page, '/work/coachess')

    const grid = field(page, 'ultramarine').getByTestId('grid')
    await expect(grid).toBeVisible()

    // The grid contributes no element of its own: every child of it is content
    // a route put there. An absolutely positioned decoration layer is what this
    // catches, and it is the shape the deleted hairlines had.
    const painted = await grid.evaluate((el) =>
      [...el.querySelectorAll('*')]
        .filter((node) => {
          const s = getComputedStyle(node)
          return (
            s.position === 'absolute' &&
            (node.getAttribute('aria-hidden') === 'true' ||
              node.closest('[aria-hidden="true"]') !== null)
          )
        })
        // The two clipped, visually hidden elements are absolutely positioned
        // on purpose and are not decoration: the table's accessible name and
        // the spam trap. Neither is aria-hidden, so neither reaches here, but
        // the filter is named so a reader does not have to work that out.
        .filter((node) => !node.closest('.spec-caption, .honeypot'))
        .map((node) => `${node.tagName.toLowerCase()}.${node.className}`),
    )

    expect(
      painted,
      'the grid renders an absolutely positioned decoration layer again. The ' +
        'drawn hairlines were removed because they crossed the content; a ' +
        'replacement that sits over it has the same defect',
    ).toEqual([])

    const link = page.getByRole('link', { name: 'All work' })
    await expect(link).toBeVisible()

    // Playwright refuses to click through an intercepting element and names it,
    // so the failure here reads "<div class=...> intercepts pointer events"
    // rather than something about the link.
    await link.click({ timeout: 5000 })
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('section field', () => {
  test('renders every tone, full bleed, on its own ground', async ({
    page,
  }) => {
    await visit(page, '/')

    const viewport = await page.evaluate(
      () => document.documentElement.clientWidth,
    )

    for (const ground of GROUNDS) {
      // Unscoped, unlike the harness version, which scoped to <main> so the
      // footer would not double the ultramarine-deep match. The footer IS the
      // ultramarine-deep band now, so it has to be in scope, and `.first()`
      // handles the two paper and two ultramarine bands on this page.
      const band = field(page, ground.tone)
      await expect(
        band,
        `no field rendered for tone ${ground.tone}`,
      ).toBeVisible()

      const style = await styleOf(band, ['background-color'])
      expect(
        style['background-color'],
        `${ground.tone} is not on its own ground`,
      ).toBe(TOKENS[ground.tone])

      const box = (await band.boundingBox())!
      expect(box.width, `${ground.tone} is not full bleed`).toBeCloseTo(
        viewport,
        0,
      )
    }
  })

  test('sets paper text on a coloured ground, not the inherited ink', async ({
    page,
  }) => {
    await visit(page, '/')

    for (const tone of ['ultramarine', 'ultramarine-deep'] as const) {
      const ground = GROUNDS.find((g) => g.tone === tone)!
      const band = field(page, tone)
      const copy = band.locator(ground.copy).first()

      const style = await styleOf(copy, ['color'])
      const background = (await styleOf(band, ['background-color']))[
        'background-color'
      ]

      expect(
        style.color,
        `body copy on the ${tone} field is still the ink inherited from body. ` +
          `Ink on ultramarine measures 3.02 and fails body text. The tone must ` +
          `set its text colour explicitly (DESIGN.md, Inheritance hazard)`,
      ).not.toBe(TOKENS.ink)
      expect(style.color).toBe(TOKENS.paper)

      // Re-measured rather than inferred from the token name, so swapping in
      // any other light-looking colour still has to clear the threshold.
      const ratio = await page.evaluate(
        ([fg, bg]) => window.contrast(fg, bg),
        [style.color, background],
      )
      expect(
        ratio,
        `text on ${tone} measures ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(BODY_TEXT)
    }
  })

  test('gives coloured grounds the on-colour leading', async ({ page }) => {
    await visit(page, '/')

    const ratio = async (tone: string, selector: string) => {
      const copy = field(page, tone).locator(selector).first()
      const s = await styleOf(copy, ['line-height', 'font-size'])
      return parseFloat(s['line-height']) / parseFloat(s['font-size'])
    }

    expect(
      await ratio('paper', '.pillar-summary'),
      'reading copy on paper should use --leading-body',
    ).toBeCloseTo(LEADING['--leading-body'], 2)

    // Light type on colour reads lighter and needs more air. DESIGN.md sets
    // 1.68 there against 1.6 on paper; inheriting the body value is the silent
    // failure this catches. None of the three selectors sets a line-height of
    // its own, so each reports what its tone handed down.
    for (const ground of GROUNDS.filter((g) => g.tone !== 'paper')) {
      expect(
        await ratio(ground.tone, ground.copy),
        `${ground.tone} copy is not using --leading-on-color`,
      ).toBeCloseTo(LEADING['--leading-on-color'], 2)
    }
  })

  // DELETED: "draws its grid rules in the on-colour rule token". It read the
  // background of a .grid-rule on each of the three grounds, and there are no
  // .grid-rules. The claim underneath it — that a border on a clay ground
  // resolves to the token measured against that ground rather than to the paper
  // one — is not lost with it. It is the same --field-rule-strong property, and
  // it is still measured on both grounds by tests/e2e/spec-table.spec.ts
  // ("every table on every page draws dividers that clear 3.0 on their own
  // ground") and tests/e2e/placeholder.spec.ts, on elements that ship.
  test('gives every structural border on a coloured ground a measured value', async ({
    page,
  }) => {
    // The narrower replacement, kept here because this file is the pinned
    // record for SectionField and the property is SectionField's. It asserts
    // the declaration exists per tone, which is the edit a fourth tone copying
    // one block and not the other would miss.
    await visit(page, '/')

    for (const ground of GROUNDS) {
      const resolved = (
        await styleOf(field(page, ground.tone), ['--field-rule-strong'])
      )['--field-rule-strong'].trim()

      expect(
        resolved,
        `the ${ground.tone} field does not declare --field-rule-strong, so ` +
          `every border inside it falls back to whatever an ancestor last set`,
      ).toBe(ground.rule)
    }

    const ratio = await page.evaluate(
      ([fg, bg]) => window.contrast(fg, bg),
      [TOKENS['rule-on-color'], TOKENS.ultramarine],
    )
    expect(ratio).toBeGreaterThanOrEqual(NON_TEXT)
  })
})

test.describe('focus ring', () => {
  test('inverts to paper inside an ultramarine field, and stays visible', async ({
    page,
  }) => {
    await visit(page, '/')

    const band = field(page, 'ultramarine')
    const background = (await styleOf(band, ['background-color']))[
      'background-color'
    ]

    // The hero actions are the first two stops on the page and both sit on the
    // drenched opening band, so this reaches a coloured ground in one Tab.
    await tabTo(page, '.hero-actions a')

    const focused = await page.evaluate(() => {
      const el = document.activeElement!
      const s = getComputedStyle(el)
      return {
        visible: el.matches(':focus-visible'),
        color: s.outlineColor,
        style: s.outlineStyle,
        width: s.outlineWidth,
        onColour: el.closest('[data-tone]')?.getAttribute('data-tone') ?? null,
      }
    })

    expect(
      focused.onColour,
      'the element this test tabbed to is no longer inside an ultramarine ' +
        'band, so the inversion it measures is not the one under test',
    ).toBe('ultramarine')
    expect(
      focused.visible,
      'the element took focus but :focus-visible did not engage, so this test ' +
        'was measuring an outline the user would never see',
    ).toBe(true)
    expect(focused.style).toBe('solid')
    expect(parseFloat(focused.width)).toBeGreaterThan(0)

    // The whole point. An ultramarine ring on an ultramarine field is 1.00:1 —
    // present in the computed style, invisible on screen.
    expect(
      focused.color,
      'the focus ring is the same colour as the field it sits on, so keyboard ' +
        'focus is invisible here. It must invert to --color-paper on coloured ' +
        'grounds (DESIGN.md, Every role needs two values)',
    ).not.toBe(background)
    expect(focused.color).toBe(TOKENS.paper)

    const ratio = await page.evaluate(
      ([fg, bg]) => window.contrast(fg, bg),
      [focused.color, background],
    )
    expect(
      ratio,
      `the focus ring measures ${ratio.toFixed(2)} against its own field`,
    ).toBeGreaterThanOrEqual(NON_TEXT)
  })

  test('stays ultramarine on paper', async ({ page }) => {
    // The inversion must be scoped, not global: inverting everywhere would make
    // the ring paper-on-paper at 1.06 and move the bug rather than fix it.
    await visit(page, '/')

    await tabTo(page, '[data-testid="pillar-link"]')

    const focused = await page.evaluate(() => ({
      color: getComputedStyle(document.activeElement!).outlineColor,
      onColour:
        document.activeElement
          ?.closest('[data-tone]')
          ?.getAttribute('data-tone') ?? null,
    }))

    expect(
      focused.onColour,
      'the case study index is no longer on a paper band, so this measures ' +
        'the wrong half of the inversion',
    ).toBe('paper')
    expect(focused.color).toBe(TOKENS.ultramarine)
  })

  test('every field on every page keeps its text and its ring legible', async ({
    page,
  }) => {
    // Deliberately generic. The named tests above pin the three tones we ship
    // today on the page that carries all three; this one discovers whatever is
    // on each page, so a fourth tone added later is covered the moment it is
    // rendered rather than the moment somebody remembers to extend a list.
    //
    // Run across every prerendered page rather than one, which the harness
    // could not do: a tone is only ever wrong in the composition it appears in,
    // and a utility class applied on one page is exactly the failure below.
    let fields = 0

    for (const path of PAGES) {
      await visit(page, path)

      const measured = await page.evaluate(() => {
        const bands = [
          ...document.querySelectorAll('[data-testid^="section-field-"]'),
        ]
        return bands.map((el) => {
          const s = getComputedStyle(el)
          const bg = s.backgroundColor
          const ring = s.getPropertyValue('--focus-ring').trim()

          // Every element that actually renders text, not just the field
          // itself. The tone sets its colour in the components layer, and a
          // utility class sits in the layer above it: one `text-ink` on a
          // paragraph inside a drenched section wins the cascade and puts
          // 3.02:1 back on the page with the field's own computed colour still
          // reading as correct.
          //
          // Nothing inside a field paints its own background, so the field's
          // ground is the ground for all of them.
          const worst = [...el.querySelectorAll('*')]
            .filter((node) =>
              [...node.childNodes].some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              ),
            )
            .map((node) => ({
              tag: node.tagName.toLowerCase(),
              color: getComputedStyle(node).color,
              ratio: window.contrast(getComputedStyle(node).color, bg),
            }))
            .sort((a, b) => a.ratio - b.ratio)[0]

          return {
            name: el.getAttribute('data-testid')!,
            ring,
            text: window.contrast(s.color, bg),
            worst,
            focus: ring ? window.contrast(ring, bg) : null,
          }
        })
      })

      expect(
        measured.length,
        `no section fields found on ${path}`,
      ).toBeGreaterThan(0)
      fields += measured.length

      for (const band of measured) {
        const where = `${path} ${band.name}`

        expect(
          band.text,
          `${where}: text measures ${band.text.toFixed(2)} against its own ground`,
        ).toBeGreaterThanOrEqual(BODY_TEXT)
        expect(
          band.worst,
          `${where}: renders no text at all, so it proves nothing here`,
        ).toBeTruthy()
        expect(
          band.worst.ratio,
          `${where}: its <${band.worst.tag}> renders ${band.worst.color} at ` +
            `${band.worst.ratio.toFixed(2)} against the field's ground`,
        ).toBeGreaterThanOrEqual(BODY_TEXT)
        expect(
          band.ring,
          `${where}: --focus-ring is not set, so the ring falls back to ` +
            `whatever an ancestor last declared`,
        ).not.toBe('')
        expect(
          band.focus,
          `${where}: the focus ring measures ${band.focus?.toFixed(2)} against ` +
            `its own ground`,
        ).toBeGreaterThanOrEqual(NON_TEXT)
      }
    }

    // The harness rendered three fields and this walked all three. Across the
    // real site it should be walking substantially more; a number this low
    // means the selector stopped matching and every loop above ran empty.
    expect(
      fields,
      'far fewer section fields were measured than the site renders, so the ' +
        'discovery selector has stopped matching',
    ).toBeGreaterThanOrEqual(PAGES.length * 2)
  })
})

test.describe('the tokens these primitives depend on', () => {
  test('reach the browser as custom properties', async ({ page }) => {
    await visit(page, '/')

    const expected: Record<string, string> = {
      '--color-rule-on-color': TOKENS['rule-on-color'],
      '--color-signal-on-color': TOKENS['signal-on-color'],
      ...Object.fromEntries(
        Object.entries(LEADING).map(([k, v]) => [k, String(v)]),
      ),
    }

    const actual = await page.evaluate((names) => {
      const s = getComputedStyle(document.documentElement)
      return Object.fromEntries(
        names.map((n) => [n, s.getPropertyValue(n).trim()]),
      )
    }, Object.keys(expected))

    for (const [name, value] of Object.entries(expected)) {
      expect(
        actual[name],
        `${name} is missing from the @theme block in styles.css`,
      ).toBe(value)
    }
  })

  test('reach the elements that ship, as resolved leading', async ({
    page,
  }) => {
    // The replacement for the harness's `leading-*` utility test, and a
    // different assertion rather than the same one moved.
    //
    // That test proved Tailwind generates a utility from the --leading-*
    // namespace. Nothing on this site uses those utilities: every real element
    // reads `line-height: var(--leading-h1)` and friends from styles.css, so
    // the utilities could stop being generated tomorrow and no page would
    // change. What matters is that each token resolves on the element that
    // consumes it, because the failure the old comment described is real and
    // is reached the other way: a declaration deleted from styles.css leaves
    // the heading inheriting 1.6, which at --text-display is a 12rem line box.
    //
    // One element per token, and each is the only place that token is used at
    // this size on the site.
    const CONSUMERS = [
      { path: '/', selector: '.hero-display', token: '--leading-display' },
      {
        path: '/work/coachess',
        selector: '.case-title',
        token: '--leading-h1',
      },
      { path: '/', selector: '.section-heading', token: '--leading-h2' },
      { path: '/work/coachess', selector: '.prose p', token: '--leading-body' },
      { path: '/', selector: '.capability-body', token: '--leading-on-color' },
    ] as const

    for (const consumer of CONSUMERS) {
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
          `line-height declaration inherits 1.6, which at --text-display is a ` +
          `12rem line box`,
      ).toBeCloseTo(LEADING[consumer.token], 2)
    }
  })
})
