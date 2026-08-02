import type { ReactNode } from 'react'

// A full-bleed band of one ground. Sections alternate between paper and colour,
// and that alternation is what structurally produces the 30 to 50 percent
// colour commitment in DESIGN.md, so it cannot quietly erode into a trim
// accent.
//
// The tone is passed as an attribute, not as classes, on purpose. Every ground
// owes five declarations — background, text colour, leading, focus-ring colour
// and hairline colour — and three of them are invisible when omitted: text
// silently inherits --color-ink at 3.02 on ultramarine, the focus ring silently
// inherits --color-ultramarine at 1.00 on ultramarine, and hairlines inherit a
// value never measured against that ground. A caller writing utility classes
// can apply the background and stop. A caller writing `tone="ultramarine"`
// cannot: the five live together in one rule block in styles.css.
export type Tone = 'paper' | 'ultramarine' | 'ultramarine-deep'

export function SectionField({
  tone,
  children,
  className = '',
}: {
  tone: Tone
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={`section-field ${className}`.trim()}
      data-tone={tone}
      data-testid={`section-field-${tone}`}
    >
      {children}
    </section>
  )
}
