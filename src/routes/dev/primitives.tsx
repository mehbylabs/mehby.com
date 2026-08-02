import { createFileRoute } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { SectionField } from '#/components/SectionField'
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

function Primitives() {
  return (
    <main>
      {TONES.map((tone) => (
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
              Reading copy on the {tone} ground. Body text here has to clear 4.5
              against the ground behind it, and the ground is the only thing
              that knows which colour that takes.
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
          </Grid>
        </SectionField>
      ))}
    </main>
  )
}
