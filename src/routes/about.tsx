import { createFileRoute } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { Placeholder } from '#/components/Placeholder'
import { SectionField } from '#/components/SectionField'
import { pageHead } from './-seo'

// Three bands, alternating, which is what keeps the colour commitment in
// DESIGN.md structural rather than a thing somebody remembers.
//
//   ultramarine  page title and the portrait
//   paper        the four paragraphs, because paper carries reading passages
//   ultramarine  the timeline, which is data and belongs on a drenched field
//
// PRODUCT.md's honest-scope rule does the most work on this page. The owner
// supplied nothing before 2022, so nothing before 2022 appears: no university
// row, no invented first job, no "various freelance clients". The gap is
// declared instead, in the same register as every other placeholder on the
// site, so a reader can tell the difference between a short career and a short
// record of one.

// The one heading level, the one prose block. Written here rather than inline
// so a paragraph cannot be added in the middle of markup without going past
// the list.
const PARAGRAPHS = [
  'I am a full stack product engineer based in Tunisia, and the CTO and co-founder of CoaChess, a chess coaching platform I have been building since 2022.',
  'My work tends toward domains with real rules. Chess federation pairings, national electricity tariffs, tax exemptions, agent protocols. The common thread is that the rules are not negotiable and encoding them faithfully is most of the job. Software that gets those subtly wrong is worse than software that ships late.',
  'I work in React and TypeScript on the front, Python on the back, and I am comfortable owning the infrastructure underneath when the product needs it. I pick tools per problem rather than carrying a fixed stack from job to job.',
  'I am available for freelance product work.',
]

// Period first, because the period is the data and the entry is its value.
// Reverse chronological, most recent at the top: a reader with two minutes
// reads the first row and stops, so the first row has to be the current one.
const TIMELINE = [
  {
    period: '2026',
    entry: 'Helmdeck, open-source mission control for AI coding agents',
  },
  {
    period: '2026',
    entry: 'VoltTunisia, the national electric vehicle companion for Tunisia',
  },
  { period: '2022 to present', entry: 'CTO and co-founder, CoaChess' },
]

export const Route = createFileRoute('/about')({
  component: About,
  head: () =>
    pageHead({
      title: 'About Mohamed Elhedi Ben Yedder, product engineer in Tunisia',
      description:
        'I am a full stack product engineer in Tunisia. I work in React and TypeScript on the front, Python on the back, and I own the infrastructure underneath when the product needs it.',
      path: '/about',
    }),
})

function About() {
  return (
    <main>
      <SectionField tone="ultramarine">
        <Grid>
          <div className="page-head col-span-full lg:col-span-7">
            <h1 className="page-title">About</h1>
          </div>

          {/* No portrait has been supplied. PRODUCT.md: ship a labelled
              placeholder that is obviously one, never a stock substitute, and
              reserve the space the real asset will take so the reflow does not
              land the day nobody is watching. 4:5 is a portrait crop; a square
              would have to be re-cropped when the photograph arrives. */}
          <Placeholder
            className="col-span-full sm:col-span-3 lg:col-span-3 lg:col-start-10"
            label="headshot"
            ratio={4 / 5}
          />
        </Grid>
      </SectionField>

      <SectionField tone="paper">
        <Grid>
          <div
            className="prose col-span-full lg:col-span-8"
            data-testid="about-body"
          >
            {PARAGRAPHS.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </Grid>
      </SectionField>

      <SectionField tone="ultramarine">
        <Grid>
          <h2 className="section-heading col-span-full">Timeline</h2>

          {/* A real table, placed directly in the grid rather than inside a
              wrapper. A grid item is blockified, and `display: table` is
              already block level, so the element keeps its table role; putting
              a flex or grid container between the two is what strips it from
              the accessibility tree, invisibly. */}
          <table className="timeline col-span-full lg:col-span-8">
            <caption className="spec-caption">
              Timeline: what has been built, and when
            </caption>
            <tbody>
              {TIMELINE.map((row) => (
                <tr key={row.entry}>
                  <th scope="row">{row.period}</th>
                  <td>{row.entry}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Declared, not omitted. A timeline that starts in 2022 with no note
              reads as a claim that nothing happened before it; this says the
              record is short rather than the career. Same register as the asset
              placeholders, deliberately: both are gaps, and both are labelled
              the same way so a reader learns to read the label once. */}
          <p className="note col-span-full" data-testid="timeline-note">
            <span className="note-label">PLACEHOLDER</span>
            Earlier roles and education pending.
          </p>
        </Grid>
      </SectionField>
    </main>
  )
}
