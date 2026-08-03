import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BODY_TEXT, installProbes, styleOf } from './support/probes'

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
const SUBLINE = 'Available for freelance product engineering.'

const PROOF_LINKS = [
  { label: 'coachess.net', href: 'https://coachess.net' },
  { label: 'app.coachess.net', href: 'https://app.coachess.net' },
  { label: 'live.coachess.net', href: 'https://live.coachess.net' },
]

// Content order, from the `order` field in content/work/*.mdx. Restated rather
// than loaded, so a loader that stopped sorting fails here.
const PILLARS = [
  { slug: 'volt-tunisia', title: 'VoltTunisia' },
  { slug: 'helmdeck', title: 'Helmdeck' },
  { slug: 'coachess', title: 'CoaChess' },
]

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
    await expect(hero.getByText(SUBLINE, { exact: true })).toHaveCount(1)
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
        'It was rejected at four, two of them a couple of words long; the ' +
        'measure is capped at 16ch to put it on three',
    ).toBe(3)
  })

  test('offers exactly two ways forward, to the work and to the owner', async ({
    page,
  }) => {
    const hero = page.getByTestId('hero')

    await expect(
      hero.getByRole('link', { name: 'See the work', exact: true }),
    ).toHaveAttribute('href', '/work/coachess')
    await expect(
      hero.getByRole('link', { name: 'Hire me', exact: true }),
    ).toHaveAttribute('href', '/contact')
  })

  test('is drenched, and sets its own text colour on that ground', async ({
    page,
  }) => {
    // DESIGN.md, the inheritance hazard: the base layer sets color on body, so
    // a section that sets only a background inherits ink at 3.02 against
    // ultramarine and fails body text. Measured rather than asserted against a
    // class name, because the failure is a ratio and not a selector.
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
        `${measured.ratio.toFixed(2)}. Inherited ink on ultramarine is 3.02; ` +
        `every drenched field has to set its text colour explicitly`,
    ).toBeGreaterThanOrEqual(BODY_TEXT)
  })
})

test.describe('proof strip', () => {
  test('carries exactly the three shipping surfaces, addressed', async ({
    page,
  }) => {
    const links = page.getByTestId('proof-link')

    // Exactly three. PRODUCT.md builds the strip as the site's primary
    // evidence; a fourth link nobody vetted, or a missing third, both weaken
    // it silently.
    await expect(
      links,
      'the proof strip does not carry exactly three links',
    ).toHaveCount(PROOF_LINKS.length)

    for (const [i, expected] of PROOF_LINKS.entries()) {
      await expect(links.nth(i)).toHaveText(expected.label)
      await expect(
        links.nth(i),
        `proof link ${i} does not point at the surface it names. A URL ` +
          `printed as text is a claim a visitor cannot check`,
      ).toHaveAttribute('href', expected.href)
    }
  })

  test('labels itself, and sets the addresses as data', async ({ page }) => {
    const strip = page.getByTestId('proof-strip')

    await expect(strip.getByText('Shipping now', { exact: true })).toHaveCount(
      1,
    )

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

  test('sits on the same drenched field as the hero', async ({ page }) => {
    const grounds = await page.evaluate(() => {
      const ground = (selector: string) => {
        let node = document.querySelector<HTMLElement>(selector)
        while (node) {
          const bg = getComputedStyle(node).backgroundColor
          if (window.rgba(bg)[3] === 1) return bg
          node = node.parentElement
        }
        return null
      }
      return {
        hero: ground('[data-testid="hero"]'),
        strip: ground('[data-testid="proof-strip"]'),
        paper: getComputedStyle(document.documentElement).getPropertyValue(
          '--color-paper',
        ),
      }
    })

    expect(
      grounds.strip,
      'the proof strip is on a different ground from the hero, so a neutral ' +
        'band was hedged in between them',
    ).toBe(grounds.hero)
    expect(
      grounds.strip,
      'the proof strip is on paper, not on the drenched hero field',
    ).not.toBe(grounds.paper.trim())
  })
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

  test('heads the section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Selected work', exact: true }),
    ).toHaveCount(1)
  })
})

test.describe('capabilities', () => {
  test('states three, as headings with prose beneath', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'What I do', exact: true }),
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

  test('commits at least 30 percent of its surface to colour', async ({
    page,
  }) => {
    // DESIGN.md, Color: one saturated colour carries 30 to 50 percent of
    // surface area through full-bleed section fields, "not a trim accent", and
    // the alternation "cannot quietly erode during implementation". This is
    // what stops it eroding: it is measured, in the browser, against whatever
    // sections exist.
    const share = await page.evaluate(() => {
      let drenched = 0
      let total = 0
      for (const el of document.querySelectorAll<HTMLElement>(
        '[data-testid^="section-field-"]',
      )) {
        const h = el.getBoundingClientRect().height
        total += h
        if (el.dataset.tone !== 'paper') drenched += h
      }
      return total ? drenched / total : 0
    })

    expect(
      share,
      `${(share * 100).toFixed(0)} percent of the page is drenched. Below 30 ` +
        `the colour is a trim accent rather than the commitment DESIGN.md ` +
        `specifies`,
    ).toBeGreaterThanOrEqual(0.3)
  })
})
