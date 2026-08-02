import type { ReactNode } from 'react'

// Twelve columns whose gutters are drawn, not implied. DESIGN.md calls the grid
// "voice": the structure is meant to be seen, so the lines are real painted
// elements rather than whitespace between tracks.
//
// Geometry only. This deliberately owns no colour and no padding. The hairline
// colour comes from --field-rule, which the surrounding SectionField sets for
// its ground, and the inset comes from that field's padding — so one grid can
// sit inside a paper band and another inside an ultramarine one and their
// columns still line up across the colour change.
const COLUMNS = 12

// A line's tier is the narrowest breakpoint that draws it. The column ladder is
// 3 -> 6 -> 12, so the divisors are 4 and 2: lines on a multiple of 4 are the
// boundaries of a 3-column grid, lines on a multiple of 2 complete a 6-column
// one, and the rest complete all twelve. Because each set contains the previous
// one, widening the viewport only ever adds hairlines. The CSS side of this is
// the [data-tier] ladder in styles.css and the two must move together;
// tests/e2e/primitives.spec.ts checks every drawn line against the browser's
// own resolved track edges at each breakpoint, which is what catches drift.
const tierOf = (line: number) =>
  line % 4 === 0 ? '1' : line % 2 === 0 ? '2' : '3'

const LINES = Array.from({ length: COLUMNS - 1 }, (_, i) => i + 1)

// The test id is fixed rather than a prop, so two grids inside one section
// field would make it ambiguous. Sections are meant to carry one grid each —
// DESIGN.md wants the rules continuous across a colour change, which is a
// property of one grid per band, not of nesting them.
export function Grid({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`grid-field ${className}`.trim()} data-testid="grid">
      {/* Decoration, and marked as such twice: once on the layer so nothing
          inside it can be reached by assistive technology, and once per line so
          a line lifted out of this wrapper carries its own exclusion. */}
      <div className="grid-rules" aria-hidden="true">
        {LINES.map((line) => (
          <div
            key={line}
            aria-hidden="true"
            className="grid-rule"
            data-testid="grid-rule"
            data-tier={tierOf(line)}
            // Positions are in twelfths regardless of how many columns are
            // currently drawn, which is the whole reason the ladder uses
            // divisors of 12: line 4 is a third of the way across at every
            // breakpoint, so nothing has to be recomputed when one appears.
            style={{ left: `calc(${line} * 100% / ${COLUMNS})` }}
          />
        ))}
      </div>
      {children}
    </div>
  )
}
