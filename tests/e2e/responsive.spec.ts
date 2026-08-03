import { expect, test } from '@playwright/test'
import { hydrated } from './support/probes'
import type { Page } from '@playwright/test'

// The three widths, and what each one is standing in for.
//
// DESIGN.md's grid ladder is 3 columns, then 6 at 48rem, then 12 at 64rem, so
// each of these sits in a different tier and the set exercises all three
// rather than three points inside one.
//
//   375   a phone, below the first breakpoint, 3 columns
//   768   exactly 48rem, the first breakpoint, 6 columns
//   1280  above 64rem, 12 columns
//
// 768 is deliberately the breakpoint value itself and not a pixel either side
// of it. `(width >= 48rem)` is inclusive, and a ladder written with a `>` or
// with an off-by-one boundary is correct everywhere except exactly here.
const WIDTHS = [
  { width: 375, columns: 3, label: 'phone' },
  { width: 768, columns: 6, label: 'the first breakpoint' },
  { width: 1280, columns: 12, label: 'desktop' },
] as const

const PAGES = [
  '/',
  '/about',
  '/contact',
  '/writing/',
  '/work/coachess',
  '/work/helmdeck',
  '/work/volt-tunisia',
] as const

const visit = async (page: Page, path: string, width: number) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(path)
  await hydrated(page)
  // Both faces are wider than the fallback, so a measurement taken before the
  // swap is a measurement of a layout the visitor never has.
  await page.evaluate(() => document.fonts.ready)
}

test.describe('no horizontal overflow', () => {
  for (const { width, label } of WIDTHS) {
    for (const path of PAGES) {
      test(`${path} at ${width} (${label})`, async ({ page }) => {
        await visit(page, path, width)

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          return {
            by: doc.scrollWidth - doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
          }
        })

        expect(
          overflow.by,
          `${path} scrolls ${overflow.by}px sideways at ${width}px ` +
            `(${overflow.scrollWidth} of content in ${overflow.clientWidth})`,
        ).toBeLessThanOrEqual(0)
      })
    }
  }
})

test.describe('nothing spills out of the column it was given', () => {
  // A page can have no horizontal scroll and still be wrong: an element wider
  // than its grid track sits over its neighbour or over the page margin, and
  // the drawn hairlines stop lining up with the content, which is the one
  // thing DESIGN.md calls the site's voice.
  //
  // The clipped, visually hidden elements are skipped by name. Both are meant
  // to have content wider than their 1px box: .spec-caption is the table's
  // accessible name and .honeypot is the spam trap, and neither is painted.
  for (const { width } of WIDTHS) {
    for (const path of PAGES) {
      test(`${path} at ${width}`, async ({ page }) => {
        await visit(page, path, width)

        const spills = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main *, footer *')]
            .filter((el) => !el.closest('.spec-caption, .honeypot'))
            .filter((el) => el.getBoundingClientRect().width > 0)
            .filter((el) => {
              const parent = el.parentElement
              if (!parent) return false
              const box = el.getBoundingClientRect()
              const bounds = parent.getBoundingClientRect()
              // One pixel of tolerance, because subpixel layout rounds.
              return box.right > bounds.right + 1 || box.left < bounds.left - 1
            })
            .map((el) => {
              const box = el.getBoundingClientRect()
              const bounds = el.parentElement!.getBoundingClientRect()
              return (
                `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} ` +
                `spans ${box.left.toFixed(0)}..${box.right.toFixed(0)} ` +
                `inside ${bounds.left.toFixed(0)}..${bounds.right.toFixed(0)}`
              )
            }),
        )

        expect(
          spills,
          `at ${width}px these elements on ${path} are wider than the box ` +
            `they were given`,
        ).toEqual([])
      })
    }
  }
})

test.describe('the hero display line', () => {
  // The one display-step line on the site, at up to 7.5rem, set in Archivo
  // Expanded. It is the element most likely to overflow, because a clamp on
  // font-size is not a constraint on the width of the longest word.
  for (const { width } of WIDTHS) {
    test(`fits its column at ${width}`, async ({ page }) => {
      await visit(page, '/', width)

      const measured = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(
          '[data-testid="hero-display"]',
        )!
        const box = el.getBoundingClientRect()
        const field = el.closest<HTMLElement>('.section-field')!
        const bounds = field.getBoundingClientRect()
        const style = getComputedStyle(field)
        return {
          right: box.right,
          left: box.left,
          // The field is full bleed, so its own padding is the inset the
          // content is meant to respect.
          limitRight: bounds.right - parseFloat(style.paddingRight),
          limitLeft: bounds.left + parseFloat(style.paddingLeft),
          // scrollWidth past clientWidth means a word is being clipped or
          // painted outside, which a bounding box alone does not reveal.
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          fontSize: getComputedStyle(el).fontSize,
        }
      })

      expect(
        measured.right,
        `the hero display line reaches ${measured.right.toFixed(0)}px at ` +
          `${width}px, past the field's ${measured.limitRight.toFixed(0)}px ` +
          `inset, at font-size ${measured.fontSize}`,
      ).toBeLessThanOrEqual(measured.limitRight + 1)

      expect(
        measured.scrollWidth,
        `the hero display line has ${measured.scrollWidth}px of content in a ` +
          `${measured.clientWidth}px box at ${width}px, so a word is being ` +
          `painted outside it`,
      ).toBeLessThanOrEqual(measured.clientWidth + 1)
    })
  }
})

test.describe('the specification table is readable on a phone', () => {
  // The signature component, at the width it is most likely to fail.
  //
  // Not hypothetical: /work/helmdeck rendered its table 343px wide inside a
  // 327px column at 375px, because `github.com/MohamedElhedi-BenYedder/
  // helmdeck` set in Martian Mono has no break opportunity in it and so set
  // the table's minimum width. The fix is `overflow-wrap: anywhere` on the
  // data column, which is counted when the browser computes min-content width
  // where `break-word` is not.
  for (const slug of ['coachess', 'helmdeck', 'volt-tunisia']) {
    test(`/work/${slug} at 375`, async ({ page }) => {
      await visit(page, `/work/${slug}`, 375)

      const measured = await page.evaluate(() => {
        const table = document.querySelector<HTMLElement>('.spec-table')!
        const box = table.getBoundingClientRect()
        const bounds = table.parentElement!.getBoundingClientRect()
        const rows = [...table.querySelectorAll('tr')].map((tr) => ({
          label: tr.querySelector('th')!.textContent,
          // A cell whose content is wider than the cell is a cell whose text
          // is cut off or overlapping the next column.
          overflow:
            tr.querySelector('td')!.scrollWidth -
            tr.querySelector('td')!.clientWidth,
        }))
        return {
          width: box.width,
          right: box.right,
          container: bounds.width,
          containerRight: bounds.right,
          rows,
        }
      })

      expect(
        measured.width,
        `the specification table is ${measured.width.toFixed(0)}px wide in a ` +
          `${measured.container.toFixed(0)}px column at 375px, so it is ` +
          `pushing past the grid`,
      ).toBeLessThanOrEqual(measured.container + 1)

      for (const row of measured.rows) {
        expect(
          row.overflow,
          `the "${row.label}" cell overflows its column by ${row.overflow}px ` +
            `at 375px, so its value is cut off or sitting over its neighbour`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
})

test.describe('the grid ladder steps where DESIGN.md says it does', () => {
  // 3 at a phone, 6 at 48rem, 12 above 64rem. Read from the browser's own
  // resolved track list rather than from the custom property, so a ladder that
  // sets --grid-columns and fails to apply it is caught.
  for (const { width, columns, label } of WIDTHS) {
    test(`${columns} columns at ${width} (${label})`, async ({ page }) => {
      await visit(page, '/', width)

      const tracks = await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector<HTMLElement>('[data-testid="grid"]')!,
          ).gridTemplateColumns.split(' ').length,
      )

      expect(
        tracks,
        `the grid resolves to ${tracks} columns at ${width}px`,
      ).toBe(columns)
    })
  }
})
