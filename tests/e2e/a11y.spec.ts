import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { clientDir } from './support/built'
import { NON_TEXT, hydrated, installProbes } from './support/probes'
import type { AxeResults, Result } from 'axe-core'
import type { Page } from '@playwright/test'

// The accessibility gate.
//
// PRODUCT.md commits to "WCAG 2.2 AA minimum, verified rather than assumed",
// and this is the verification. It is deliberately not the whole story: axe
// finds machine-checkable violations on the state a page happens to be in when
// it runs, and the failures that actually reach people on this site are mostly
// in states it never reaches by itself. So the file is in two halves. The
// first runs axe over every prerendered page. The second drives the page into
// the states axe cannot find on its own and runs it again there, plus the
// measurements no rule engine performs at all.
//
// No `disableRules`, and no `exclude` selectors. If something here is a false
// positive it is proved false with a measurement and the reasoning is written
// down beside it, because a suppression is indistinguishable from a fix in a
// green run.

// WCAG 2.2 AA is cumulative: the 2.2 tag holds only what 2.2 added, so the
// earlier levels have to be listed or the gate silently checks one rule.
// Measured against axe-core 4.12.1: `wcag22aa` alone selects exactly one rule,
// `target-size`.
const WCAG22AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** What the in-page probe reports about whatever currently holds focus. */
type FocusMeasurement = {
  tag: string
  text: string
  width: number
  style: string
  focusVisible: boolean
  ground: string
  ratio: number
}

declare global {
  interface Window {
    measureFocus: () => Promise<FocusMeasurement | null>
  }
}

/** Every path the build prerenders. Kept in step with vite.config.ts. */
const PAGES = [
  { path: '/', label: 'home' },
  { path: '/about', label: 'about' },
  { path: '/contact', label: 'contact' },
  { path: '/writing', label: 'writing' },
  { path: '/work/coachess', label: 'coachess case study' },
  { path: '/work/helmdeck', label: 'helmdeck case study' },
  { path: '/work/volt-tunisia', label: 'volt-tunisia case study' },
] as const

// A violation report a reader can act on without opening a browser. axe's own
// object is large and mostly noise at the point of failure; what is needed is
// which rule, how bad, and the markup it landed on.
const describeViolations = (results: AxeResults) =>
  results.violations
    .map((violation: Result) => {
      const nodes = violation.nodes
        .map((node) => `      ${node.html}\n        ${node.failureSummary}`)
        .join('\n')
      return (
        `  [${violation.impact}] ${violation.id}: ${violation.help}\n` +
        `    ${violation.helpUrl}\n${nodes}`
      )
    })
    .join('\n\n')

// The one thing excluded from every measurement in this file, and the whole
// argument for excluding it.
//
// @tanstack/react-devtools mounts an overlay panel as a direct child of
// <body>, with no id, class or data attribute to hold on to. It contributes 26
// focusable elements and an <h3> "Tanstack Router" to /contact, which is what
// the keyboard walk and the heading order below were failing on.
//
// It is not part of the site and it is not shipped. Measured against the built
// output rather than asserted: the prerendered index.html contains the string
// "devtools" zero times, and the only match anywhere in the client bundle is
// React's own `__REACT_DEVTOOLS_GLOBAL_HOOK__`. The suite runs against the dev
// server, which is the only place this panel exists.
//
// This is a suppression, so it is fenced. "the devtools overlay is not in the
// built output" below reads the emitted files from disk and fails if the
// premise stops holding, and it also pins that the site itself renders nothing
// at this position, so a real <div> added directly to <body> cannot slip
// through the same hole.
const DEVTOOLS = 'body > div'

const scan = (page: Page) =>
  new AxeBuilder({ page })
    .withTags([...WCAG22AA])
    .exclude(DEVTOOLS)
    .analyze()

/** Everything the site itself renders, and nothing the dev server adds. */
const SITE_ROOTS = ['header', 'main', 'footer']

/**
 * The same landmarks, as query prefixes for the traversal tests.
 *
 * Not interchangeable with SITE_ROOTS. The hero is a `<header>` inside
 * `<main>`, so the bare `header` selector matches both the site navigation and
 * the hero, and every focusable element inside the hero would be counted
 * twice, once per matching root. The site nav carries the `.site-nav` class,
 * so this list targets it precisely while still scoping to the same three
 * landmarks.
 */
const QUERY_ROOTS = ['header.site-nav', 'main', 'footer']

const visit = async (page: Page, path: string) => {
  await installProbes(page)
  await page.goto(path)
  // Axe reads computed style and geometry, both of which change when React
  // commits. Scanning the pre-hydration document measures a page no visitor
  // uses. See `hydrated` in support/probes.
  await hydrated(page)
  // The contact form's Send button is really `disabled` until a passive effect
  // runs, and that effect can land after the three-frame settle above. The
  // focus and keyboard walks count focusable elements, so a button that
  // changes its disabled state mid-walk breaks the count. The contact spec
  // waits for the same barrier; this makes the a11y walks wait too. Only the
  // contact page has the button, so the wait is conditional.
  const submit = page.getByTestId('contact-submit')
  if ((await submit.count()) > 0) await expect(submit).toBeEnabled()
}

test.describe('axe, WCAG 2.2 AA, every prerendered page', () => {
  for (const { path, label } of PAGES) {
    test(`${label} (${path}) has no violations`, async ({ page }) => {
      await visit(page, path)

      const results = await scan(page)

      expect(
        results.violations,
        `${path} fails WCAG 2.2 AA:\n\n${describeViolations(results)}\n`,
      ).toEqual([])
    })
  }
})

test.describe('axe, in the states it cannot reach on its own', () => {
  // A form is accessible in its resting state and inaccessible in the one that
  // matters roughly as often as not: the error state adds aria-invalid,
  // aria-describedby, a live region with text in it, and colour carrying
  // meaning. None of that exists on the page axe scans by default.
  test('the contact form, in its error state', async ({ page }) => {
    await visit(page, '/contact')

    // Empty submission, so all three fields fail at once and the live region
    // fills. The button is really disabled until hydration, which `visit`
    // already waited for.
    await page.getByTestId('contact-submit').click()

    // The state has to be real before it is scanned. Asserting on it here is
    // not decoration: a scan that ran against the resting form would pass and
    // prove nothing.
    await expect(page.getByTestId('contact-status')).toHaveAttribute(
      'data-status',
      'invalid',
    )
    await expect(page.getByLabel('$ Name', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByTestId('contact-status')).not.toBeEmpty()

    const results = await scan(page)

    expect(
      results.violations,
      `the contact form in its error state fails WCAG 2.2 AA:\n\n` +
        `${describeViolations(results)}\n`,
    ).toEqual([])
  })

  test('the 404 page', async ({ page }) => {
    await visit(page, '/no-such-page')
    await expect(page.getByTestId('failure-title')).toHaveText(
      'error: page not found',
    )

    const results = await scan(page)

    expect(
      results.violations,
      `the 404 page fails WCAG 2.2 AA:\n\n${describeViolations(results)}\n`,
    ).toEqual([])
  })

  test('the case study 404', async ({ page }) => {
    await visit(page, '/work/not-a-real-case-study')
    await expect(page.getByTestId('not-found')).toBeVisible()

    const results = await scan(page)

    expect(
      results.violations,
      `the case study 404 fails WCAG 2.2 AA:\n\n${describeViolations(results)}\n`,
    ).toEqual([])
  })
})

test.describe('the one exclusion, fenced', () => {
  // Everything above skips `body > div`, which under the dev server is the
  // @tanstack/react-devtools overlay. A suppression that nothing checks is
  // indistinguishable from a fix, so this is the check.
  //
  // Reads the built files rather than the running page, for the reason
  // prerender.spec.ts gives: what ships is on disk, and a browser cannot tell
  // you what is absent from a bundle it is not running.
  test('the devtools overlay is not in the built output', () => {
    const client = clientDir()

    for (const { path } of PAGES) {
      const file =
        path === '/'
          ? join(client, 'index.html')
          : join(client, path, 'index.html')
      const html = readFileSync(file, 'utf8')

      expect(
        html.toLowerCase(),
        `${path} ships devtools markup. The a11y suite excludes ` +
          `${DEVTOOLS} on the grounds that the overlay is a dev-server ` +
          `artefact; if it reaches the built output that exclusion is ` +
          `hiding real markup from every scan in this file`,
      ).not.toContain('devtools')
    }

    // The client bundle, not only the HTML: the panel mounts after hydration,
    // so absence from the served document proves nothing on its own.
    const assets = join(client, 'assets')
    const offenders = readdirSync(assets)
      .filter((name) => name.endsWith('.js'))
      .filter((name) => {
        const source = readFileSync(join(assets, name), 'utf8')
        // React's own global hook is named __REACT_DEVTOOLS_GLOBAL_HOOK__ and
        // is present in every React build. It is not the panel.
        return /devtools/i.test(
          source.replaceAll('__REACT_DEVTOOLS_GLOBAL_HOOK__', ''),
        )
      })

    expect(
      offenders,
      `these client chunks still reference devtools, so the overlay is not ` +
        `tree-shaken out of production and the exclusion above is unsound`,
    ).toEqual([])
  })

  test('the site renders nothing at the excluded position', async ({
    page,
  }) => {
    // The exclusion is positional, so it stays sound only while the site
    // renders nothing there. If a real <div> is ever added as a direct child
    // of <body>, every scan in this file would silently stop covering it.
    await visit(page, '/')

    const own = await page.evaluate(
      () =>
        [...document.body.children]
          .map((el) => el.tagName.toLowerCase())
          .filter((tag) => tag !== 'script'),
      // `div` here is the devtools overlay; anything else is ours.
    )

    expect(
      own.filter((tag) => tag !== 'div'),
      `the site's own top-level elements are expected to be exactly ` +
        `${SITE_ROOTS.join(' and ')}. Anything else at this level is not ` +
        `covered by the scans in this file`,
    ).toEqual(SITE_ROOTS)
  })
})

// ---------------------------------------------------------------------------
// The measurements axe does not make.
// ---------------------------------------------------------------------------

test.describe('the focus ring is visible on the ground it lands on', () => {
  // The defect this exists to stop has already happened once on this site: the
  // ring was hard-coded to --color-ultramarine, which measures 1.00 against an
  // ultramarine field and is therefore in the computed style and invisible on
  // screen, across the 30 to 50 percent of the site that is drenched. A
  // keyboard user lost focus entirely on half the pages and nothing failed.
  //
  // No rule engine catches that. axe does not evaluate :focus-visible styles
  // at all, and the two colours involved are one token apart in a diff. So the
  // ring is measured against the background actually behind it, on every page,
  // not only on the dev harness where the fix was first proved.
  //
  // Focus is driven with the real Tab key, and that is load-bearing rather
  // than pedantry. Measured: calling el.focus() on the Send button leaves
  // :focus-visible unmatched and reports `outline-style: none`, because the
  // selector's heuristic asks how focus arrived and a script is not a
  // keyboard. Tabbing to the same button reports solid / 2px /
  // oklch(0.52 0.19 264) with :focus-visible true. The first reading is an
  // artefact of the probe; only the second is what a keyboard user sees.
  for (const { path, label } of PAGES) {
    test(`${label} (${path})`, async ({ page }) => {
      await visit(page, path)

      // The ground the focus ring is drawn on. The ring is the outline, which
      // sits outside the element's border box (with offset), so it is never
      // drawn on the element's own background: an orange ring around an orange
      // button still sits on the page behind it. Starting the walk at the
      // parent finds that ground. Reading the element's own background would
      // report rgba(0, 0, 0, 0) for every link on the site and measure the
      // ring against nothing, and it would report the button's own fill for a
      // filled control, which the ring does not touch.
      await page.evaluate(() => {
        window.measureFocus = async () => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return null

          let node: HTMLElement | null = el.parentElement
          let ground = getComputedStyle(document.body).backgroundColor
          while (node) {
            const bg = getComputedStyle(node).backgroundColor
            if (window.rgba(bg)[3] > 0) {
              ground = bg
              break
            }
            node = node.parentElement
          }

          // The outline colour can transition in: a shadcn button carries
          // `transition-all`, and its resting outline colour is currentColor,
          // the dark label, so the first frame after focus lands is the old
          // colour, not the ring a user ever sees. Sample until it holds
          // still, the same settle `spec-table.spec.ts` puts on hover.
          const readOutline = () => getComputedStyle(el).outlineColor
          let previous = readOutline()
          let held = 0
          const started = performance.now()
          while (performance.now() - started < 2000) {
            await new Promise((resolve) => setTimeout(resolve, 30))
            const current = readOutline()
            held = current === previous ? held + 1 : 0
            previous = current
            if (held >= 3) break
          }

          const style = getComputedStyle(el)
          return {
            tag: el.tagName.toLowerCase(),
            text: el.textContent.trim().slice(0, 40),
            width: parseFloat(style.outlineWidth),
            style: style.outlineStyle,
            focusVisible: el.matches(':focus-visible'),
            ground,
            ratio: window.contrast(style.outlineColor, ground),
          }
        }
      })

      const stops = await page.evaluate(
        (roots) =>
          roots
            .flatMap((root) => [
              ...document.querySelectorAll<HTMLElement>(
                `${root} :is(a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex])`,
              ),
            ])
            .filter((el) => el.tabIndex >= 0 && el.offsetParent !== null)
            .length,
        QUERY_ROOTS,
      )

      expect(
        stops,
        `${path} has no focusable elements. A page a keyboard cannot enter ` +
          `is also a page a reader cannot leave`,
      ).toBeGreaterThan(0)

      const measurements = []
      for (let i = 0; i < stops; i++) {
        await page.keyboard.press('Tab')
        const m = await page.evaluate(() => window.measureFocus())
        if (m === null) break
        measurements.push(m)
      }
      expect(
        measurements.length,
        `tabbing through ${path} reached ${measurements.length} of ${stops} ` +
          `focusable elements`,
      ).toBe(stops)

      for (const m of measurements) {
        const where = `<${m.tag}> "${m.text}" on ${path}`

        expect(
          m.focusVisible,
          `${where} took focus from the Tab key without matching ` +
            `:focus-visible, so it is focused with nothing drawn`,
        ).toBe(true)
        expect(
          m.style,
          `the focus ring on ${where} has outline-style: ${m.style}, so ` +
            `there is no ring to see`,
        ).not.toBe('none')
        expect(
          m.width,
          `the focus ring on ${where} is ${m.width}px wide`,
        ).toBeGreaterThanOrEqual(2)
        // WCAG 1.4.11 Non-text Contrast. The ring is a user interface
        // component boundary, so the threshold is 3.0, not 4.5.
        expect(
          m.ratio,
          `the focus ring on ${where} measures ${m.ratio.toFixed(2)}:1 ` +
            `against the ${m.ground} it is drawn on. Below ${NON_TEXT} it is ` +
            `not a visible focus indicator, and at 1.00 it is invisible`,
        ).toBeGreaterThanOrEqual(NON_TEXT)
      }
    })
  }
})

test.describe('bypassing the navigation', () => {
  // WCAG 2.4.1, Bypass Blocks. Three navigation links and a button stood
  // between the top of every page and its first word, so a keyboard or switch
  // user paid four stops on every single navigation to reach what they came
  // for.
  for (const { path, label } of PAGES) {
    test(`${label} (${path}) offers a skip link as its first stop`, async ({
      page,
    }) => {
      await visit(page, path)
      await page.evaluate(() => document.body.focus())
      await page.keyboard.press('Tab')

      const skip = page.getByTestId('skip-link')
      await expect(
        skip,
        'the first thing a keyboard reaches is not the skip link',
      ).toBeFocused()

      // Hidden by being moved, never by display or visibility: both of those
      // take it out of the tab order, which deletes the link rather than
      // concealing it. So it has to be on screen once it is focused.
      //
      // Polled, because it travels back under a transition and the first frame
      // after focus is still off screen by design.
      await expect
        .poll(async () => (await skip.boundingBox())?.y ?? null, {
          message: 'the skip link never travelled back on screen',
        })
        .toBeGreaterThanOrEqual(0)

      await expect(skip).toHaveAttribute('href', '#content')
      await expect(page.locator('main#content')).toHaveCount(1)
    })

    test(`${label} (${path}) lands focus on content, clear of the bar`, async ({
      page,
    }) => {
      // WCAG 2.2 SC 2.4.11, Focus Not Obscured. The navigation is sticky with
      // a backdrop blur, so anything scrolled flush to the top of the viewport
      // is drawn underneath it, focus ring included.
      //
      // Axe cannot see this: the wcag22aa tag selects exactly one rule in
      // axe-core 4.12.1 and it is target-size, which is why this assertion is
      // written by hand next to the focus ring walk.
      await visit(page, path)
      await page.evaluate(() => document.body.focus())
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      const landed = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null
        const nav = document.querySelector('header.site-nav')
        return {
          id: active?.id ?? null,
          top: active?.getBoundingClientRect().top ?? null,
          navBottom: nav?.getBoundingClientRect().bottom ?? 0,
        }
      })

      expect(
        landed.id,
        'following the skip link did not move focus to the content',
      ).toBe('content')
      expect(
        landed.top,
        `content is at ${landed.top}px with the bar ending at ` +
          `${landed.navBottom}px, so the focused element is behind it`,
      ).toBeGreaterThanOrEqual(landed.navBottom)
    })
  }
})

test.describe('the keyboard', () => {
  for (const { path, label } of PAGES) {
    test(`${label} (${path}) is traversable and traps nothing`, async ({
      page,
    }) => {
      await visit(page, path)

      // The elements a keyboard should reach, in the order the DOM presents
      // them. Tab order is "logical" here in the strict sense: it follows the
      // reading order, because nothing on this site sets a positive tabindex.
      const expected = await page.evaluate(
        (roots) =>
          roots
            .flatMap((root) => [
              ...document.querySelectorAll<HTMLElement>(
                `${root} :is(a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex])`,
              ),
            ])
            .filter((el) => el.tabIndex >= 0 && el.offsetParent !== null)
            .map((el, index) => {
              el.dataset.tabProbe = String(index)
              return String(index)
            }),
        QUERY_ROOTS,
      )

      expect(
        expected.length,
        `${path} has nothing focusable, so this proves nothing`,
      ).toBeGreaterThan(0)

      // Walk forward through every one of them, from the top of the document.
      await page.evaluate(() => document.body.focus())
      await page.keyboard.press('Tab')

      const visited: Array<string> = []
      let strayed: string | null = null
      for (const _stop of expected) {
        const landed = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          return {
            probe: el?.getAttribute('data-tab-probe') ?? null,
            // Named, so a failure says what took focus instead of only that
            // something did.
            what: el
              ? `<${el.tagName.toLowerCase()}${
                  el.id ? ` id="${el.id}"` : ''
                }> "${el.textContent.trim().slice(0, 30)}"`
              : 'nothing',
          }
        })
        // A null probe means focus left the set, which on these pages means it
        // reached the browser chrome. Record what it was and stop, rather than
        // recording a phantom.
        if (landed.probe === null) {
          strayed = landed.what
          break
        }
        visited.push(landed.probe)
        await page.keyboard.press('Tab')
      }

      expect(
        visited,
        `tab order on ${path} does not follow the reading order of the ` +
          `document. Nothing on this site sets a positive tabindex, so the ` +
          `two should be identical.` +
          (strayed
            ? ` The walk stopped after ${visited.length} of ${expected.length} ` +
              `stops, when Tab moved focus to ${strayed}, which is not in the ` +
              `set of elements a keyboard was expected to reach.`
            : ''),
      ).toEqual(expected)

      // No trap: from the last element, Shift+Tab has to walk back out. A
      // component that swallows the key would leave focus where it was.
      await page.evaluate(() => {
        const last = [
          ...document.querySelectorAll<HTMLElement>('[data-tab-probe]'),
        ].at(-1)
        last?.focus()
      })
      const before = await page.evaluate(
        () => document.activeElement?.getAttribute('data-tab-probe') ?? null,
      )
      await page.keyboard.press('Shift+Tab')
      const after = await page.evaluate(
        () => document.activeElement?.getAttribute('data-tab-probe') ?? null,
      )

      expect(
        after,
        `Shift+Tab from the last focusable element on ${path} left focus ` +
          `where it was, so something is holding it`,
      ).not.toBe(before)
    })
  }
})

test.describe('every interactive element has an accessible name', () => {
  for (const { path, label } of PAGES) {
    test(`${label} (${path})`, async ({ page }) => {
      await visit(page, path)

      // Playwright renders the ARIA tree as YAML, and a node with no
      // accessible name is emitted bare: `- link` rather than `- link "..."`.
      // That is the accessibility tree the browser actually built, not a
      // guess at what it would contain, which is why this is not done by
      // reading attributes off the DOM.
      const trees = await Promise.all(
        QUERY_ROOTS.map((root) => page.locator(root).ariaSnapshot()),
      )
      const snapshot = trees.join('\n')

      const nameless = snapshot
        .split('\n')
        .map((line) => line.trim())
        .filter((line) =>
          /^- (link|button|textbox|combobox|checkbox|radio|slider|searchbox|spinbutton|menuitem|tab|switch):?$/.test(
            line,
          ),
        )

      expect(
        nameless,
        `${path} has interactive nodes with no accessible name. A screen ` +
          `reader announces these as their role and nothing else:\n` +
          `${nameless.join('\n')}\n\nFull tree:\n${snapshot}`,
      ).toEqual([])
    })
  }
})

test.describe('headings', () => {
  for (const { path, label } of PAGES) {
    test(`${label} (${path}) has one h1 and no skipped level`, async ({
      page,
    }) => {
      await visit(page, path)

      const headings = await page.evaluate(
        (roots) =>
          roots
            .flatMap((root) => [
              ...document.querySelectorAll(
                `${root} :is(h1, h2, h3, h4, h5, h6)`,
              ),
            ])
            .map((el) => ({
              level: Number(el.tagName.slice(1)),
              text: el.textContent.trim().slice(0, 60),
            })),
        QUERY_ROOTS,
      )

      const h1s = headings.filter((h) => h.level === 1)
      expect(
        h1s.map((h) => h.text),
        `${path} must have exactly one h1: it is the document's title in the ` +
          `accessibility tree and in search results`,
      ).toHaveLength(1)

      expect(
        headings[0]?.level,
        `the first heading on ${path} is an h${headings[0]?.level}, so the ` +
          `page opens below its own title`,
      ).toBe(1)

      // Sequential descent. Going back up any number of levels is fine, going
      // down more than one at a time is a skipped level.
      for (let i = 1; i < headings.length; i++) {
        const previous = headings[i - 1]
        const current = headings[i]
        expect(
          current.level - previous.level,
          `${path} jumps from h${previous.level} "${previous.text}" to ` +
            `h${current.level} "${current.text}", skipping a level`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
})

test.describe('images and placeholders carry meaningful alternative text', () => {
  for (const { path, label } of PAGES) {
    test(`${label} (${path})`, async ({ page }) => {
      await visit(page, path)

      const described = await page.evaluate(
        (roots) =>
          roots
            .flatMap((root) => [
              ...document.querySelectorAll<HTMLElement>(
                `${root} :is(img, [role="img"])`,
              ),
            ])
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              // The alt attribute for a real image, the label for anything
              // standing in for one.
              name:
                el.getAttribute('alt') ?? el.getAttribute('aria-label') ?? null,
              decorative:
                el.getAttribute('alt') === '' ||
                el.getAttribute('aria-hidden') === 'true',
              src: el.getAttribute('src') ?? '',
            })),
        QUERY_ROOTS,
      )

      for (const image of described) {
        if (image.decorative) continue
        expect(
          image.name,
          `<${image.tag}> ${image.src} on ${path} has no alternative text. ` +
            `PRODUCT.md: alt text is written in the site's voice, describing ` +
            `what is shown rather than naming a file`,
        ).toBeTruthy()
        expect(
          (image.name ?? '').trim().length,
          `<${image.tag}> ${image.src} on ${path} has empty alternative text ` +
            `without being marked decorative`,
        ).toBeGreaterThan(0)
        // Naming the file is the failure mode PRODUCT.md calls out by name.
        expect(
          image.name,
          `the alternative text on ${path} is a filename, not a description`,
        ).not.toMatch(/\.(png|jpe?g|svg|webp|gif)$/i)
      }
    })
  }
})
