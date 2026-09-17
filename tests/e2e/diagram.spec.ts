import { expect, test } from '@playwright/test'
import { TOKENS, hydrated, installProbes } from './support/probes'
import { getCaseStudies } from '#/lib/content'

// The architecture drawings, pinned against a real browser.
//
// They exist because the site sold product engineering and shipped no pixels
// of any product: the largest element on every case study was a dashed box
// labelled PLACEHOLDER. That was the correct answer to a missing asset and the
// wrong answer to the question a visitor arrived with.
//
// Three things have to hold, and each one is a way a generated drawing fails
// quietly.
//
// 1. It has to be an image to assistive technology, with a name and a real
//    description. An unnamed <svg> announces as nothing at all, which is worse
//    than the placeholder it replaced: the placeholder at least said something
//    was missing.
// 2. It has to be painted in the tokens. A diagram is the one place on this
//    site where somebody would reach for a hex value, and the contrast gate
//    measures tokens, not drawings.
// 3. It has to reserve its box. tests/e2e/performance.spec.ts asserts a
//    cumulative layout shift of exactly zero, and an SVG with no intrinsic
//    ratio collapses to nothing and then expands.

const STUDIES = getCaseStudies().map((study) => study.slug)

test.beforeEach(async ({ page }) => {
  await installProbes(page)
})

for (const slug of STUDIES) {
  test.describe(`/work/${slug}`, () => {
    test('draws its architecture rather than declaring it absent', async ({
      page,
    }) => {
      await page.goto(`/work/${slug}`)
      await hydrated(page)

      await expect(page.getByTestId('diagram')).toHaveCount(1)
      // The thing it replaced. If a placeholder comes back here, the diagram
      // stopped rendering and nobody noticed.
      await expect(page.getByTestId('placeholder')).toHaveCount(0)
    })

    test('is an image with a name and a description', async ({ page }) => {
      await page.goto(`/work/${slug}`)
      await hydrated(page)

      const canvas = page.locator('.diagram-canvas')
      await expect(canvas).toHaveRole('img')

      const described = await canvas.evaluate((el) => {
        const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/)
        return ids
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      })

      expect(
        described.length,
        'the diagram names itself from nothing',
      ).toBeGreaterThanOrEqual(2)

      const [name, description] = described
      expect(name.length, 'the diagram has no accessible name').toBeGreaterThan(
        10,
      )
      // The description is the content for anyone who cannot use the picture,
      // so it has to be prose rather than a label repeated.
      expect(
        description.split(/\s+/).length,
        `the description of the ${slug} diagram is ${description.split(/\s+/).length} ` +
          `words. It is the only version of this content a screen reader ` +
          `reader gets, so it has to say what the drawing shows`,
      ).toBeGreaterThan(30)
      expect(description).not.toBe(name)
    })

    test('paints only in the design tokens', async ({ page }) => {
      await page.goto(`/work/${slug}`)
      await hydrated(page)

      // Every colour any part of the drawing resolves to, measured from the
      // browser rather than read from the source, so a token that stopped
      // resolving is caught along with a hex value somebody typed.
      const used = await page.locator('.diagram-canvas').evaluate((svg) => {
        const seen = new Set<string>()
        for (const node of svg.querySelectorAll('*')) {
          const s = getComputedStyle(node)
          for (const value of [s.fill, s.stroke]) {
            if (value && value !== 'none') seen.add(value)
          }
        }
        return [...seen].map((colour) => {
          const [r, g, b, a] = window.rgba(colour)
          return { colour, rgba: [r, g, b, a] as const }
        })
      })

      const palette = await page.evaluate(
        (tokens) =>
          Object.fromEntries(
            Object.entries(tokens).map(([name, value]) => [
              name,
              window
                .rgba(value)
                .slice(0, 3)
                .map((c) => Math.round(c * 255)),
            ]),
          ),
        TOKENS as unknown as Record<string, string>,
      )

      const known = Object.values(palette).map((c) => (c as number[]).join(','))

      for (const { colour, rgba } of used) {
        if (rgba[3] === 0) continue
        const key = rgba
          .slice(0, 3)
          .map((c) => Math.round(c * 255))
          .join(',')
        expect(
          known,
          `the ${slug} diagram paints ${colour}, which is not a design token. ` +
            `The contrast gate measures tokens, so a colour invented here is ` +
            `a colour nothing has ever checked`,
        ).toContain(key)
      }
    })

    test('reserves its box before it paints', async ({ page }) => {
      await page.goto(`/work/${slug}`)
      await hydrated(page)

      const canvas = page.locator('.diagram-canvas')
      await expect(canvas).toHaveAttribute('viewBox', /^0 0 \d+ \d+$/)

      const box = await canvas.boundingBox()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.height).toBeGreaterThan(0)
    })
  })
}
