import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { NON_TEXT, TOKENS, installProbes, styleOf } from './support/probes'

// The placeholder, pinned against a real browser.
//
// PRODUCT.md, Standing Rules: where an asset has not been supplied, ship a
// labelled placeholder that is obviously a placeholder, never invent content,
// never substitute stock imagery. Three case study covers are referenced by
// content/work/*.mdx and none of the files exist, so this component is what
// stands in the layout until they do.
//
// Two failure modes drive this file, and both ship green without it. A
// placeholder that is silent to assistive technology tells a screen reader
// user nothing is there rather than that something is missing. A placeholder
// with no reserved height collapses to nothing, so the page reflows the day
// the real asset lands, which is exactly the day nobody is looking at the
// layout.

// The harness fixtures, restated rather than imported: a test that reads its
// expectations from the module the page renders cannot fail when both are
// wrong together. The two differ in label and in ratio, which is what stops a
// component that ignores its props from passing.
const FIXTURES = {
  paper: { label: 'headshot', ratio: 16 / 9 },
  ultramarine: { label: 'coachess cover', ratio: 1 },
} as const

const placeholderIn = (page: Page, tone: keyof typeof FIXTURES) =>
  page.getByTestId(`section-field-${tone}`).getByTestId('placeholder')

test.beforeEach(async ({ page }) => {
  await installProbes(page)
  await page.goto('/dev/primitives')
})

test('is announced as an image that names what is missing', async ({
  page,
}) => {
  for (const [tone, fixture] of Object.entries(FIXTURES)) {
    const block = page.getByTestId(`section-field-${tone}`).getByRole('img', {
      name: `Placeholder: ${fixture.label}. Asset not supplied.`,
    })

    await expect(
      block,
      `nothing on the ${tone} ground exposes role="img" with an accessible ` +
        `name naming "${fixture.label}". An unlabelled block tells a screen ` +
        `reader user that nothing is there, not that something is missing`,
    ).toHaveCount(1)
  }
})

test('prints what is missing as visible text as well', async ({ page }) => {
  // The accessible name alone is not enough: PRODUCT.md requires that a
  // sighted reviewer cannot mistake the block for finished content either.
  for (const [tone, fixture] of Object.entries(FIXTURES)) {
    const block = placeholderIn(page, tone as keyof typeof FIXTURES)

    await expect(
      block,
      `the ${tone} placeholder does not say so on its face`,
    ).toContainText(`PLACEHOLDER: ${fixture.label}`)
  }
})

test('reserves its space from its ratio, before any asset exists', async ({
  page,
}) => {
  for (const [tone, fixture] of Object.entries(FIXTURES)) {
    const block = placeholderIn(page, tone as keyof typeof FIXTURES)
    await expect(block).toBeVisible()

    await expect(
      block.locator('img'),
      'the placeholder loaded an image, so this test is measuring the asset ' +
        'rather than the space reserved for it',
    ).toHaveCount(0)

    const box = (await block.boundingBox())!

    expect(
      box.height,
      `the ${tone} placeholder has collapsed to zero height, so the page will ` +
        `reflow on the day the real asset lands`,
    ).toBeGreaterThan(0)

    expect(
      box.width / box.height,
      `the ${tone} placeholder reserves ${box.width.toFixed(0)}x` +
        `${box.height.toFixed(0)}, which is not the ${fixture.ratio.toFixed(3)} ` +
        `ratio it was given. A block that reserves the wrong shape shifts the ` +
        `layout just as surely as one that reserves nothing`,
    ).toBeCloseTo(fixture.ratio, 2)
  }
})

test('sets its caption in Martian Mono', async ({ page }) => {
  // DESIGN.md: Martian Mono strictly for data and captions of this kind, and
  // the mono is half of what makes the block read as provisional rather than
  // as an intentionally empty panel.
  const caption = placeholderIn(page, 'paper').getByTestId(
    'placeholder-caption',
  )

  const family = (await styleOf(caption, ['font-family']))['font-family']
  expect(
    family,
    'the placeholder caption is not set in Martian Mono',
  ).toContain('Martian Mono')
  expect(
    family,
    'the placeholder caption falls back to Archivo, so it reads as copy ' +
      'rather than as a note about a missing asset',
  ).not.toContain('Archivo')
})

test('draws its border in the structural rule token for the ground it is on', async ({
  page,
}) => {
  const borderOn = async (tone: keyof typeof FIXTURES) =>
    await styleOf(placeholderIn(page, tone), [
      'border-top-color',
      'border-top-style',
      'border-top-width',
    ])

  const paper = await borderOn('paper')
  expect(
    paper['border-top-color'],
    '--color-rule measures 1.32 on paper and is decorative only. The ruled ' +
      'border is the placeholder, so it must be --color-rule-strong',
  ).not.toBe(TOKENS.rule)
  expect(
    paper['border-top-color'],
    'the placeholder border on paper must be --color-rule-strong',
  ).toBe(TOKENS['rule-strong'])
  expect(
    paper['border-top-style'],
    'the placeholder border has a colour but no style, so no edge is drawn',
  ).toBe('solid')
  expect(
    parseFloat(paper['border-top-width']),
    'the placeholder border has a colour but no width, so no edge is drawn',
  ).toBeGreaterThan(0)

  const onColor = await borderOn('ultramarine')
  expect(
    onColor['border-top-color'],
    '--color-rule-strong measures 1.57 on ultramarine, so a placeholder that ' +
      'kept its paper border has no visible edge on a drenched section ' +
      '(DESIGN.md, Every role needs two values)',
  ).not.toBe(TOKENS['rule-strong'])
  expect(
    onColor['border-top-color'],
    'the placeholder border on ultramarine must be --color-rule-on-color',
  ).toBe(TOKENS['rule-on-color'])

  const ratio = await page.evaluate(
    ([fg, bg]) => window.contrast(fg, bg),
    [onColor['border-top-color'], TOKENS.ultramarine],
  )
  expect(
    ratio,
    `the placeholder border measures ${ratio.toFixed(2)} against its own ground`,
  ).toBeGreaterThanOrEqual(NON_TEXT)
})

test('borders all four sides, never one as a coloured stripe', async ({
  page,
}) => {
  // DESIGN.md bans side-stripe accent borders outright and says they are never
  // intentional. A ruled box that lost three of its sides is exactly that
  // banned shape, and it is one deleted declaration away.
  const sides = await styleOf(placeholderIn(page, 'paper'), [
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
  ])

  const widths = Object.values(sides).map(parseFloat)
  expect(
    new Set(widths).size,
    `the placeholder border is uneven (${widths.join(', ')}), which is the ` +
      `side-stripe accent DESIGN.md bans`,
  ).toBe(1)
  expect(
    widths[0],
    'the placeholder has no border at all, so nothing marks it as provisional',
  ).toBeGreaterThan(0)
  expect(
    widths[0],
    'the placeholder border is thicker than a rule, so it reads as an accent',
  ).toBeLessThanOrEqual(2)
})
