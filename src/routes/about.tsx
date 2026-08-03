import { createFileRoute } from '@tanstack/react-router'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableRow,
} from '#/components/ui/table'
import { Placeholder } from '#/components/Placeholder'
import { pageHead } from './-seo'

// The page opens as a session: `whoami`, then the answer. The h1 is the name,
// because a heading is the document's title in the accessibility tree and in
// search results, and `whoami` outputs exactly that.
//
// PRODUCT.md's honest-scope rule does the most work on this page. The owner
// supplied nothing before 2022, so nothing before 2022 appears: no university
// row, no invented first job, no "various freelance clients". The gap is
// declared instead, in the same register as every other placeholder on the
// site, so a reader can tell the difference between a short career and a short
// record of one.

// The one prose block. Written here rather than inline so a paragraph cannot
// be added in the middle of markup without going past the list.
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
      <section className="shell section">
        <p className="prompt">
          <span className="prompt-user">mehby</span>
          <span className="prompt-host">@dev:~$</span>
          <span>whoami</span>
          <span className="cursor" aria-hidden="true" />
        </p>
        <h1 className="page-title" style={{ marginTop: '1rem' }}>
          Mohamed Elhedi Ben Yedder
        </h1>
        <p className="log-line" style={{ marginTop: '0.5rem' }}>
          <b>Full stack product engineer</b> / based in Tunisia / CTO and
          co-founder of CoaChess
        </p>
      </section>

      <section className="shell section" style={{ paddingTop: 0 }}>
        <div className="section-path">
          <span className="section-path-code">~/who-is-this</span>
          <h2 className="section-path-title">The short version</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="prose lg:col-span-8" data-testid="about-body">
            {PARAGRAPHS.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>

          {/* No portrait has been supplied. PRODUCT.md: ship a labelled
              placeholder that is obviously one, never a stock substitute, and
              reserve the space the real asset will take so the reflow does not
              land the day nobody is watching. 4:5 is a portrait crop; a square
              would have to be re-cropped when the photograph arrives. */}
          <div className="lg:col-span-3 lg:col-start-10">
            <Placeholder label="headshot" ratio={4 / 5} />
          </div>
        </div>
      </section>

      <section className="shell section" style={{ paddingTop: 0 }}>
        <div className="section-path">
          <span className="section-path-code">~/timeline</span>
          <h2 className="section-path-title">Timeline</h2>
        </div>

        {/* A real table, with real row headers. The period is the data and the
            row header, so it is set in mono and amber exactly as a terminal
            prints a timestamp. */}
        <Table className="spec-table" style={{ maxInlineSize: '52rem' }}>
          <TableCaption className="spec-caption">
            Timeline: what has been built, and when
          </TableCaption>
          <TableBody>
            {TIMELINE.map((row) => (
              <TableRow key={row.entry} className="border-b-0">
                <TableHead scope="row" className="timeline-period">
                  {row.period}
                </TableHead>
                <TableCell className="whitespace-normal">{row.entry}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Declared, not omitted. A timeline that starts in 2022 with no note
            reads as a claim that nothing happened before it; this says the
            record is short rather than the career. Same register as the asset
            placeholders, deliberately: both are gaps, and both are labelled
            the same way so a reader learns to read the label once. */}
        <p
          className="log-line"
          data-testid="timeline-note"
          style={{ marginTop: '1.5rem' }}
        >
          <b className="note-label">PLACEHOLDER</b> Earlier roles and education
          pending.
        </p>
      </section>
    </main>
  )
}
