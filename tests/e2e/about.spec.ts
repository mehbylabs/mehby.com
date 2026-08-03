import { expect, test } from '@playwright/test'
import { installProbes } from './support/probes'

// /about carries the one rule on this site that is easiest to break by being
// helpful: PRODUCT.md forbids invented content of any kind, and a timeline is
// the single most inviting place to round a career up. The owner supplied
// nothing before 2022, so the assertions below are mostly about what is absent
// and are written to fail on a plausible addition rather than on a silly one.

test.beforeEach(async ({ page }) => {
  await installProbes(page)
  await page.goto('/about')
})

test.describe('the page', () => {
  test('opens with the whoami answer, once', async ({ page }) => {
    // The page opens with a prompt running `whoami`; the answer, the owner's
    // name, is the document title in the accessibility tree and in search
    // results.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Mohamed Elhedi Ben Yedder',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('carries the four paragraphs, in order', async ({ page }) => {
    const body = page.getByTestId('about-body')

    await expect(body.locator('p')).toHaveCount(4)
    await expect(body.locator('p').first()).toContainText(
      'full stack product engineer based in Tunisia',
    )
    await expect(body.locator('p').nth(1)).toContainText(
      'the rules are not negotiable',
    )
    await expect(body.locator('p').nth(2)).toContainText(
      'I pick tools per problem',
    )
    await expect(body.locator('p').last()).toHaveText(
      'I am available for freelance product work.',
    )
  })

  test('never says less than it means with an em dash', async ({ page }) => {
    const text = await page.locator('main').innerText()

    expect(text).not.toContain('\u2014')
    expect(text).not.toContain('--')
  })
})

test.describe('the timeline', () => {
  test('is a real table, not a styled stack of divs', async ({ page }) => {
    // Asserted through the accessibility tree rather than through markup: a
    // grid of divs can be made to look identical and announces as nothing.
    const table = page.getByRole('table')

    await expect(table).toHaveCount(1)
    await expect(table).toHaveAccessibleName(/Timeline/)
    await expect(table.getByRole('row')).toHaveCount(3)
    await expect(table.getByRole('rowheader')).toHaveCount(3)
  })

  test('keeps its own display, so the semantics survive the CSS', async ({
    page,
  }) => {
    // Separate from the assertion above, and measured rather than assumed.
    //
    // The received wisdom is that overriding a table's display strips its role
    // from the accessibility tree. That is not reproducible in the browser this
    // suite runs: Chromium here reports role=table, and every row and
    // rowheader with it, for a table set to display block, flex or grid, and
    // for one sitting inside a flex parent. Verified directly against a
    // synthetic page before this test was written, because the alternative was
    // shipping an assertion that could not fail.
    //
    // The rule is still right, so it is pinned on the property itself rather
    // than on a consequence one engine has stopped producing. A table set to
    // flex loses its row and column structure in layout on every engine, and
    // other engines have not all followed Chromium here. This fails on the
    // declaration, which is the thing that is actually wrong.
    const display = await page
      .getByRole('table')
      .evaluate((el) => getComputedStyle(el).display)

    expect(display).toBe('table')
  })

  test('holds exactly the three entries the owner supplied', async ({
    page,
  }) => {
    const rows = page.getByRole('table').getByRole('row')

    await expect(rows.nth(0)).toContainText('2026')
    await expect(rows.nth(0)).toContainText(
      'Helmdeck, open-source mission control for AI coding agents',
    )
    await expect(rows.nth(1)).toContainText('2026')
    await expect(rows.nth(1)).toContainText(
      'VoltTunisia, the national electric vehicle companion for Tunisia',
    )
    await expect(rows.nth(2)).toContainText('2022 to present')
    await expect(rows.nth(2)).toContainText('CTO and co-founder, CoaChess')
  })

  test('invents nothing before 2022', async ({ page }) => {
    // Every four-digit year anywhere in the page, not only in the table. A
    // fabricated degree in a paragraph, a "since 2018" in the intro and a
    // fourth timeline row all fail here, which is the point: the rule is about
    // the page, not about one component.
    const text = await page.locator('main').innerText()
    const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) =>
      Number(m[0]),
    )

    expect(
      years.length,
      'no year appears at all, so this proves nothing',
    ).toBeGreaterThan(0)
    for (const year of years) {
      expect(
        year,
        `${year} appears on /about. The owner supplied nothing before 2022, ` +
          `so anything earlier was invented`,
      ).toBeGreaterThanOrEqual(2022)
    }
  })

  test('declares the gap rather than leaving it to be read as a full record', async ({
    page,
  }) => {
    const note = page.getByTestId('timeline-note')

    await expect(note).toHaveText(/Earlier roles and education pending\./)
    // Labelled, in the same register as every other placeholder on the site.
    // Without the label this is a closing remark; with it, it is a declared
    // absence.
    await expect(note.locator('.note-label')).toHaveText('PLACEHOLDER')
  })

  test('sets the note in Martian Mono at the fine step', async ({ page }) => {
    const styles = await page.getByTestId('timeline-note').evaluate((el) => {
      const s = getComputedStyle(el)
      return { family: s.fontFamily, size: s.fontSize }
    })

    expect(styles.family).toContain('Martian Mono')
    // --text-fine is 0.8125rem, which is 13px at the default root size.
    expect(styles.size).toBe('13px')
  })
})

test.describe('the portrait', () => {
  test('ships as a labelled placeholder, not as a stock photograph', async ({
    page,
  }) => {
    const placeholder = page.getByTestId('placeholder')

    await expect(placeholder).toHaveCount(1)
    await expect(placeholder).toHaveAccessibleName(/headshot/)
    // Announced as absent, not merely as an image. role="img" with a name that
    // does not say "placeholder" tells a screen reader user that something is
    // there rather than that something is missing.
    await expect(placeholder).toHaveAccessibleName(/not supplied/i)
    await expect(page.locator('main img')).toHaveCount(0)
  })

  test('reserves a portrait shape so the real photograph cannot shift the page', async ({
    page,
  }) => {
    const box = (await page.getByTestId('placeholder').boundingBox())!

    expect(
      box.height,
      'the portrait is not taller than it is wide',
    ).toBeGreaterThan(box.width)
  })
})
// DELETED: "the grounds". Both tests measured the two-colour band architecture
// of the previous design: that every ultramarine field set its own text
// colour, and that the timeline dividers survived the drenched ground. The
// terminal design stands on one warm near-black ground for the whole document
// and paints no coloured bands, so there is no inheritance hazard to guard and
// no on-colour divider to survive. The single-ground equivalents are measured
// elsewhere: text on bg by tests/e2e/tokens.spec.ts, and table borders by
// tests/e2e/spec-table.spec.ts.
