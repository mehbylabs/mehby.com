import { expect, test } from '@playwright/test'
import { installProbes } from './support/probes'
import { getCaseStudies } from '#/lib/content'

// The case study route, /work/$slug.
//
// One dynamic route serves every study, so a test that only exercises one slug
// proves almost nothing: the interesting failures are the ones that differ per
// study. The frontmatter differs (CoaChess has surfaces and no source,
// Helmdeck has a source and no surfaces), the MDX bodies differ, and the
// not-found path differs from all of them.
//
// Restated fixtures rather than a content import, for the reason
// tests/e2e/spec-table.spec.ts gives: a test that reads its expectations out
// of the module the page renders from cannot fail when both are wrong.

const STUDIES = [
  {
    slug: 'volt-tunisia',
    title: 'VoltTunisia',
    role: 'Designer and engineer',
    period: '2026',
    // A heading from the MDX body, which proves the narrative rendered rather
    // than only the frontmatter.
    section: 'The domain is the hard part',
    surfaces: [] as Array<string>,
    source: null as string | null,
    // Not in the frontmatter schema. Supplied per case study by the route, and
    // asserted per study so a single shared list cannot satisfy all three.
    stack: 'TypeScript, React, Postgres',
  },
  {
    slug: 'helmdeck',
    title: 'Helmdeck',
    role: 'Designer and engineer',
    period: '2026',
    section: 'Why a protocol rather than adapters',
    surfaces: [],
    source: 'https://github.com/mehbylabs/helmdeck',
    stack: 'TypeScript, Agent Client Protocol',
  },
  {
    slug: 'coachess',
    title: 'CoaChess',
    role: 'CTO and co-founder',
    period: '2022 to present',
    section: 'One platform, five surfaces',
    // Read from the frontmatter the page renders and the build gate checks.
    // Restating the list made this a change detector: it failed the day a
    // fourth CoaChess surface shipped, which is a content edit, not a bug.
    surfaces: getCaseStudies()
      .find((entry) => entry.slug === 'coachess')!
      .surfaces.map((surface) => surface.href),
    source: null,
    stack: 'TypeScript, React, Python',
  },
]

for (const study of STUDIES) {
  test.describe(study.slug, () => {
    test.beforeEach(async ({ page }) => {
      await installProbes(page)
      await page.goto(`/work/${study.slug}`)
    })

    test('titles the page in a single h1', async ({ page }) => {
      const h1 = page.locator('h1')

      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText(study.title)
    })

    test('renders the narrative from the MDX body', async ({ page }) => {
      await expect(
        page.getByTestId('narrative'),
        'the case study has no narrative. The loader returns frontmatter ' +
          'only; the body comes from the MDX glob and is easy to drop',
      ).toHaveCount(1)
      await expect(
        page.getByTestId('narrative').getByRole('heading', {
          name: study.section,
          exact: true,
        }),
        'a section heading from the MDX body is missing, so the body did not ' +
          'render even though the frontmatter did',
      ).toHaveCount(1)
    })

    test('puts the specification above the narrative', async ({ page }) => {
      // DESIGN.md: the specification table is "the primary way work is
      // presented". A visitor with two minutes reads the table; the narrative
      // is for the second audience. Order is asserted against the DOM rather
      // than against pixels so it holds at every breakpoint.
      const order = await page.evaluate(() => {
        const table = document.querySelector('[data-testid="spec-table"]')!
        const narrative = document.querySelector('[data-testid="narrative"]')!
        return table.compareDocumentPosition(narrative) &
          Node.DOCUMENT_POSITION_FOLLOWING
          ? 'table first'
          : 'narrative first'
      })

      expect(order).toBe('table first')
    })

    test('keeps the specification a real table, whatever wraps it', async ({
      page,
    }) => {
      // A table forced to `display: block` by a flex or grid parent loses its
      // table role in the accessibility tree, and nothing about the rendering
      // changes enough to notice. This is the assertion that catches a wrapper
      // added for layout.
      const table = page.getByRole('table')

      await expect(
        table,
        'the specification table is not exposed as a table. Check that ' +
          'nothing wrapping it sets display on the table itself',
      ).toHaveCount(1)

      const display = await page
        .getByTestId('spec-table')
        .evaluate((el) => getComputedStyle(el).display)
      expect(
        display,
        `the table computes display: ${display}. Anything other than a table ` +
          `display strips the role a screen reader navigates by`,
      ).toMatch(/^table/)
    })

    test('fills the specification from this study\u2019s own frontmatter', async ({
      page,
    }) => {
      const valueFor = (label: string) =>
        page
          .getByRole('row')
          .filter({
            has: page.getByRole('rowheader', { name: label, exact: true }),
          })
          .getByRole('cell')
          .innerText()

      expect(await valueFor('Role')).toBe(study.role)
      expect(await valueFor('Period')).toBe(study.period)
      // PRODUCT.md permits capability "in per-project tables" and bans it as a
      // fixed list, so this row has to differ per study or it is the badge
      // wall with a table around it.
      expect(
        await valueFor('Stack'),
        'the Stack row is missing or is the same list on every case study',
      ).toBe(study.stack)

      // Every optional row present on the study that has the data and absent
      // on the ones that do not. A component that printed every row regardless
      // passes the two assertions above and fails these.
      const headers = await page.getByRole('rowheader').allTextContents()

      if (study.surfaces.length) {
        expect(headers).toContain('Surfaces')
        const hrefs = await page
          .getByRole('row')
          .filter({ has: page.getByRole('rowheader', { name: 'Surfaces' }) })
          .getByRole('link')
          .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))
        expect(hrefs).toEqual(study.surfaces)
      } else {
        expect(
          headers,
          'a Surfaces row on a study with no surfaces reads as a rendering fault',
        ).not.toContain('Surfaces')
      }

      if (study.source) {
        expect(headers).toContain('Source')
        await expect(
          page
            .getByRole('row')
            .filter({ has: page.getByRole('rowheader', { name: 'Source' }) })
            .getByRole('link'),
        ).toHaveAttribute('href', study.source)
      } else {
        expect(headers).not.toContain('Source')
      }
    })

    test('names the table for assistive technology', async ({ page }) => {
      // Three tables would otherwise be announced as "table" three times. The
      // caption says which specification this is, and does not repeat the
      // heading above it.
      await expect(page.getByRole('caption')).toHaveText(
        `Specification: ${study.title}`,
      )
    })

    test('shows the architecture rather than a labelled absence', async ({
      page,
    }) => {
      // This slot used to hold a PLACEHOLDER box, correctly, because no cover
      // image was ever supplied and PRODUCT.md's standing rule is that a gap
      // is declared rather than filled with an invention.
      //
      // The rule has not changed; the gap has. A screenshot still needs the
      // owner, but the architecture does not: each drawing states only what
      // the narrative under it already states in prose, which is also what
      // keeps the CoaChess discretion rule intact.
      //
      // tests/e2e/diagram.spec.ts holds the drawings themselves to their
      // accessible name, their palette and their reserved box.
      await expect(page.getByTestId('diagram')).toHaveCount(1)
      await expect(page.getByTestId('placeholder')).toHaveCount(0)
    })

    test('offers the way back to the rest of the work', async ({ page }) => {
      await expect(
        page.getByRole('link', { name: 'All work', exact: true }),
      ).toHaveAttribute('href', '/')
    })
  })
}

test.describe('an address that matches no case study', () => {
  test('renders a not-found state rather than failing', async ({ page }) => {
    // Deliberately not a status assertion. The route is allowed to answer 404,
    // and asserting response.ok() is banned here anyway; what matters is that
    // a visitor who mistypes a slug gets a page that tells them so instead of
    // a blank document or a stack trace.
    await page.goto('/work/not-a-real-case-study')

    await expect(page.getByTestId('not-found')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('No case study here')
    await expect(
      page.getByRole('link', { name: 'All work', exact: true }),
      'the not-found state is a dead end with no way back to the work',
    ).toHaveAttribute('href', '/')
  })

  test('renders no specification table for a study that does not exist', async ({
    page,
  }) => {
    // The failure this catches: a loader that returns undefined and a
    // component that renders the table anyway, with every cell empty.
    await page.goto('/work/not-a-real-case-study')

    await expect(page.getByTestId('spec-table')).toHaveCount(0)
    await expect(page.getByTestId('narrative')).toHaveCount(0)
  })

  test('does not throw a server error', async ({ page }) => {
    const response = await page.goto('/work/not-a-real-case-study')

    expect(
      response?.status(),
      'an unknown slug is a missing page, not a broken server',
    ).toBeLessThan(500)
  })
})
