import { expect, test } from '@playwright/test'
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
// Scratch-route caveat: these tests drive /dev/primitives, which is a
// deliberately plain harness and is removed before deploy. When it goes, the
// tone and focus-ring assertions must be re-pointed at the real sections that
// replace it, or the invariant stops being covered on the pages that ship.

const TOKENS = {
  paper: 'oklch(0.97 0.008 85)',
  ink: 'oklch(0.22 0.02 265)',
  ultramarine: 'oklch(0.52 0.19 264)',
  'ultramarine-deep': 'oklch(0.34 0.15 264)',
  rule: 'oklch(0.88 0.01 85)',
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

test.beforeEach(async ({ page }) => {
  await installProbes(page)
})

const styleOf = (locator: Locator, props: Array<string>) =>
  locator.evaluate((el, names: Array<string>) => {
    const s = getComputedStyle(el)
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]))
  }, props)

// Walks focus with the keyboard rather than calling .focus(). :focus-visible is
// a heuristic on input modality, so a programmatic focus on a link does not
// necessarily match it, and a ring test that never engaged the selector would
// pass against a completely broken ring.
async function tabTo(page: Page, testId: string) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    const reached = await page.evaluate(
      (id) => document.activeElement?.getAttribute('data-testid') === id,
      testId,
    )
    if (reached) return
  }
  throw new Error(`never reached [data-testid="${testId}"] by tabbing`)
}

test.describe('grid', () => {
  test('draws its gutters as real, painted hairlines', async ({ page }) => {
    await page.goto('/dev/primitives')

    const grid = page.getByTestId('section-field-paper').getByTestId('grid')
    const rules = grid.getByTestId('grid-rule')

    // Auto-retrying, so it also absorbs the reload the dev server triggers the
    // first time it optimises a newly imported dependency. Everything after
    // this point reads the DOM in one shot and would race that reload.
    await expect(rules.first()).toBeVisible()

    // Twelve columns have eleven interior gutters. This is the count at a
    // desktop viewport; the breakpoint ladder is the next test's job.
    const drawn = await rules.evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).display !== 'none'),
    )
    expect(drawn, 'no grid rules are displayed at all').toHaveLength(11)

    const gridBox = (await grid.boundingBox())!

    for (let i = 0; i < 11; i++) {
      const rule = rules.nth(i)
      const box = (await rule.boundingBox())!
      const style = await styleOf(rule, [
        'background-color',
        'visibility',
        'opacity',
      ])

      // A hairline with no width, no height or no colour is not a drawn rule,
      // and every one of those is a live failure mode: `inset: 0` on a static
      // parent, a collapsed grid row, a background token that does not exist.
      expect(box.width, `rule ${i} has no width`).toBeGreaterThan(0)
      expect(box.width, `rule ${i} is not a hairline`).toBeLessThanOrEqual(2)
      expect(box.height, `rule ${i} does not span the grid`).toBeCloseTo(
        gridBox.height,
        0,
      )
      expect(style['background-color'], `rule ${i} is not painted`).toBe(
        TOKENS.rule,
      )
      expect(style.visibility).toBe('visible')
      expect(Number(style.opacity)).toBeGreaterThan(0)
    }

    // Decoration, so it must not reach the accessibility tree.
    const hidden = await rules.evaluateAll((els) =>
      els.every((el) => el.closest('[aria-hidden="true"]') !== null),
    )
    expect(hidden, 'grid rules are exposed to assistive technology').toBe(true)
  })

  test('draws its rules behind the content, never over it', async ({
    page,
  }) => {
    // The rules are an absolutely positioned overlay, and an absolutely
    // positioned element paints above its in-flow siblings by default. Left
    // alone it covers the whole grid: hairlines drawn across the text, and
    // every link in the section swallowing its own clicks. Nothing about that
    // looks wrong in a screenshot of a section with no links in it.
    await page.goto('/dev/primitives')

    const link = page.getByTestId('field-link-ultramarine')
    await expect(link).toBeVisible()

    // Playwright refuses to click through an intercepting element and names it,
    // so the failure here reads "<div class=grid-rule> intercepts pointer
    // events" rather than something about the link.
    await link.click({ timeout: 5000 })
    expect(new URL(page.url()).hash).toBe('#ultramarine')
  })

  test('draws every rule on a real column boundary, at every breakpoint', async ({
    page,
  }) => {
    // The rules are positioned by React and the column count comes from a media
    // query, so the two can drift apart with nothing failing to render. The
    // expected positions below are derived from the browser's own resolved
    // track sizes, never from the component's formula, so a rule that no longer
    // sits on a track edge is caught rather than mirrored.
    const LADDER = [
      { width: 400, columns: 3 },
      { width: 900, columns: 6 },
      { width: 1280, columns: 12 },
    ]

    for (const { width, columns } of LADDER) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/dev/primitives')

      const grid = page.getByTestId('section-field-paper').getByTestId('grid')

      const measured = await grid.evaluate((el) => {
        const tracks = getComputedStyle(el)
          .gridTemplateColumns.split(' ')
          .map(parseFloat)
        const left = el.getBoundingClientRect().left
        return {
          tracks,
          rules: [...el.querySelectorAll('[data-testid="grid-rule"]')]
            .filter((r) => getComputedStyle(r).display !== 'none')
            .map((r) => r.getBoundingClientRect().left - left),
        }
      })

      expect(
        measured.tracks,
        `at ${width}px the grid does not have ${columns} columns`,
      ).toHaveLength(columns)

      // Cumulative track widths are the actual gutter positions.
      const boundaries = measured.tracks
        .slice(0, -1)
        .map((_, i) =>
          measured.tracks.slice(0, i + 1).reduce((a, b) => a + b, 0),
        )

      expect(
        measured.rules,
        `at ${width}px a ${columns}-column grid should draw ` +
          `${columns - 1} rules, not ${measured.rules.length}`,
      ).toHaveLength(boundaries.length)

      for (const [i, expected] of boundaries.entries()) {
        expect(
          measured.rules[i],
          `at ${width}px rule ${i} is not on a column boundary`,
        ).toBeCloseTo(expected, 0)
      }
    }
  })
})

test.describe('section field', () => {
  const TONES = ['paper', 'ultramarine', 'ultramarine-deep'] as const

  test('renders every tone, full bleed, on its own ground', async ({
    page,
  }) => {
    await page.goto('/dev/primitives')

    const viewport = await page.evaluate(
      () => document.documentElement.clientWidth,
    )

    for (const tone of TONES) {
      const field = page.getByTestId(`section-field-${tone}`)
      await expect(field, `no field rendered for tone ${tone}`).toBeVisible()

      const style = await styleOf(field, ['background-color'])
      expect(
        style['background-color'],
        `${tone} is not on its own ground`,
      ).toBe(TOKENS[tone])

      const box = (await field.boundingBox())!
      expect(box.width, `${tone} is not full bleed`).toBeCloseTo(viewport, 0)
    }
  })

  test('sets paper text on an ultramarine ground, not the inherited ink', async ({
    page,
  }) => {
    await page.goto('/dev/primitives')

    const field = page.getByTestId('section-field-ultramarine')
    const copy = field.getByTestId('field-copy')

    const style = await styleOf(copy, ['color'])
    const background = (await styleOf(field, ['background-color']))[
      'background-color'
    ]

    expect(
      style.color,
      'body copy on the ultramarine field is still the ink inherited from ' +
        'body. Ink on ultramarine measures 3.02 and fails body text. The tone ' +
        'must set its text colour explicitly (DESIGN.md, Inheritance hazard)',
    ).not.toBe(TOKENS.ink)
    expect(style.color).toBe(TOKENS.paper)

    // Re-measured rather than inferred from the token name, so swapping in any
    // other light-looking colour still has to clear the threshold.
    const ratio = await page.evaluate(
      ([fg, bg]) => window.contrast(fg, bg),
      [style.color, background],
    )
    expect(
      ratio,
      `text on ultramarine measures ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(BODY_TEXT)
  })

  test('gives coloured grounds the on-colour leading', async ({ page }) => {
    await page.goto('/dev/primitives')

    const ratio = async (tone: string) => {
      const copy = page
        .getByTestId(`section-field-${tone}`)
        .getByTestId('field-copy')
      const s = await styleOf(copy, ['line-height', 'font-size'])
      return parseFloat(s['line-height']) / parseFloat(s['font-size'])
    }

    expect(
      await ratio('paper'),
      'reading copy on paper should use --leading-body',
    ).toBeCloseTo(LEADING['--leading-body'], 2)

    // Light type on colour reads lighter and needs more air. DESIGN.md sets
    // 1.68 there against 1.6 on paper; inheriting the body value is the silent
    // failure this catches.
    for (const tone of ['ultramarine', 'ultramarine-deep']) {
      expect(
        await ratio(tone),
        `${tone} copy is not using --leading-on-color`,
      ).toBeCloseTo(LEADING['--leading-on-color'], 2)
    }
  })

  test('draws its grid rules in the on-colour rule token', async ({ page }) => {
    await page.goto('/dev/primitives')

    const ruleOn = async (tone: string) =>
      (
        await styleOf(
          page
            .getByTestId(`section-field-${tone}`)
            .getByTestId('grid-rule')
            .first(),
          ['background-color'],
        )
      )['background-color']

    expect(await ruleOn('paper')).toBe(TOKENS.rule)

    // --color-rule-strong measures 1.57 on ultramarine and --color-rule is not
    // measured against it at all. Only --color-rule-on-color is.
    for (const tone of ['ultramarine', 'ultramarine-deep']) {
      expect(
        await ruleOn(tone),
        `grid rules on ${tone} are not using --color-rule-on-color`,
      ).toBe(TOKENS['rule-on-color'])
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
    await page.goto('/dev/primitives')

    const field = page.getByTestId('section-field-ultramarine')
    const background = (await styleOf(field, ['background-color']))[
      'background-color'
    ]

    await tabTo(page, 'field-link-ultramarine')

    const focused = await page.evaluate(() => {
      const el = document.activeElement!
      const s = getComputedStyle(el)
      return {
        visible: el.matches(':focus-visible'),
        color: s.outlineColor,
        style: s.outlineStyle,
        width: s.outlineWidth,
      }
    })

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
    await page.goto('/dev/primitives')

    await tabTo(page, 'field-link-paper')

    const color = await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineColor,
    )
    expect(color).toBe(TOKENS.ultramarine)
  })

  test('every field on the page keeps its text and its ring legible', async ({
    page,
  }) => {
    // Deliberately generic. The named tests above pin the three tones we ship
    // today; this one discovers whatever is on the page, so a fourth tone added
    // later is covered the moment it is rendered rather than the moment
    // somebody remembers to extend a list.
    await page.goto('/dev/primitives')

    const measured = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll('[data-testid^="section-field-"]'),
      ]
      return fields.map((el) => {
        const s = getComputedStyle(el)
        const bg = s.backgroundColor
        const ring = s.getPropertyValue('--focus-ring').trim()

        // Every element that actually renders text, not just the field itself.
        // The tone sets its colour in the components layer, and a utility class
        // sits in the layer above it: one `text-ink` on a paragraph inside a
        // drenched section wins the cascade and puts 3.02:1 back on the page
        // with the field's own computed colour still reading as correct.
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
      'no section fields found on the page',
    ).toBeGreaterThan(0)

    for (const field of measured) {
      expect(
        field.text,
        `${field.name}: text measures ${field.text.toFixed(2)} against its own ground`,
      ).toBeGreaterThanOrEqual(BODY_TEXT)
      expect(
        field.worst,
        `${field.name}: renders no text at all, so it proves nothing here`,
      ).toBeTruthy()
      expect(
        field.worst.ratio,
        `${field.name}: its <${field.worst.tag}> renders ${field.worst.color} ` +
          `at ${field.worst.ratio.toFixed(2)} against the field's ground`,
      ).toBeGreaterThanOrEqual(BODY_TEXT)
      expect(
        field.ring,
        `${field.name}: --focus-ring is not set, so the ring falls back to ` +
          `whatever an ancestor last declared`,
      ).not.toBe('')
      expect(
        field.focus,
        `${field.name}: the focus ring measures ${field.focus?.toFixed(2)} ` +
          `against its own ground`,
      ).toBeGreaterThanOrEqual(NON_TEXT)
    }
  })
})

test.describe('the tokens these primitives depend on', () => {
  test('reach the browser as custom properties', async ({ page }) => {
    await page.goto('/dev/primitives')

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

  test('generate leading-* utilities', async ({ page }) => {
    // --leading-* is a real Tailwind 4 theme namespace, so declaring the token
    // is enough to get the utility. Verified here rather than assumed: if the
    // namespace were wrong the class would compile to nothing and every heading
    // would quietly inherit 1.6, which at --text-display is a 12rem line box.
    await page.goto('/dev/primitives')

    for (const [token, value] of Object.entries(LEADING)) {
      const name = token.replace('--leading-', '')
      const probe = page.getByTestId(`leading-${name}`)
      const s = await styleOf(probe, ['line-height', 'font-size'])

      expect(
        parseFloat(s['line-height']) / parseFloat(s['font-size']),
        `the leading-${name} utility did not apply ${token}`,
      ).toBeCloseTo(value, 2)
    }
  })
})
