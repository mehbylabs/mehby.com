import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { NON_TEXT, TOKENS, installProbes, styleOf } from './support/probes'

// The placeholder, pinned against a real browser, on the pages that ship it.
//
// PRODUCT.md, Standing Rules: where an asset has not been supplied, ship a
// labelled placeholder that is obviously a placeholder, never invent content,
// never substitute stock imagery. Three case study covers are referenced by
// content/work/*.mdx and a portrait by /about, and none of the files exist, so
// this component is what stands in the layout until they do.
//
// Two failure modes drive this file, and both ship green without it. A
// placeholder that is silent to assistive technology tells a screen reader
// user nothing is there rather than that something is missing. A placeholder
// with no reserved height collapses to nothing, so the page reflows the day
// the real asset lands, which is exactly the day nobody is looking at the
// layout.
//
// This used to drive /dev/primitives, a scratch harness with two fixtures on
// two grounds. The harness is deleted, and nothing is lost: the two shipping
// placeholders sit on the two grounds the fixtures did, carry different labels
// and different ratios, and are therefore the same discriminator against a
// component that ignores its props. They are better in one respect. The
// harness ratios were 16/9 and 1, both at or above square; the real pair is
// 16/9 and 4/5, so a component that clamped its aspect ratio to a minimum of 1
// now fails where before it passed.

/**
 * Every placeholder the built site actually renders, and the ground each one
 * landed on.
 *
 * Restated here rather than imported from the route files, for the reason this
 * suite gives everywhere: a test that reads its expectations out of the module
 * the page renders from cannot fail when both are wrong together.
 *
 * `ground` is asserted, not assumed. The placeholder paints its own panel
 * ground, which is the nearest opaque ancestor of the caption, so both blocks
 * stand on `panel`; if that stops being true this file fails on the ground
 * rather than quietly measuring a border against the wrong background.
 */
const PLACEHOLDERS = [
  {
    page: '/work/coachess',
    label: 'CoaChess cover',
    ratio: 16 / 9,
    ground: 'panel',
    // The edge of a placeholder is what makes the block read as provisional
    // rather than as an intentionally empty panel, so it is drawn in the
    // structural token, edge-strong (3.38 on panel), and dashed: the
    // terminal's own marker for "this is not real yet".
    rule: TOKENS['edge-strong'],
    notRule: TOKENS.edge,
  },
  {
    // Was /about, which carried the headshot placeholder until a real avatar
    // replaced it. Re-pointed at a second case study rather than dropped: the
    // invariants below are about the component, and they need a second real
    // surface to stay honest about props.
    page: '/work/helmdeck',
    label: 'Helmdeck cover',
    ratio: 16 / 9,
    ground: 'panel',
    rule: TOKENS['edge-strong'],
    notRule: TOKENS.edge,
  },
] as const

/**
 * The one placeholder on the page.
 *
 * Located by its own test id rather than through a section: the cover sits on
 * the case study page and the portrait on /about, and neither page needs a
 * section-level lookup to find them.
 */
const placeholderOn = (page: Page) => page.getByTestId('placeholder')

/** The nearest ancestor that actually paints, which is the ground. */
const groundBehind = (page: Page) =>
  page.getByTestId('placeholder').evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement
    while (node) {
      const background = getComputedStyle(node).backgroundColor
      if (window.rgba(background)[3] === 1) return background
      node = node.parentElement
    }
    return 'rgba(0, 0, 0, 0)'
  })

const visit = async (page: Page, path: string) => {
  await installProbes(page)
  await page.goto(path)
}

for (const placeholder of PLACEHOLDERS) {
  test.describe(`${placeholder.page}, on ${placeholder.ground}`, () => {
    test.beforeEach(async ({ page }) => {
      await visit(page, placeholder.page)
    })

    test('stands on the ground this file measures it against', async ({
      page,
    }) => {
      // First, because every colour assertion below is a claim about a pair and
      // the other half of the pair is the background. A page reorganised so the
      // portrait lands on paper would leave those assertions comparing a border
      // token against a ground it was never chosen for, and they would fail
      // with a message about tokens rather than about the move that caused it.
      expect(
        await groundBehind(page),
        `the placeholder on ${placeholder.page} is no longer on the ` +
          `${placeholder.ground} band. Every border assertion in this describe ` +
          `block is about that pairing`,
      ).toBe(TOKENS[placeholder.ground])
    })

    test('is announced as an image that names what is missing', async ({
      page,
    }) => {
      const block = page.getByRole('img', {
        name: `Placeholder: ${placeholder.label}. Asset not supplied.`,
      })

      await expect(
        block,
        `nothing on ${placeholder.page} exposes role="img" with an accessible ` +
          `name naming "${placeholder.label}". An unlabelled block tells a ` +
          `screen reader user that nothing is there, not that something is ` +
          `missing`,
      ).toHaveCount(1)
    })

    test('prints what is missing as visible text as well', async ({ page }) => {
      // The accessible name alone is not enough: PRODUCT.md requires that a
      // sighted reviewer cannot mistake the block for finished content either.
      await expect(
        placeholderOn(page),
        `the placeholder on ${placeholder.page} does not say so on its face`,
      ).toContainText(`PLACEHOLDER: ${placeholder.label}`)
    })

    test('reserves its space from its ratio, before any asset exists', async ({
      page,
    }) => {
      const block = placeholderOn(page)
      await expect(block).toBeVisible()

      await expect(
        block.locator('img'),
        'the placeholder loaded an image, so this test is measuring the asset ' +
          'rather than the space reserved for it',
      ).toHaveCount(0)

      const box = (await block.boundingBox())!

      expect(
        box.height,
        `the placeholder on ${placeholder.page} has collapsed to zero height, ` +
          `so the page will reflow on the day the real asset lands`,
      ).toBeGreaterThan(0)

      expect(
        box.width / box.height,
        `the placeholder on ${placeholder.page} reserves ` +
          `${box.width.toFixed(0)}x${box.height.toFixed(0)}, which is not the ` +
          `${placeholder.ratio.toFixed(3)} ratio it was given. A block that ` +
          `reserves the wrong shape shifts the layout just as surely as one ` +
          `that reserves nothing`,
      ).toBeCloseTo(placeholder.ratio, 2)
    })

    test('sets its caption in Martian Mono', async ({ page }) => {
      // DESIGN.md: Martian Mono strictly for data and captions of this kind,
      // and the mono is half of what makes the block read as provisional
      // rather than as an intentionally empty panel.
      const family = (
        await styleOf(page.getByTestId('placeholder-caption'), ['font-family'])
      )['font-family']

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

    test('draws its border in the structural token, dashed, on the ground it is on', async ({
      page,
    }) => {
      const border = await styleOf(placeholderOn(page), [
        'border-top-color',
        'border-top-style',
        'border-top-width',
      ])

      expect(
        border['border-top-color'],
        `the placeholder border is the token chosen for the other role: ` +
          `${border['border-top-color']}. Structural edges are edge-strong; ` +
          `the decorative edge is never a boundary a user must perceive`,
      ).not.toBe(placeholder.notRule)
      expect(
        border['border-top-color'],
        `the placeholder border must resolve to ${placeholder.rule}`,
      ).toBe(placeholder.rule)
      expect(
        border['border-top-style'],
        'the placeholder border is not dashed, so it does not read as ' +
          'provisional, which is the whole point of the marker',
      ).toBe('dashed')
      expect(
        parseFloat(border['border-top-width']),
        'the placeholder border has a colour but no width, so no edge is drawn',
      ).toBeGreaterThan(0)

      // Re-measured against the ground actually behind it rather than inferred
      // from the token name, so swapping in any other plausible-looking colour
      // still has to clear the threshold.
      const ratio = await page.evaluate(
        ([fg, bg]) => window.contrast(fg, bg),
        [border['border-top-color'], await groundBehind(page)],
      )
      expect(
        ratio,
        `the placeholder border on ${placeholder.page} measures ` +
          `${ratio.toFixed(2)} against its own ground`,
      ).toBeGreaterThanOrEqual(NON_TEXT)
    })

    test('borders all four sides, never one as a coloured stripe', async ({
      page,
    }) => {
      // DESIGN.md bans side-stripe accent borders outright and says they are
      // never intentional. A ruled box that lost three of its sides is exactly
      // that banned shape, and it is one deleted declaration away.
      const sides = await styleOf(placeholderOn(page), [
        'border-top-width',
        'border-right-width',
        'border-bottom-width',
        'border-left-width',
      ])

      const widths = Object.values(sides).map(parseFloat)
      expect(
        new Set(widths).size,
        `the placeholder border on ${placeholder.page} is uneven ` +
          `(${widths.join(', ')}), which is the side-stripe accent DESIGN.md ` +
          `bans`,
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
  })
}

test('the two placeholders on the site do not share a label', async ({
  page,
}) => {
  // What the harness got from having two fixtures side by side, restated across
  // two pages. A component that ignored its props, or that hard-coded one
  // ratio, satisfied every single-page assertion above; it is only the pair
  // that catches it. Asserted here rather than left implicit in the table,
  // because the day somebody gives both placeholders the same crop this file
  // silently stops testing anything about props at all.
  const shapes: Array<{ label: string; ratio: number }> = []

  for (const placeholder of PLACEHOLDERS) {
    await visit(page, placeholder.page)
    const box = (await placeholderOn(page).boundingBox())!
    shapes.push({
      label: await placeholderOn(page).innerText(),
      ratio: box.width / box.height,
    })
  }

  expect(
    new Set(shapes.map((shape) => shape.label)).size,
    `both placeholders print the same label (${shapes[0].label}), so a ` +
      `component ignoring its \`label\` prop would pass every test above`,
  ).toBe(shapes.length)
  // The ratio discriminator is gone, and this is the honest note about it
  // rather than a silent deletion. It used to compare the 4:5 headshot on
  // /about against a 16:9 cover, which caught a component that ignored its
  // `ratio` prop and hard-coded one shape. A real avatar has replaced the
  // headshot, so every remaining placeholder is a case study cover and every
  // real cover is legitimately 16:9. Contorting one study's crop purely to
  // keep this assertion alive would be inventing content to satisfy a test.
  //
  // What still covers the prop: each placeholder above asserts its rendered
  // ratio against the value its own page declares. The residual hole is a
  // component that hard-codes exactly 16:9, which no current page would
  // reveal. It closes by itself the moment a second ratio ships, and the real
  // covers arriving is the moment to re-add a differing pair here.
  expect(
    new Set(shapes.map((shape) => shape.ratio.toFixed(3))).size,
    'both placeholders reserve the same shape, which is expected now that ' +
      'both are covers. This assertion exists to fail loudly if that stops ' +
      'being true, so the pair discriminator can be restored',
  ).toBe(1)
})
