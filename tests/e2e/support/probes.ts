import type { Locator, Page } from '@playwright/test'

// Shared browser-side colour probes.
//
// getComputedStyle hands these tokens back as the oklch() they were authored
// in, and there is no way to compare or measure that string in Node without
// re-implementing a colour space. So the measurement happens in the page: one
// pixel is painted and read back, which is the only route to component values
// that works for every colour syntax the browser accepts, including any future
// token written in a space this file has never heard of.
//
// Deliberately separate from tests/e2e/primitives.spec.ts, which carries its
// own copy. That file is the pinned record for the layout primitives and is
// not disturbed by work on the components that sit inside them.

// WCAG 2.2 thresholds.
export const BODY_TEXT = 4.5
export const NON_TEXT = 3.0

export const TOKENS = {
  paper: 'oklch(0.97 0.008 85)',
  ink: 'oklch(0.22 0.02 265)',
  ultramarine: 'oklch(0.52 0.19 264)',
  'ultramarine-deep': 'oklch(0.34 0.15 264)',
  rule: 'oklch(0.88 0.01 85)',
  'rule-strong': 'oklch(0.62 0.012 85)',
  'rule-on-color': 'oklch(0.82 0.05 264)',
} as const

declare global {
  interface Window {
    /** Any CSS colour resolved to sRGB plus alpha, each channel in 0..1. */
    rgba: (color: string) => [number, number, number, number]
    contrast: (a: string, b: string) => number
  }
}

export const installProbes = (page: Page) =>
  page.addInitScript(() => {
    window.rgba = (color) => {
      // Unparseable input leaves fillStyle at its previous value, which would
      // silently measure the wrong colour rather than fail. Reject it here.
      if (!CSS.supports('color', color)) {
        throw new Error(`not a colour: ${JSON.stringify(color)}`)
      }
      const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true })!
      // The canvas starts transparent and is never cleared between fills, so
      // reset it: a translucent fill painted over a previous one would read
      // back composited rather than as itself.
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r / 255, g / 255, b / 255, a / 255]
    }

    // WCAG 2.2 relative luminance, the same formula scripts/contrast.mjs
    // applies to the token literals. That script proves the numbers written in
    // DESIGN.md; this proves the numbers the browser actually painted.
    window.contrast = (first, second) => {
      const lum = (color: string) => {
        const [r, g, b] = window.rgba(color).slice(0, 3)
        const lin = (v: number) =>
          v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      }
      const x = lum(first)
      const y = lum(second)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
  })

// Blocks until React has hydrated the document.
//
// `page.goto` resolves on the `load` event, and hydration lands after it. The
// router is created with `scrollRestoration: true` (src/router.tsx), so when
// hydration does land it restores the scroll position recorded for the entry,
// which on a fresh navigation is 0. Any scroll a test performed in that window
// is silently undone, and a test that scrolled an element into view and parked
// the pointer on it is then measuring whatever the reset moved under the
// cursor instead.
//
// Measured, not assumed. Scrolling to 900 immediately after `goto` and
// sampling `scrollY` every 50ms:
//   built server on :3100   reset to 0 within ~50ms of load, 4 runs of 4
//   dev server, 4 workers   reset to 0 at 450-650ms after load, 14 runs of 16
// That window is what made spec-table.spec.ts "tints the row under the
// pointer" fail roughly one run in eight under parallel load: reproduced 3
// times in 24 at 4 workers, and 0 times in 24 with this barrier in place.
//
// The marker is React's own. React attaches `__reactFiber$<id>` to each host
// node it owns when it commits, so its presence on `document.body` is the
// commit itself rather than a proxy for it. Verified absent at `load` and
// present afterwards, so this cannot pass vacuously.
export const hydrated = (page: Page) =>
  page.waitForFunction(() =>
    Object.keys(document.body).some((key) => key.startsWith('__reactFiber$')),
  )

export const styleOf = (locator: Locator, props: Array<string>) =>
  locator.evaluate((el, names: Array<string>) => {
    const s = getComputedStyle(el)
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)]))
  }, props)
