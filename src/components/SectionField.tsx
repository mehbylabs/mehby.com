import type { ReactNode } from 'react'

// A full-bleed band of one ground. Sections alternate between paper and colour,
// and that alternation is what structurally produces the 30 to 50 percent
// colour commitment in DESIGN.md, so it cannot quietly erode into a trim
// accent.
//
// The tone is passed as an attribute, not as classes, on purpose. Every ground
// owes four declarations — background, text colour, leading and focus-ring
// colour — and two of them are invisible when omitted: text silently inherits
// --color-ink at 3.02 on ultramarine, and the focus ring silently inherits
// --color-ultramarine at 1.00 on ultramarine. A caller writing utility classes
// can apply the background and stop. A caller writing `tone="ultramarine"`
// cannot: the four live together in one rule block in styles.css, alongside
// --field-rule-strong on the same selectors.
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
