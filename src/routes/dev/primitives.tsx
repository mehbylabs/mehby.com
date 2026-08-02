import { createFileRoute } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { Placeholder } from '#/components/Placeholder'
import { SectionField } from '#/components/SectionField'
import { SpecTable } from '#/components/SpecTable'
import type { SpecTableProps } from '#/components/SpecTable'
import type { Tone } from '#/components/SectionField'

// Scratch harness for the layout primitives. Deliberately plain: no copy worth
// keeping, no composition worth copying. It exists so tests/e2e/primitives.spec.ts
// can measure every tone and a focus ring on a coloured ground in a real
// browser, and it is excluded from the deploy.
//
// When it goes, the assertions that drive it have to be re-pointed at the real
// sections that replace it. The invariants are about grounds, not about this
// page.

export const Route = createFileRoute('/dev/primitives')({
  component: Primitives,
})

const TONES: Array<Tone> = ['paper', 'ultramarine', 'ultramarine-deep']

// One specification table per ground, each with different metadata and a
// different row set. Two tables with the same data would pass against a
// component that ignored its props; a table with every row present would pass
// against one that never omits an empty one. The tone that carries surfaces
// carries no source, and vice versa, so both directions are exercised.
//
// Values are the public frontmatter in content/work/*.mdx. `stack` has no
// counterpart in the schema yet, so those three lists are harness fixtures and
// are not site copy.
const SPECS: Record<Tone, SpecTableProps> = {
  paper: {
    caption: 'Specification: CoaChess',
    role: 'CTO and co-founder',
    period: '2022 to present',
    surfaces: [
      { label: 'coachess.net', href: 'https://coachess.net' },
      { label: 'app.coachess.net', href: 'https://app.coachess.net' },
    ],
    stack: ['TypeScript', 'Postgres', 'WebRTC'],
  },
  ultramarine: {
    caption: 'Specification: Helmdeck',
    role: 'Designer and engineer',
    period: '2026',
    source: 'https://github.com/MohamedElhedi-BenYedder/helmdeck',
    stack: ['TypeScript', 'Rust'],
  },
  // The bare minimum: no surfaces, no source, no stack, so every optional row
  // is absent from at least one table and present in at least one other. It
  // also carries no links, which keeps the divider assertions supplied with a
  // third ground without lengthening the tab order the focus-ring tests walk.
  'ultramarine-deep': {
    caption: 'Specification: VoltTunisia',
    role: 'Designer and engineer',
    period: '2026',
  },
}

// Different ratios per ground, so a component that hard-codes one shape cannot
// satisfy both.
const COVERS: Partial<Record<Tone, { label: string; ratio: number }>> = {
  paper: { label: 'headshot', ratio: 16 / 9 },
  ultramarine: { label: 'coachess cover', ratio: 1 },
}

function Primitives() {
  return (
    <main>
      {TONES.map((tone) => {
        const cover = COVERS[tone]

        return (
          <SectionField key={tone} tone={tone}>
            <Grid>
              <h2
                className="col-span-full font-display text-h2 leading-h2"
                data-testid={tone === 'paper' ? 'leading-h2' : undefined}
              >
                {tone}
              </h2>

              {/* No leading class: this one measures what the tone itself hands
                  down, which is the value a section that forgets would get. */}
              <p className="col-span-full text-body" data-testid="field-copy">
                Reading copy on the {tone} ground. Body text here has to clear
                4.5 against the ground behind it, and the ground is the only
                thing that knows which colour that takes.
              </p>

              <p className="col-span-full">
                <a href={`#${tone}`} data-testid={`field-link-${tone}`}>
                  Focusable link on {tone}
                </a>
              </p>

              {tone === 'paper' && (
                <>
                  <p
                    className="col-span-full font-display text-display leading-display"
                    data-testid="leading-display"
                  >
                    Specification
                  </p>
                  <p
                    className="col-span-full font-display text-h1 leading-h1"
                    data-testid="leading-h1"
                  >
                    Page title
                  </p>
                  <p
                    className="col-span-full text-body leading-body"
                    data-testid="leading-body"
                  >
                    Reading copy at the body leading.
                  </p>
                </>
              )}

              {tone === 'ultramarine' && (
                <p
                  className="col-span-full text-body leading-on-color"
                  data-testid="leading-on-color"
                >
                  Reading copy at the on-colour leading.
                </p>
              )}

              <div className="col-span-full md:col-span-4">
                <SpecTable {...SPECS[tone]} />
              </div>

              {cover && (
                <Placeholder
                  className="col-span-full md:col-span-4"
                  label={cover.label}
                  ratio={cover.ratio}
                />
              )}
            </Grid>
          </SectionField>
        )
      })}
    </main>
  )
}
