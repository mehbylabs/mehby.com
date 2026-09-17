import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// The scale claimed a 1.333 ratio in DESIGN.md and delivered 1.13 to 1.18
// across half its steps. Nothing checked, because a type scale is six numbers
// in a block and a number that is wrong looks exactly like a number that is
// right.
//
// The check has to know what the scale actually is, which is two things:
//
//   fine, data, body   parallel registers. A caption, a line of mono data,
//                      and reading copy. Close together on purpose, told
//                      apart by family and colour rather than by size, and
//                      not a ladder. Forcing 1.25 between them would set
//                      captions at a size that competes with the prose.
//
//   h3 .. display      the heading ladder, where hierarchy is the whole job
//                      and the ratio has to hold.
//
// body to h3 is the seam between them, and it is the one that was broken: at
// 1.18 it put three pixels between a work card's title and its summary.

const STYLES = 'src/styles.css'
const MIN_RATIO = 1.25

/** Every --text-* token, as [min, max] in rem. A fixed value is both. */
function scale(css: string): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}

  for (const [, name, value] of css.matchAll(
    /--text-([\w-]+):\s*([^;]+);/g,
  ) as Iterable<RegExpMatchArray>) {
    const clamped = /clamp\(\s*([\d.]+)rem\s*,[^,]+,\s*([\d.]+)rem\s*\)/.exec(
      value,
    )
    if (clamped) {
      out[name] = [parseFloat(clamped[1]), parseFloat(clamped[2])]
      continue
    }
    const fixed = /^\s*([\d.]+)rem\s*$/.exec(value)
    if (fixed) out[name] = [parseFloat(fixed[1]), parseFloat(fixed[1])]
  }

  return out
}

const LADDER = ['h3', 'h2', 'h1', 'display'] as const

test('the heading ladder clears its ratio at the reference size', () => {
  const steps = scale(readFileSync(STYLES, 'utf8'))

  for (const [i, name] of LADDER.slice(1).entries()) {
    const previous = LADDER[i]
    const ratio = steps[name][1] / steps[previous][1]

    expect(
      ratio,
      `${previous} to ${name} is ${ratio.toFixed(3)}. A ladder flatter than ` +
        `${MIN_RATIO} reads as uncommitted, and hierarchy then has to come ` +
        `from colour, which DESIGN.md does not allow it to`,
    ).toBeGreaterThanOrEqual(MIN_RATIO)
  }
})

test('the first heading step clears reading copy', () => {
  // The seam between the registers and the ladder, and the step that was
  // wrong. .tcard-title is --text-h3 and .tcard-summary is --text-body, so
  // this ratio is literally the separation between the title of a case study
  // and the sentence under it.
  const steps = scale(readFileSync(STYLES, 'utf8'))

  for (const end of [0, 1]) {
    const ratio = steps.h3[end] / steps.body[end]
    expect(
      ratio,
      `body to h3 is ${ratio.toFixed(3)} at the ${end === 0 ? 'min' : 'max'} end`,
    ).toBeGreaterThanOrEqual(MIN_RATIO)
  }
})

test('the registers stay close, and are not mistaken for a ladder', () => {
  // Stated as an assertion so the intent survives. If somebody later inflates
  // these to satisfy a ratio, this fails and points at the reason: they are
  // separated by family, not by size.
  const steps = scale(readFileSync(STYLES, 'utf8'))

  expect(steps.body[1] / steps.data[1]).toBeLessThan(MIN_RATIO)
  expect(steps.data[1] / steps.fine[1]).toBeLessThan(MIN_RATIO)
})

test('the clamp minimums compress, and never invert', () => {
  // At 360px the constraint is the width of the column rather than the ratio,
  // so the ladder is allowed to compress there. What it may never do is put a
  // heading at or below the size of the one beneath it.
  const steps = scale(readFileSync(STYLES, 'utf8'))

  for (const [i, name] of LADDER.slice(1).entries()) {
    const previous = LADDER[i]
    expect(
      steps[name][0],
      `${name} is not larger than ${previous} at the narrow end`,
    ).toBeGreaterThan(steps[previous][0])
  }
})
