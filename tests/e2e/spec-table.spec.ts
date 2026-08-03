import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { TOKENS, hydrated, installProbes, styleOf } from './support/probes'

// The specification table, pinned against a real browser, on the pages that
// ship it.
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
// ---------------------------------------------------------------------------
// This drove /dev/primitives, which had three fixtures on three grounds. That
// harness is deleted. Most of what it proved is proved better here, and two
// things are not, so both are named rather than dropped quietly.
//
// What carried over intact, and improved. The three shipping case studies
// happen to be exactly the three row-sets the harness invented:
//
//   /work/coachess       Role Period Surfaces Stack     no Source
//   /work/helmdeck       Role Period Source   Stack     no Surfaces
//   /work/volt-tunisia   Role Period          Stack     neither
//
// So "a row with no data is omitted rather than printed empty" is still
// exercised in both directions on both optional columns, and now against real
// frontmatter instead of invented fixtures.
//
// What is genuinely lost, both for the same reason: no page that ships renders
// a SpecTable on anything but paper.
//
//   1. The divider inverting to --color-rule-on-color *as a property of this
//      component*. It is not untested. The inversion is not the component's,
//      it is --field-rule-strong's, an inherited custom property declared per
//      ground in styles.css, and the .timeline table on /about's ultramarine
//      band reads the same property from the same declaration. So the token
//      pair is still measured on both grounds, by "every table on the site" at
//      the bottom of this file, and what is no longer covered is the narrower
//      claim that SpecTable specifically reads it. That claim is currently
//      unfalsifiable on a shipping page, and inventing a page to hold it would
//      be shipping a harness under a different name.
//
//   2. The row hover tint differing between grounds. `.spec-table tbody
//      tr:hover` mixes from currentColor, so one declaration darkens a light
//      ground and lightens a dark one, and the harness proved that by putting
//      two tables on two grounds and asserting the results differed. There is
//      nowhere to stand to do that now. The replacement, in "row hover" below,
//      measures the tint against the row's own currentColor on paper: a tint
//      hard-coded to any literal fails it, which is the failure the two-ground
//      test existed to catch. The weaker part is that a literal which happened
//      to equal ink at 8 percent would pass, and the two-ground version would
//      not have.
// ---------------------------------------------------------------------------

/**
 * The three shipping specification tables, restated rather than imported.
 *
 * A test that reads its expectations out of content/work/*.mdx cannot fail
 * when the frontmatter and the page are wrong together, which is the whole
 * reason these are literals. The stacks come from STACK in
 * src/routes/work/$slug.tsx, which has no counterpart in the schema.
 */
const STUDIES = {
  coachess: {
    path: '/work/coachess',
    caption: 'Specification: CoaChess',
    role: 'CTO and co-founder',
    period: '2022 to present',
    rows: ['Role', 'Period', 'Surfaces', 'Stack'],
    surfaces: [
      { label: 'coachess.net', href: 'https://coachess.net' },
      { label: 'app.coachess.net', href: 'https://app.coachess.net' },
      { label: 'live.coachess.net', href: 'https://live.coachess.net' },
    ],
    stack: 'TypeScript, React, Python',
  },
  helmdeck: {
    path: '/work/helmdeck',
    caption: 'Specification: Helmdeck',
    role: 'Designer and engineer',
    period: '2026',
    rows: ['Role', 'Period', 'Source', 'Stack'],
    source: {
      href: 'https://github.com/MohamedElhedi-BenYedder/helmdeck',
      shown: 'github.com/MohamedElhedi-BenYedder/helmdeck',
    },
    stack: 'TypeScript, Agent Client Protocol',
  },
  'volt-tunisia': {
    path: '/work/volt-tunisia',
    caption: 'Specification: VoltTunisia',
    role: 'Designer and engineer',
    period: '2026',
    rows: ['Role', 'Period', 'Stack'],
    stack: 'TypeScript, React, Postgres',
  },
} as const

/** Every case study page carries exactly one specification table. */
const table = (page: Page) => page.getByTestId('spec-table')

const rowHeaders = (locator: Locator) =>
  locator.getByRole('rowheader').allTextContents()

const visit = async (page: Page, path: string) => {
  await installProbes(page)
  await page.goto(path)
  // The row hover test scrolls the table into view and parks the pointer on
  // it. Scroll restoration fires when hydration lands and would undo that
  // scroll from under the cursor. See `hydrated` in support/probes.
  await hydrated(page)
}

test.describe('semantics', () => {
  test('reaches the accessibility tree as a table, not as a grid of divs', async ({
    page,
  }) => {
    await visit(page, STUDIES.coachess.path)
    const spec = table(page)

    await expect(
      spec,
      'no element with the ARIA role "table" on the case study page. A ' +
        '<div> stack styled with display:table renders identically and ' +
        'exposes nothing (PRODUCT.md, Accessibility)',
    ).toHaveCount(1)

    // Every label is a row header, and every row header has a data cell to
    // head. Counting both is what catches a table that lost its <th>s and
    // became a uniform grid of <td>s.
    const headers = await rowHeaders(spec)
    expect(
      headers,
      'the label column does not expose the expected row headers. Every label ' +
        'must be a <th scope="row"> rather than a <td>, and a row with no ' +
        'data must be absent rather than printed empty',
    ).toEqual([...STUDIES.coachess.rows])

    await expect(
      spec.getByRole('cell'),
      'every row header should be paired with exactly one data cell',
    ).toHaveCount(headers.length)

    await expect(
      spec.getByRole('row'),
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
    await visit(page, STUDIES.coachess.path)

    const scopes = await table(page)
      .getByRole('rowheader')
      .evaluateAll((els) => els.map((el) => el.getAttribute('scope')))

    expect(
      scopes,
      'a label cell is missing scope="row", so its association with the value ' +
        'beside it is left to the browser to guess',
    ).toEqual(STUDIES.coachess.rows.map(() => 'row'))
  })

  test('names itself with a caption that assistive technology can read', async ({
    page,
  }) => {
    await visit(page, STUDIES.coachess.path)
    const caption = table(page).getByRole('caption')

    await expect(
      caption,
      'the table has no element exposing the role "caption". A table with no ' +
        'accessible name is announced as "table" and nothing else',
    ).toHaveCount(1)
    await expect(
      caption,
      'the caption does not name this table, so the specification on one case ' +
        'study is announced exactly like the one on another',
    ).toHaveText(STUDIES.coachess.caption)
  })

  test('hides that caption visually without hiding it from the accessibility tree', async ({
    page,
  }) => {
    // The two halves are one test on purpose: they are the two ways to get
    // this wrong and each looks correct on its own. `display: none` passes
    // every visual review and deletes the accessible name; leaving the caption
    // painted passes every screen-reader check and puts a heading the design
    // does not have above the table.
    await visit(page, STUDIES.coachess.path)
    const caption = table(page).getByRole('caption')

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

  test('names each table for the study it belongs to', async ({ page }) => {
    // The captions used to be distinguishable because the harness wrote three
    // different strings. They are distinguishable now because three routes
    // render from three different loaders, which is a stronger thing to hold:
    // a `head` or a component that dropped the per-study interpolation would
    // give every case study on the site the same accessible name for its
    // signature element, and nothing on a single page could see it.
    const captions: Array<string> = []
    for (const study of Object.values(STUDIES)) {
      await visit(page, study.path)
      captions.push(await table(page).getByRole('caption').innerText())
      expect(captions.at(-1), `${study.path} is captioned wrongly`).toBe(
        study.caption,
      )
    }

    expect(
      new Set(captions).size,
      `two case studies share a caption: ${captions.join(' | ')}`,
    ).toBe(captions.length)
  })

  test('omits rows it has no data for instead of printing an empty one', async ({
    page,
  }) => {
    // PRODUCT.md: honest scope. A "Source" row on a project with no public
    // repository is a promise the table cannot keep, and an empty cell reads
    // as a rendering bug rather than as an absence.
    //
    // Each half asserts the row is present on the study whose frontmatter
    // supplies it before asserting it is absent from the one that does not. A
    // bare `not.toContain` passes against a component that renders nothing at
    // all, which is the worst kind of green.
    const headersOn = async (path: string) => {
      await visit(page, path)
      return rowHeaders(table(page))
    }

    const coachess = await headersOn(STUDIES.coachess.path)
    const helmdeck = await headersOn(STUDIES.helmdeck.path)
    const volt = await headersOn(STUDIES['volt-tunisia'].path)

    expect(
      helmdeck,
      'helmdeck frontmatter supplies a source and its table has no Source row',
    ).toContain('Source')
    expect(
      coachess,
      'the coachess table has a Source row, but its frontmatter supplies none',
    ).not.toContain('Source')
    expect(
      volt,
      'the volt-tunisia table has a Source row, but its frontmatter supplies none',
    ).not.toContain('Source')

    expect(
      coachess,
      'coachess frontmatter supplies surfaces and its table has no Surfaces row',
    ).toContain('Surfaces')
    expect(
      helmdeck,
      'the helmdeck table has a Surfaces row, but `surfaces: []` supplies none',
    ).not.toContain('Surfaces')
    expect(
      volt,
      'the volt-tunisia table has a Surfaces row, but `surfaces: []` supplies none',
    ).not.toContain('Surfaces')

    // Stack is deliberately not asserted absent anywhere, and that is a real
    // gap rather than an oversight. STACK in src/routes/work/$slug.tsx supplies
    // one for all three slugs, so no shipping page exercises the omission of
    // that row. The harness did, with a fixture that supplied no stack. The
    // two rows above cover the same code path in SpecTable, so nothing in the
    // component is untested; what is untested is the specific combination, and
    // it will stay that way until a case study lands without a stack.
    for (const [slug, headers] of Object.entries({
      coachess,
      helmdeck,
      'volt-tunisia': volt,
    })) {
      expect(headers, `${slug} has lost its Stack row`).toContain('Stack')
    }
  })

  test('renders the metadata it was given, per study', async ({ page }) => {
    const valueFor = (label: string) =>
      table(page)
        .getByRole('row')
        .filter({
          has: page.getByRole('rowheader', { name: label, exact: true }),
        })
        .getByRole('cell')
        .innerText()

    // Three studies rather than one, and that is the point: two of them share
    // a role and a period, so a component that ignored its props could satisfy
    // a pair. Only a set where role, period and stack all vary independently
    // catches it, and the stacks below do vary in all three.
    for (const study of Object.values(STUDIES)) {
      await visit(page, study.path)

      expect(
        await valueFor('Role'),
        `${study.path} does not print the role from its frontmatter`,
      ).toBe(study.role)
      expect(
        await valueFor('Period'),
        `${study.path} does not print the period from its frontmatter`,
      ).toBe(study.period)
      expect(
        await valueFor('Stack'),
        `${study.path} does not print every stack entry it was given, in order`,
      ).toBe(study.stack)
    }
  })

  test('renders surfaces and source as real links, labelled and addressed', async ({
    page,
  }) => {
    await visit(page, STUDIES.coachess.path)
    const surfaces = table(page).getByRole('link')

    await expect(
      surfaces,
      'the surfaces cell does not render one link per surface. A surface ' +
        'printed as text is a claim a visitor cannot check',
    ).toHaveCount(STUDIES.coachess.surfaces.length)
    for (const [i, surface] of STUDIES.coachess.surfaces.entries()) {
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
    await visit(page, STUDIES.helmdeck.path)
    const source = table(page).getByRole('link')

    await expect(source, 'the source cell does not render a link').toHaveCount(
      1,
    )
    await expect(
      source,
      'the source cell does not print the address, so which repository is ' +
        'being claimed is hidden behind a label',
    ).toHaveText(STUDIES.helmdeck.source.shown)
    await expect(
      source,
      'the source link does not point at the repository it names',
    ).toHaveAttribute('href', STUDIES.helmdeck.source.href)
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
    await visit(page, STUDIES.coachess.path)
    const spec = table(page)

    const label = (
      await styleOf(spec.getByRole('rowheader').first(), ['font-family'])
    )['font-family']
    const value = (
      await styleOf(spec.getByRole('cell').first(), ['font-family'])
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
  test('rules the table in the structural token and separates rows in the decorative one', async ({
    page,
  }) => {
    await visit(page, STUDIES.coachess.path)
    const spec = table(page)

    // The whole table is edged with the structural token: a rule a user must
    // perceive, which is what edge-strong is for (it clears 3.0 on bg).
    const top = await styleOf(spec, [
      'border-top-color',
      'border-top-style',
      'border-top-width',
    ])
    expect(
      top['border-top-color'],
      'the table top is not the structural edge-strong token',
    ).toBe(TOKENS['edge-strong'])
    expect(top['border-top-style']).toBe('solid')
    expect(
      parseFloat(top['border-top-width']),
      'the top rule has a colour but no width, so nothing is drawn',
    ).toBeGreaterThan(0)

    // Between the rows the divider is the decorative edge token, the same
    // register as a terminal's row separators. DESIGN.md assigns edge to
    // decoration and edge-strong to structure; row dividers are the former.
    const row = await styleOf(spec.getByRole('rowheader').first(), [
      'border-bottom-color',
      'border-bottom-style',
      'border-bottom-width',
    ])
    expect(
      row['border-bottom-color'],
      'row dividers must be the decorative edge token, never edge-strong: ' +
        'a table with every row heavily ruled reads as a wall of boxes',
    ).toBe(TOKENS.edge)
    expect(row['border-bottom-style']).toBe('solid')
    expect(
      parseFloat(row['border-bottom-width']),
      'the row divider has a colour but no width, so nothing is drawn',
    ).toBeGreaterThan(0)
  })

  test('every table on every page rules its top in the structural token', async ({
    page,
  }) => {
    // Deliberately generic, and deliberately every table rather than every
    // specification table. The named test above pins the shipped case studies;
    // this one discovers whatever is rendered, so a table dropped onto a page
    // with a decorative top rule is caught the moment it appears rather than
    // the moment somebody remembers to extend a list. Widening it from
    // `[data-testid="spec-table"]` to `table` is what brings the timeline on
    // /about under the same measurement.
    const PAGES = [
      '/',
      '/about',
      '/contact',
      '/writing',
      '/work/coachess',
      '/work/helmdeck',
      '/work/volt-tunisia',
    ]

    let found = 0

    for (const path of PAGES) {
      await visit(page, path)

      const measured = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('table')].map((el) => {
          const s = getComputedStyle(el)
          return {
            table: el.className,
            topColor: s.borderTopColor,
            topStyle: s.borderTopStyle,
            topWidth: parseFloat(s.borderTopWidth),
          }
        }),
      )

      found += measured.length

      for (const entry of measured) {
        expect(
          entry.topColor,
          `on ${path}, .${entry.table} is not edged in the structural ` +
            `edge-strong token`,
        ).toBe(TOKENS['edge-strong'])
        expect(entry.topStyle).toBe('solid')
        expect(entry.topWidth).toBeGreaterThan(0)
      }
    }

    expect(
      found,
      'no tables were found on any page, so this test proves nothing',
    ).toBeGreaterThan(0)
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

  test('tints the row under the pointer', async ({ page }) => {
    await visit(page, STUDIES.coachess.path)

    const row = table(page).getByRole('row').first()

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
      'the pointer was placed on the row but :hover did not engage, so this ' +
        'measurement is of the resting state',
    ).toBe(true)

    const hovered = await settledBackground(row)

    expect(
      hovered,
      'the row under the pointer settles back at its resting background, so ' +
        'nothing tints on hover',
    ).not.toBe(resting)

    const restingAlpha = await page.evaluate((c) => window.rgba(c)[3], resting)
    const alpha = await page.evaluate((c) => window.rgba(c)[3], hovered)

    expect(
      restingAlpha,
      'rows are painted at rest, so the table reads as a band of boxes rather ' +
        'than as ruled rows',
    ).toBe(0)
    expect(
      alpha,
      'the hover tint is fully transparent, so nothing changes under the pointer',
    ).toBeGreaterThan(0)
    expect(
      alpha,
      'the hover tint is opaque, so the row reads as a selected block rather ' +
        'than as a tint',
    ).toBeLessThan(1)
  })

  // DELETED: "derives that tint from the ground it is on". It asserted that
  // the row hover tint was mixed from the row's own currentColor, so that one
  // declaration could serve both the paper and the ultramarine grounds. The
  // terminal design has one ground, and the shadcn TableRow hover now uses the
  // panel-lift token at 50 percent, a fixed design colour rather than a
  // currentColor mix. The two-ground problem the test existed to solve is
  // structurally gone, and a tint "derived from the ground" no longer means
  // anything here. What survives is measured in "tints the row under the
  // pointer" above: a row gives feedback, restfully and by tint alone.
})
