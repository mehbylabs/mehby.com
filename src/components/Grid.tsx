import type { ReactNode } from 'react'

// The page grid. Twelve columns at desktop, stepping down through 6 to 3.
//
// It used to paint its own gutters: eleven absolutely positioned hairlines per
// band, on the argument that DESIGN.md called the grid "voice" and the
// structure was meant to be seen. That argument is withdrawn. On a real page
// the lines crossed headlines, paragraphs and table rows, and the result read
// as a debug overlay somebody forgot to switch off rather than as a datasheet.
// The approved terracotta direction has no visible grid at all, and DESIGN.md
// now says so.
//
// What survives is the part that was never the problem: the geometry. The
// column ladder, the measure and the centring are what every caller's
// `col-span-*` and `col-start-*` utilities resolve against, so this is a real
// layout primitive and not a wrapper left behind by a deletion. It owns no
// colour and no padding — the inset comes from the surrounding SectionField's
// own padding — which is what lets one grid sit inside a paper band and
// another inside a clay one with their columns still lining up across the
// colour change.
//
// The test id stays. It is how tests/e2e/responsive.spec.ts finds the grid to
// check the 3 -> 6 -> 12 ladder, which is the claim that outlived the rules.
export function Grid({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`grid-field ${className}`.trim()} data-testid="grid">
      {children}
    </div>
  )
}
