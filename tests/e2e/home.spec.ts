import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BODY_TEXT, installProbes, styleOf } from './support/probes'
import { getCaseStudies } from '#/lib/content'

// The home page, pinned against a real browser.
//
// Copy is restated here verbatim rather than imported from the components it
// renders. A test that reads its expectations out of the module under test
// cannot fail when both are wrong together, and this page is the one place on
// the site where the exact words were specified by the owner.
//
// The proof links point off-origin and are never clicked. tests/e2e/no-third-
// party.spec.ts fails on ANY off-origin request, so navigating one of these
// would turn a passing suite red in a file that has nothing to do with this
// page.

const NAME = 'Mohamed Elhedi Ben Yedder'
const CREDENTIAL = 'CTO and co-founder of CoaChess'
const DISPLAY = 'I build and ship full stack products, end to end.'
// The credential line of the hero. The full sentence is
// "CTO and co-founder of CoaChess / available for freelance product
// engineering"; the two halves are asserted separately because the first is
// set in the mono log-line's amber <b> and the second is the plain tail.
const SUBLINE = 'available for freelance product engineering'

// Read from the same frontmatter the page renders and scripts/verify-links.mjs
// checks, never restated. A hardcoded copy made this a change detector: it
// failed the day a fourth CoaChess surface was published, which is a content
// edit and not a regression. What still matters, and is asserted below, is
// that every surface declared reaches the page as a real link.
const PROOF_LINKS = getCaseStudies().flatMap((study) => study.surfaces)

// Content order, from the `order` field in content/work/*.mdx. Restated rather
// than loaded, so a loader that stopped sorting fails here.
// Derived from the `order` field in content/work/*.mdx, never restated. A
// hardcoded copy is a change detector: it fails when the owner reorders his
// own case studies, which is an editorial decision and not a regression. What
// still matters, and is asserted below, is that the page paints them in the
// order the content declares.
const PILLARS = getCaseStudies().map((study) => ({
  slug: study.slug,
  title: study.title,
}))

const CAPABILITIES = [
  'Product engineering',
  'Systems with hard rules',
  'Real time and infrastructure',
]

test.beforeEach(async ({ page }) => {
  await installProbes(page)
  await page.goto('/')
})

test.describe('hero', () => {
  test('names the owner in the page heading', async ({ page }) => {
    const h1 = page.locator('h1')

    await expect(
      h1,
      'the page has no single <h1>. A document with none has no accessible ' +
        'title, and one with several has no primary one',
    ).toHaveCount(1)
    await expect(h1, 'the <h1> does not name the owner').toHaveText(NAME)
  })

  test('states the credential and the offer', async ({ page }) => {
    const hero = page.getByTestId('hero')

    await expect(hero.getByText(CREDENTIAL, { exact: true })).toHaveCount(1)
    await expect(hero.getByText(SUBLINE, { exact: false })).toHaveCount(1)
  })

  test('sets the display line at the display step, expanded, on display leading', async ({
    page,
  }) => {
    // Four facts that are only correct together. DESIGN.md gives the display
    // step its own leading token precisely because --text-display reaches
    // 6.4rem and would otherwise inherit the body value of 1.6, producing a
    // 10rem line box; it sets the width axis to the 112% the rest of the
    // structural type uses; and it caps the measure so the sentence breaks
    // into three lines rather than four. A line that loses any one of them
    // still renders.
    const line = page.getByTestId('hero-display')

    await expect(line).toHaveText(DISPLAY)

    const measured = await line.evaluate((el) => {
      const s = getComputedStyle(el)
      // The expected size is measured from the token itself rather than
      // computed from the viewport, so this survives a change to the clamp.
      const probe = document.createElement('span')
      probe.style.cssText =
        'position:absolute;visibility:hidden;font-size:var(--text-display)'
      document.body.append(probe)
      const expected = parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()

      return {
        fontSize: parseFloat(s.fontSize),
        expected,
        ratio: parseFloat(s.lineHeight) / parseFloat(s.fontSize),
        stretch: parseFloat(s.fontStretch),
        family: s.fontFamily,
        // Line count, derived from the rendered box rather than from the copy.
        // The measure is the fix for the cramped headline and it is the part
        // with no computed property of its own: `max-inline-size: 16ch` is
        // still in the style when the wrap it exists to produce is not, if the
        // width axis or the size moves under it.
        lines: Math.round(
          el.getBoundingClientRect().height / parseFloat(s.lineHeight),
        ),
      }
    })

    expect(
      measured.fontSize,
      'the hero display line is not set at --text-display',
    ).toBeCloseTo(measured.expected, 1)
    expect(
      measured.ratio,
      'the display line is not on --leading-display (1.02). Below 1 the ' +
        'descenders of one line reach the caps of the next, and at the body ' +
        'value of 1.6 the line box is two thirds taller than the type',
    ).toBeCloseTo(1.02, 2)
    expect(
      measured.stretch,
      'the display line is not on Archivo\u2019s 112% width instance, so it is ' +
        'not the Expanded cut DESIGN.md reserves for display sizes',
    ).toBeCloseTo(112, 1)
    expect(measured.family, 'the display line is not set in Archivo').toContain(
      'Archivo',
    )
    expect(
      measured.lines,
      `the display line renders on ${measured.lines} lines at this viewport. ` +
        'The measure is capped at 18ch to keep the statement to two or three ' +
        'lines; four short lines is the cramped state it exists to prevent',
    ).toBeLessThanOrEqual(3)
    expect(
      measured.lines,
      'the display line does not wrap at all',
    ).toBeGreaterThanOrEqual(2)
  })

  test('offers exactly two ways forward, to the work and to the owner', async ({
    page,
  }) => {
    const hero = page.getByTestId('hero')

    await expect(
      hero.getByRole('link', { name: 'See the work', exact: true }),
    ).toHaveAttribute('href', '/work/coachess')
    await expect(
      hero.getByRole('link', { name: 'Start a conversation', exact: true }),
    ).toHaveAttribute('href', '/contact')
  })

  test('puts exactly one filled action on the page', async ({ page }) => {
    // Two orange fills within 200 vertical pixels, pointing at different
    // destinations, is not a hierarchy: it is two primaries. The larger one
    // used to go to the exploratory action while the conversion was
    // simultaneously the small filled thing in the nav and the large hollow
    // thing in the hero.
    //
    // Counted by the variant the button component records, rather than by
    // colour, because the assertion is about intent and one fill is the
    // intent.
    const filled = page.locator('[data-slot="button"][data-variant="default"]')

    await expect(
      filled,
      'more than one action on the home page is styled as the primary',
    ).toHaveCount(1)
    await expect(filled).toHaveAccessibleName('See the work')
  })

  test('separates its two actions instead of welding them together', async ({
    page,
  }) => {
    // The regression this exists for: `.hero-actions` was referenced by the
    // hero and defined nowhere. Both buttons are inline-flex, JSX strips the
    // newline between them, and a div with no display and no gap leaves them
    // touching at exactly 0px. It shipped above the fold on the home page and
    // every existing assertion passed, because they all asked what the buttons
    // said rather than where they were.
    //
    // Measured from the painted boxes rather than from the computed `gap`, so
    // any future layout that separates them correctly passes and any that runs
    // them together fails, whatever properties it used to get there.
    const actions = page.getByTestId('hero-actions')
    const buttons = actions.getByRole('link')

    await expect(buttons).toHaveCount(2)

    const first = await buttons.nth(0).boundingBox()
    const second = await buttons.nth(1).boundingBox()
    expect(first, 'the first hero action has no painted box').not.toBeNull()
    expect(second, 'the second hero action has no painted box').not.toBeNull()

    // Wrapped onto two lines on a narrow viewport is a pass: the check is that
    // they are separated on the axis they share, not that they sit side by side.
    const wrapped = second!.y >= first!.y + first!.height
    const horizontal = second!.x - (first!.x + first!.width)

    expect(
      wrapped || horizontal >= 8,
      `the hero actions are ${horizontal.toFixed(1)}px apart. Two adjacent ` +
        `buttons with no gap read as one two-tone slab`,
    ).toBe(true)
  })

  test('keeps its statement legible on the ground it stands on', async ({
    page,
  }) => {
    // DESIGN.md: the base layer sets color on body, and every text token is
    // measured against the ground. Measured rather than asserted against a
    // class name, because the failure is a ratio and not a selector: if the
    // hero text ever drops below the body threshold it is a contrast failure,
    // whatever class carries it.
    const measured = await page.getByTestId('hero').evaluate((el) => {
      let node: Element | null = el
      let ground = 'rgba(0, 0, 0, 0)'
      while (node) {
        const bg = getComputedStyle(node).backgroundColor
        if (window.rgba(bg)[3] === 1) {
          ground = bg
          break
        }
        node = node.parentElement
      }
      return {
        ground,
        color: getComputedStyle(el).color,
        ratio: window.contrast(getComputedStyle(el).color, ground),
      }
    })

    expect(
      measured.ratio,
      `hero text is ${measured.color} on ${measured.ground}, which measures ` +
        `${measured.ratio.toFixed(2)}. Text on the ground must clear the body ` +
        `threshold`,
    ).toBeGreaterThanOrEqual(BODY_TEXT)
  })
})

test.describe('proof strip', () => {
  test('carries every declared shipping surface, addressed', async ({
    page,
  }) => {
    const links = page.getByTestId('proof-link')

    // One link per declared surface, no more and no fewer. PRODUCT.md builds
    // the strip as the site's primary evidence: a link nobody vetted, or a
    // declared surface silently dropped, both weaken it.
    await expect(
      links,
      'the proof strip does not carry one link per declared surface',
    ).toHaveCount(PROOF_LINKS.length)

    for (const [i, expected] of PROOF_LINKS.entries()) {
      // Each chip carries its status chip and then the address. The address
      // is asserted as contained rather than as the whole text, because the
      // live status precedes it inside the same chip.
      await expect(links.nth(i)).toContainText(expected.label)
      await expect(
        links.nth(i),
        `proof link ${i} does not point at the surface it names. A URL ` +
          `printed as text is a claim a visitor cannot check`,
      ).toHaveAttribute('href', expected.href)
      await expect(links.nth(i).getByTestId('proof-status')).toHaveCount(1)
    }
  })

  test('reports a status, one of live, offline or checking, never nothing', async ({
    page,
  }) => {
    const strip = page.getByTestId('proof-strip')

    // The strip's whole job is to check these addresses for real, at request
    // time, and render the honest result. The initial render is "checking";
    // the result arrives over the wire. What it must never do is stay empty,
    // and what a test must never do is assert a specific colour, because live
    // and offline are both legitimate outcomes on a real network.
    for (const link of await strip.getByTestId('proof-link').all()) {
      await expect(link.getByTestId('proof-status')).toHaveText(
        /LIVE|offline|checking|unchecked/,
      )
    }
  })

  test('claims nothing has been checked until something has', async ({
    page,
  }) => {
    // PRODUCT.md's proof-over-claim rule, applied to the element that exists
    // to carry the proof. The label used to read "4 surfaces, checked just
    // now" in the prerendered document, above four chips that all said
    // checking. Nothing had been checked. The phrase was a claim about work
    // that had not happened yet, on the one element whose credibility is the
    // entire strategic argument for the site.
    const label = page.getByTestId('proof-label')

    await expect(label).not.toContainText('checked just now')

    // The summary is the live region, so a screen reader user gets one
    // assembled answer rather than four chip fragments nobody put together.
    await expect(label).toHaveAttribute('aria-live', 'polite')
    await expect(label).toHaveAttribute('role', 'status')

    // Whatever the network did, the phase is one of the three the component
    // knows how to say, and the label agrees with it.
    await expect(label).toHaveAttribute(
      'data-phase',
      /checking|answered|unreachable/,
    )
    await expect(label).toHaveText(
      /checking \d+ addresses|\d+ of \d+ responding|the check did not complete/,
    )
  })

  test('lands in the first screen of a laptop', async ({ page }) => {
    // PRODUCT.md's strategic premise: the owner's recent work is private, a
    // visitor who checks GitHub is misled, and "the site therefore has to
    // carry the proof itself, through live links". A visitor with two minutes
    // decides on the first screen, so proof that arrives after a scroll is
    // proof that arrives after the decision.
    //
    // 1440x745 is a 13 inch laptop with a bookmarks bar, which is the smallest
    // laptop viewport worth designing for. The strip used to begin at 851px
    // here, wholly off-screen, because it borrowed the section padding token
    // inside a parent that already carried it and sat under a hero whose
    // identity block also carried it.
    //
    // The bar is that the evidence is legible without scrolling, not that
    // every chip in a wrapped row is. The label plus the first row of chips is
    // what a two minute scan actually reads.
    await page.setViewportSize({ width: 1440, height: 745 })
    await page.goto('/')

    const box = await page.getByTestId('proof-strip').boundingBox()
    expect(box, 'the proof strip has no painted box').not.toBeNull()

    expect(
      box!.y,
      `the proof strip starts at ${box!.y.toFixed(0)}px on a 745px viewport. ` +
        `The evidence has to be on the screen where the decision is made`,
    ).toBeLessThanOrEqual(745 - 80)

    // And on an ordinary laptop it is there in full.
    await page.setViewportSize({ width: 1440, height: 820 })
    const roomy = await page.getByTestId('proof-strip').boundingBox()
    expect(
      roomy!.y + roomy!.height,
      `the proof strip ends at ${(roomy!.y + roomy!.height).toFixed(0)}px on ` +
        `an 820px viewport`,
    ).toBeLessThanOrEqual(820)
  })

  test('sets the addresses as data', async ({ page }) => {
    // DESIGN.md: Martian Mono strictly for data, and it lists link URLs among
    // the places data type belongs.
    const family = (
      await styleOf(page.getByTestId('proof-link').first(), ['font-family'])
    )['font-family']
    expect(
      family,
      'proof link addresses are not set in Martian Mono',
    ).toContain('Martian Mono')
  })
  // DELETED: "sits on the same drenched field as the hero". The previous
  // design alternated a drenched hero field with a neutral paper ground, and
  // this test held the proof strip to the hero's ground so nobody hedged a
  // neutral band between them. The terminal design has one ground for the
  // whole document; hero and proof strip cannot disagree about it.
})

test.describe('selected work', () => {
  test('links the three pillars, in content order', async ({ page }) => {
    const links = page.getByTestId('pillar-link')

    await expect(links).toHaveCount(PILLARS.length)

    for (const [i, pillar] of PILLARS.entries()) {
      await expect(
        links.nth(i),
        `pillar ${i} is not in the order the content loader returns`,
      ).toHaveAttribute('href', `/work/${pillar.slug}`)
      await expect(links.nth(i)).toContainText(pillar.title)
    }
  })

  test('heads the section with its path', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Work that ships', exact: true }),
    ).toHaveCount(1)
  })
})

test.describe('capabilities', () => {
  test('states three, as headings with prose beneath', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'What I actually do', exact: true }),
    ).toHaveCount(1)

    const statements = page.getByTestId('capability')
    await expect(statements).toHaveCount(CAPABILITIES.length)

    for (const [i, heading] of CAPABILITIES.entries()) {
      await expect(statements.nth(i).getByRole('heading')).toHaveText(heading)
      // Prose, not a caption. The banned pattern DESIGN.md names is "icon plus
      // heading plus two lines, repeated", so the length of the paragraph is
      // the thing that distinguishes a statement from a card.
      const words = (await statements.nth(i).locator('p').innerText())
        .trim()
        .split(/\s+/).length
      expect(
        words,
        `capability ${i} is ${words} words. A statement this short is the ` +
          `icon-heading-two-lines card DESIGN.md bans, not prose`,
      ).toBeGreaterThan(25)
    }
  })
})

test.describe('contact', () => {
  test('asks for the conversation and gives an address to start it', async ({
    page,
  }) => {
    const contact = page.getByTestId('contact')

    await expect(
      contact.getByRole('heading', { name: 'Start a conversation' }),
    ).toHaveCount(1)
    await expect(
      contact.getByRole('link', { name: 'hello@mehby.com', exact: true }),
    ).toHaveAttribute('href', 'mailto:hello@mehby.com')
  })
})

test.describe('standing rules', () => {
  // These four are the rules PRODUCT.md and DESIGN.md call non-negotiable.
  // They are asserted structurally, against whatever the page renders, so a
  // section added later is covered without anybody remembering to extend a
  // list.

  const shortLabelSiblings = (page: Page) =>
    page.evaluate(() => {
      const enclosed = (el: HTMLElement) => {
        const s = getComputedStyle(el)
        return (
          window.rgba(s.backgroundColor)[3] > 0 ||
          ['top', 'right', 'bottom', 'left'].some(
            (side) =>
              parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0 &&
              s.getPropertyValue(`border-${side}-style`) !== 'none',
          )
        )
      }

      const groups = new Map<Element, number>()

      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        const text = el.textContent.trim()
        // A badge is a short label with nothing nested inside it that carries
        // its own text.
        if (!text || text.length > 24) continue
        if ([...el.children].some((c) => c.textContent.trim())) continue

        // Climb to the outermost element that still contains only this label,
        // and group by ITS parent. Without this, the commonest markup for a
        // badge wall, `ul > li > span`, defeats the check entirely: every span
        // has a different parent, so no group ever reaches three.
        let top = el
        const chain: Array<HTMLElement> = [el]
        while (
          top.parentElement &&
          top.parentElement !== document.body &&
          top.parentElement.textContent.trim() === text
        ) {
          top = top.parentElement
          chain.push(top)
        }

        // Enclosure is checked anywhere on that chain, because the fill is as
        // often on the wrapper as on the label.
        if (!chain.some(enclosed)) continue
        if (!top.parentElement) continue

        groups.set(top.parentElement, (groups.get(top.parentElement) ?? 0) + 1)
      }

      return Math.max(0, ...groups.values())
    })

  test('carries no badge wall', async ({ page }) => {
    // PRODUCT.md, Standing Rules: no fixed stack list, no badge wall, no logo
    // grid, no skills bar. Capability is expressed in prose and in per-project
    // tables. Detected by shape rather than by vocabulary, because the rule is
    // about the pattern and not about which framework names appear in it.
    const largest = await shortLabelSiblings(page)

    expect(
      largest,
      `${largest} enclosed short labels share a parent. Three or more is the ` +
        `badge wall PRODUCT.md bans as "a checklist rather than judgement"`,
    ).toBeLessThan(3)
  })

  test('carries no metric hero', async ({ page }) => {
    // DESIGN.md bans the big-number metric hero and PRODUCT.md bans metrics
    // outright, including figures already public elsewhere. The structural
    // half: no number set larger than a section heading.
    const oversized = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.cssText =
        'position:absolute;visibility:hidden;font-size:var(--text-h2)'
      document.body.append(probe)
      const threshold = parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()

      return [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => ![...el.children].length)
        .filter((el) => /^[\d.,%+\s]+$/.test(el.textContent.trim()))
        .filter((el) => el.textContent.trim().length > 0)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) >= threshold)
        .map((el) => el.textContent)
    })

    expect(
      oversized,
      'a number is set at or above the section-heading step, which is the ' +
        'metric hero DESIGN.md bans',
    ).toEqual([])
  })

  test('states no metric in its copy', async ({ page }) => {
    const text = await page.locator('body').innerText()
    const metric = text.match(/\d[\d,.]*\s*(?:%|\+|k\b|m\b|x\b)|\b\d{5,}\b/i)

    expect(
      metric?.[0] ?? null,
      'the copy states a figure. PRODUCT.md: no user counts, revenue, ' +
        'headcount, growth or engagement numbers, including public ones',
    ).toBeNull()
  })

  test('uses no em dash', async ({ page }) => {
    const text = await page.locator('body').innerText()

    expect(
      text.includes('\u2014'),
      'PRODUCT.md bans em dashes in every piece of interface copy',
    ).toBe(false)
  })
  // DELETED: "commits at least 30 percent of its surface to colour". It
  // measured the share of the page carried by non-paper section fields, which
  // was how the previous design enforced its committed colour bands. The
  // terminal design commits its one colour differently: a warm near-black
  // ground for the whole document with orange as a fill and display accent.
  // There are no section-field bands to measure, and the ground is 100 percent
  // of the surface by construction. The accent's legibility is gated instead,
  // pair by pair, by scripts/contrast.mjs.
})
