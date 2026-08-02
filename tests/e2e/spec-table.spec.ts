import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  NON_TEXT,
  TOKENS,
  hydrated,
  installProbes,
  styleOf,
} from './support/probes'

// The specification table, pinned against a real browser.
//
// DESIGN.md calls this the signature element and the primary way work is
// presented, and PRODUCT.md commits to "real table semantics with proper
// headers, not divs". So the semantic assertions here query the accessibility
// tree by ARIA role rather than by CSS selector: a stack of divs with
// `display: table` looks identical in a screenshot and identical in a
// getComputedStyle diff, and is silent to a screen reader. Only the role query
// can tell the two apart.
//
// The colour assertions measure computed style, never class names, for the
// reason tests/e2e/primitives.spec.ts sets out: the divider on paper and the
// divider on ultramarine are one token apart in a diff and 3.34 vs 1.57 apart
// on screen.
//
// Driven by /dev/primitives, the scratch harness. When that page goes, these
// assertions must be re-pointed at the real case study pages; the invariants
// are about the component and its ground, not about this route.

// The harness fixtures, restated here rather than imported. A test that reads
// its expectations out of the same module the page renders from cannot fail
// when both are wrong together.
const COACHESS = {
  caption: 'Specification: CoaChess',
  role: 'CTO and co-founder',
  period: '2022 to present',
  surfaces: [
    { label: 'coachess.net', href: 'https://coachess.net' },
    { label: 'app.coachess.net', href: 'https://app.coachess.net' },
  ],
  stack: 'TypeScript, Postgres, WebRTC',
}

const HELMDECK = {
  caption: 'Specification: Helmdeck',
  role: 'Designer and engineer',
  period: '2026',
  source: {
    href: 'https://github.com/MohamedElhedi-BenYedder/helmdeck',
    shown: 'github.com/MohamedElhedi-BenYedder/helmdeck',
  },
  stack: 'TypeScript, Rust',
}

const tableIn = (page: Page, tone: string) =>
  page.getByTestId(`section-field-${tone}`).getByRole('table')

const rowHeaders = (table: Locator) =>
  table.getByRole('rowheader').allTextContents()

test.beforeEach(async ({ page }) => {
  await installProbes(page)
  await page.goto('/dev/primitives')
  // The row hover tests scroll the ultramarine table into view and park the
  // pointer on it. Scroll restoration fires when hydration lands and would
  // undo that scroll from under the cursor. See `hydrated` in support/probes.
  await hydrated(page)
})

test.describe('semantics', () => {
  test('reaches the accessibility tree as a table, not as a grid of divs', async ({
    page,
  }) => {
    const table = tableIn(page, 'paper')

    await expect(
      table,
      'no element with the ARIA role "table" inside the paper field. A ' +
        '<div> stack styled with display:table renders identically and ' +
        'exposes nothing (PRODUCT.md, Accessibility)',
    ).toHaveCount(1)

    // Every label is a row header, and every row header has a data cell to
    // head. Counting both is what catches a table that lost its <th>s and
    // became a uniform grid of <td>s.
    const headers = await rowHeaders(table)
    expect(
      headers,
      'the label column does not expose the expected row headers. Every label ' +
        'must be a <th scope="row"> rather than a <td>, and a row with no ' +
        'data must be absent rather than printed empty',
    ).toEqual(['Role', 'Period', 'Surfaces', 'Stack'])

    await expect(
      table.getByRole('cell'),
      'every row header should be paired with exactly one data cell',
    ).toHaveCount(headers.length)

    await expect(
      table.getByRole('row'),
      'the table exposes a different number of rows than row headers, so at ' +
        'least one row is not a label/value pair',
    ).toHaveCount(headers.length)
  })

  test('marks its headers scope="row", which is what associates them with their data', async ({
    page,
  }) => {
    // Deliberately an attribute assertion, and the only one in this file.
    // Playwright's role engine infers "rowheader" for a bare <th> that sits
    // beside a non-empty <td>, and so does Chromium, so the role assertion
    // above passes with the scope stripped. The association is nonetheless
    // undefined without it: a <th> with no scope in a table the browser reads
    // as ambiguous is announced as a column header, and every value in the
    // table is then announced under the wrong label.
    const scopes = await tableIn(page, 'paper')
      .getByRole('rowheader')
      .evaluateAll((els) => els.map((el) => el.getAttribute('scope')))

    expect(
      scopes,
      'a label cell is missing scope="row", so its association with the value ' +
        'beside it is left to the browser to guess',
    ).toEqual(['row', 'row', 'row', 'row'])
  })

  test('names itself with a caption that assistive technology can read', async ({
    page,
  }) => {
    const caption = tableIn(page, 'paper').getByRole('caption')

    await expect(
      caption,
      'the table has no element exposing the role "caption". A table with no ' +
        'accessible name is announced as "table" and nothing else',
    ).toHaveCount(1)
    await expect(
      caption,
      'the caption does not name this table, so two tables on one page are ' +
        'announced identically',
    ).toHaveText(COACHESS.caption)
  })

  test('hides that caption visually without hiding it from the accessibility tree', async ({
    page,
  }) => {
    // The two halves are one test on purpose: they are the two ways to get
    // this wrong and each looks correct on its own. `display: none` passes
    // every visual review and deletes the accessible name; leaving the caption
    // painted passes every screen-reader check and puts a heading the design
    // does not have above the table.
    const caption = tableIn(page, 'paper').getByRole('caption')

    // getByRole skips elements hidden for ARIA, so reaching it here already
    // proves it is not display:none, visibility:hidden or aria-hidden.
    await expect(
      caption,
      'the caption is hidden from the accessibility tree, not just from the ' +
        'page, so hiding it deleted the accessible name it exists to provide',
    ).toHaveCount(1)

    const box = (await caption.boundingBox())!
    expect(
      Math.max(box.width, box.height),
      'the caption is painted at its natural size, so it reads as a visible ' +
        'heading above the table',
    ).toBeLessThanOrEqual(2)
  })

  test('omits rows it has no data for instead of printing an empty one', async ({
    page,
  }) => {
    // PRODUCT.md: honest scope. A "Source" row on a project with no public
    // repository is a promise the table cannot keep, and an empty cell reads
    // as a rendering bug rather than as an absence.
    // Each half asserts the row is present in the table whose fixture supplies
    // it before asserting it is absent from the one that does not. A bare
    // `not.toContain` passes against a component that renders nothing at all,
    // which is the worst kind of green.
    const paper = await rowHeaders(tableIn(page, 'paper'))
    const ultramarine = await rowHeaders(tableIn(page, 'ultramarine'))
    const deep = await rowHeaders(tableIn(page, 'ultramarine-deep'))

    expect(
      ultramarine,
      'the ultramarine fixture supplies a source and its table has no Source row',
    ).toContain('Source')
    expect(
      paper,
      'the paper table has a Source row, but its fixture supplies no source',
    ).not.toContain('Source')

    expect(
      paper,
      'the paper fixture supplies surfaces and its table has no Surfaces row',
    ).toContain('Surfaces')
    expect(
      ultramarine,
      'the ultramarine table has a Surfaces row, but its fixture supplies none',
    ).not.toContain('Surfaces')

    expect(
      paper,
      'the paper fixture supplies a stack and its table has no Stack row',
    ).toContain('Stack')
    expect(
      deep,
      'the ultramarine-deep table has a Stack row, but its fixture supplies none',
    ).not.toContain('Stack')
  })

  test('renders the metadata it was given, per table', async ({ page }) => {
    const paper = tableIn(page, 'paper')
    const ultramarine = tableIn(page, 'ultramarine')

    const valueFor = (table: Locator, label: string) =>
      table
        .getByRole('row')
        .filter({
          has: page.getByRole('rowheader', { name: label, exact: true }),
        })
        .getByRole('cell')
        .innerText()

    const wrong = (label: string) =>
      `the ${label} row does not print the ${label.toLowerCase()} it was given`

    expect(await valueFor(paper, 'Role'), wrong('Role')).toBe(COACHESS.role)
    expect(await valueFor(paper, 'Period'), wrong('Period')).toBe(
      COACHESS.period,
    )
    expect(
      await valueFor(paper, 'Stack'),
      'the Stack row does not print every entry it was given, in order',
    ).toBe(COACHESS.stack)

    // Different fixture, different values. Two tables with different data are
    // what stop a component that ignores its props from passing.
    expect(await valueFor(ultramarine, 'Role'), wrong('Role')).toBe(
      HELMDECK.role,
    )
    expect(await valueFor(ultramarine, 'Period'), wrong('Period')).toBe(
      HELMDECK.period,
    )
    expect(
      await valueFor(ultramarine, 'Stack'),
      'the Stack row does not print every entry it was given, in order',
    ).toBe(HELMDECK.stack)
  })

  test('renders surfaces and source as real links, labelled and addressed', async ({
    page,
  }) => {
    const surfaces = tableIn(page, 'paper').getByRole('link')

    await expect(
      surfaces,
      'the surfaces cell does not render one link per surface. A surface ' +
        'printed as text is a claim a visitor cannot check',
    ).toHaveCount(COACHESS.surfaces.length)
    for (const [i, surface] of COACHESS.surfaces.entries()) {
      await expect(
        surfaces.nth(i),
        `surface ${i} is not labelled with its own hostname`,
      ).toHaveText(surface.label)
      await expect(
        surfaces.nth(i),
        `surface ${i} does not point anywhere. PRODUCT.md: proof over claim, ` +
          `every assertion anchored to something a visitor can click`,
      ).toHaveAttribute('href', surface.href)
    }

    // The source cell prints the URL, minus the scheme, because DESIGN.md sets
    // link URLs in Martian Mono as data. A bare "GitHub" would hide which
    // repository is being claimed.
    const source = tableIn(page, 'ultramarine').getByRole('link')
    await expect(source, 'the source cell does not render a link').toHaveCount(
      1,
    )
    await expect(
      source,
      'the source cell does not print the address, so which repository is ' +
        'being claimed is hidden behind a label',
    ).toHaveText(HELMDECK.source.shown)
    await expect(
      source,
      'the source link does not point at the repository it names',
    ).toHaveAttribute('href', HELMDECK.source.href)
  })
})

test.describe('typography', () => {
  test('sets labels in Archivo and values in Martian Mono', async ({
    page,
  }) => {
    // DESIGN.md: Martian Mono strictly for data, never for body copy. The two
    // families are asserted against each other as well as by name, so a
    // component that sets one font for the whole table fails even if that font
    // is the right one for half of it.
    const table = tableIn(page, 'paper')

    const label = (
      await styleOf(table.getByRole('rowheader').first(), ['font-family'])
    )['font-family']
    const value = (
      await styleOf(table.getByRole('cell').first(), ['font-family'])
    )['font-family']

    expect(label, 'label cells are not set in Archivo').toContain('Archivo')
    expect(value, 'value cells are not set in Martian Mono').toContain(
      'Martian Mono',
    )
    expect(
      value,
      'value cells fall back to Archivo, so the tabular figures the table ' +
        'exists for are not tabular',
    ).not.toContain('Archivo')
    expect(
      label,
      'label cells are set in Martian Mono, which DESIGN.md reserves for data',
    ).not.toContain('Martian Mono')
  })
})

test.describe('dividers', () => {
  const dividerOn = async (page: Page, tone: string) =>
    await styleOf(tableIn(page, tone).getByRole('rowheader').first(), [
      'border-bottom-color',
      'border-bottom-style',
      'border-bottom-width',
    ])

  test('uses the structural rule token on paper, never the decorative one', async ({
    page,
  }) => {
    const divider = await dividerOn(page, 'paper')

    expect(
      divider['border-bottom-color'],
      '--color-rule measures 1.32 on paper. DESIGN.md permits it for grid ' +
        'hatching and never for a border that carries meaning, which a table ' +
        'divider does',
    ).not.toBe(TOKENS.rule)
    expect(
      divider['border-bottom-color'],
      'table dividers on paper must be --color-rule-strong',
    ).toBe(TOKENS['rule-strong'])
    expect(
      divider['border-bottom-style'],
      'the divider has a colour but no style, so nothing is drawn',
    ).toBe('solid')
    expect(
      parseFloat(divider['border-bottom-width']),
      'the divider has a colour but no width, so nothing is drawn',
    ).toBeGreaterThan(0)
  })

  test('inverts to the on-colour rule token on an ultramarine ground', async ({
    page,
  }) => {
    const divider = await dividerOn(page, 'ultramarine')

    expect(
      divider['border-bottom-color'],
      '--color-rule-strong measures 1.57 on ultramarine, so a divider that ' +
        'kept its paper value is invisible across the 30 to 50 percent of the ' +
        'site that is drenched (DESIGN.md, Every role needs two values)',
    ).not.toBe(TOKENS['rule-strong'])
    expect(
      divider['border-bottom-color'],
      'table dividers on ultramarine must be --color-rule-on-color',
    ).toBe(TOKENS['rule-on-color'])
  })

  test('every table on the page draws dividers that clear 3.0 on their own ground', async ({
    page,
  }) => {
    // Deliberately generic, in the shape of the "every field" test in
    // primitives.spec.ts. The two named tests above pin the grounds shipped
    // today; this one discovers whatever is rendered, so a table dropped onto
    // a ground nobody thought about is caught the moment it appears rather
    // than the moment somebody remembers to extend a list.
    const measured = await page.evaluate(() => {
      const cells = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="spec-table"] th, [data-testid="spec-table"] td',
        ),
      ]
      return cells.map((cell) => {
        // Nothing inside a field paints its own background, so the ground for
        // a divider is the nearest ancestor that does.
        let node: HTMLElement | null = cell
        let ground = 'rgba(0, 0, 0, 0)'
        while (node) {
          const bg = getComputedStyle(node).backgroundColor
          if (window.rgba(bg)[3] === 1) {
            ground = bg
            break
          }
          node = node.parentElement
        }
        const color = getComputedStyle(cell).borderBottomColor
        return {
          where: cell.closest('[data-tone]')?.getAttribute('data-tone') ?? '?',
          color,
          ground,
          ratio: window.contrast(color, ground),
        }
      })
    })

    expect(
      measured.length,
      'no specification tables found on the page, so this test proves nothing',
    ).toBeGreaterThan(0)

    for (const cell of measured) {
      expect(
        cell.ratio,
        `on the ${cell.where} ground a divider measures ` +
          `${cell.ratio.toFixed(2)} against ${cell.ground}, below the 3.0 ` +
          `non-text threshold`,
      ).toBeGreaterThanOrEqual(NON_TEXT)
    }
  })
})

test.describe('row hover', () => {
  // The background the row actually comes to rest at under the pointer.
  //
  // DESIGN.md permits the tint to transition, and every naive way of reading it
  // samples the transition instead of its end state. `expect.poll(...).not
  // .toBe(resting)` returns at the first sample that differs from the resting
  // value, which part-way through a 120ms fade is a colour the user never sees
  // at either end: measured, that let both an opaque tint and a tint hard-coded
  // to one ground pass, because every mid-transition sample is translucent and
  // no two of them are equal.
  //
  // So: sample until the value holds still for three consecutive reads, and do
  // it inside the page. Driving the loop over the wire adds round-trip jitter
  // to every interval, and Chromium serialises the same colour two ways during
  // a transition — `rgba(0, 0, 0, 0)` at rest, `oklab(0 0 0 / 0)` on the first
  // interpolated frame — so a two-sample rule can latch onto the start of the
  // fade and report it as the end.
  const settledBackground = (row: Locator) =>
    row.evaluate(async (el) => {
      const read = () => getComputedStyle(el).backgroundColor
      let previous = read()
      let held = 0
      const started = performance.now()

      while (performance.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        const current = read()
        held = current === previous ? held + 1 : 0
        previous = current
        if (held >= 3) return current
      }
      throw new Error('the row background never stopped changing')
    })

  const rowTint = async (page: Page, tone: string) => {
    const row = tableIn(page, tone).getByRole('row').first()

    // Scroll first, then park the pointer off the table, then move onto it.
    // Chromium does not recompute :hover when the page scrolls under a
    // stationary pointer, so a hover() that has to scroll to reach its target
    // can land the cursor on the row with the hover state still belonging to
    // wherever it was before. Separating the two makes the last thing that
    // happens a real pointer movement onto the row.
    await row.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)

    const resting = (await styleOf(row, ['background-color']))[
      'background-color'
    ]

    await row.hover()

    // The same guard tests/e2e/primitives.spec.ts puts on :focus-visible, for
    // the same reason: a hover test that never engaged the selector passes
    // against a component with no hover state at all.
    expect(
      await row.evaluate((el) => el.matches(':hover')),
      `the pointer was placed on the ${tone} row but :hover did not engage, ` +
        `so this measurement is of the resting state`,
    ).toBe(true)

    const hovered = await settledBackground(row)

    expect(
      hovered,
      `the row under the pointer on ${tone} settles back at its resting ` +
        `background, so nothing tints on hover`,
    ).not.toBe(resting)

    const alpha = await page.evaluate((c) => window.rgba(c)[3], hovered)
    return { resting, hovered, alpha }
  }

  test('tints the row under the pointer, on both grounds', async ({ page }) => {
    for (const tone of ['paper', 'ultramarine']) {
      const tint = await rowTint(page, tone)

      expect(
        await page.evaluate((c) => window.rgba(c)[3], tint.resting),
        `rows on ${tone} are painted at rest, so the table reads as a band of ` +
          `boxes rather than as ruled rows`,
      ).toBe(0)
      expect(
        tint.alpha,
        `the hover tint on ${tone} is fully transparent, so nothing changes ` +
          `under the pointer`,
      ).toBeGreaterThan(0)
      expect(
        tint.alpha,
        `the hover tint on ${tone} is opaque, so the row reads as a selected ` +
          `block rather than as a tint`,
      ).toBeLessThan(1)
    }
  })

  test('derives that tint from the ground it is on', async ({ page }) => {
    // One hard-coded tint cannot serve both. A dark tint on ultramarine is
    // barely a change; a light one on paper is invisible. Asserting the two
    // differ is what stops a single literal being written here.
    const onPaper = await rowTint(page, 'paper')
    const onColor = await rowTint(page, 'ultramarine')

    expect(
      onColor.hovered,
      'the hover tint is the same colour on paper and on ultramarine, so one ' +
        'of the two grounds is being tinted with a value chosen for the other',
    ).not.toBe(onPaper.hovered)
  })
})
