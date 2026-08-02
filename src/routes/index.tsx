import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Grid } from '#/components/Grid'
import { Hero } from '#/components/Hero'
import { ProofStrip } from '#/components/ProofStrip'
import { SectionField } from '#/components/SectionField'
import { getCaseStudies } from '#/lib/content'

// The home page. Four bands, alternating ultramarine and paper, which is what
// produces DESIGN.md's 30 to 50 percent colour commitment structurally rather
// than by anybody remembering to keep it up. tests/e2e/home.spec.ts measures
// the resulting share so the alternation cannot quietly erode.
//
//   ultramarine  hero, and the proof strip on the same field
//   paper        selected work
//   ultramarine  what I do
//   paper        start a conversation

// getCaseStudies reads the filesystem, so it cannot run in a loader that the
// client will also run: a client-side navigation back to `/` would execute it
// in the browser. Wrapped as a server function it runs on the server during
// SSR and prerender, and over the wire on a client navigation, and node:fs
// never reaches the bundle.
const listCaseStudies = createServerFn({ method: 'GET' }).handler(() =>
  getCaseStudies().map(({ slug, title, summary, role, period }) => ({
    slug,
    title,
    summary,
    role,
    period,
  })),
)

export const Route = createFileRoute('/')({
  component: Home,
  loader: () => listCaseStudies(),
  head: () => ({
    meta: [
      { title: 'Mohamed Elhedi Ben Yedder, full stack product engineer' },
      {
        name: 'description',
        content:
          'CTO and co-founder of CoaChess. Available for freelance product engineering.',
      },
    ],
  }),
})

// Three statements, in prose. PRODUCT.md: capability is expressed through what
// was chosen and why, never as a fixed stack list, and the banned shape in
// DESIGN.md is "icon plus heading plus two lines, repeated". So each of these
// is a paragraph long enough to carry a judgement, laid out as a definition
// row rather than as a card, and the test asserts the word count for exactly
// that reason.
const CAPABILITIES = [
  {
    heading: 'Product engineering',
    body: 'Interfaces in React and TypeScript, services in Python. I take a product from an empty repository to something people use, without a handoff in the middle where the intent gets lost.',
  },
  {
    heading: 'Systems with hard rules',
    body: 'Federation pairing rules, national electricity tariffs, tax exemptions, wire protocols. The work I am best at is the kind where the domain has real constraints and getting them subtly wrong is worse than shipping late.',
  },
  {
    heading: 'Real time and infrastructure',
    body: 'Synchronous products where latency and state are the product, not a detail. Self-hosted video with server side recording, and the deployment work that keeps it running.',
  },
]

function Home() {
  const studies = Route.useLoaderData()

  return (
    <main>
      {/* One field, two components. The proof strip is not given a band of its
          own because DESIGN.md is explicit that there is no hedging neutral
          between the drenched hero and its evidence. */}
      <SectionField tone="ultramarine">
        <Grid>
          <Hero />
          <ProofStrip />
        </Grid>
      </SectionField>

      <SectionField tone="paper">
        <Grid>
          <h2 className="section-heading col-span-full">Selected work</h2>

          {/* Ruled entries in the page grid, not cards. The rule above each
              entry is the structure; a box around it would be the container
              DESIGN.md bans as a default. Each entry carries its own role and
              period as data, which is what makes this an index of
              specifications rather than three identical tiles. */}
          {studies.map((study) => (
            <Link
              key={study.slug}
              className="pillar col-span-full md:col-span-2 lg:col-span-4"
              data-testid="pillar-link"
              to="/work/$slug"
              params={{ slug: study.slug }}
            >
              <h3 className="pillar-title">{study.title}</h3>
              <p className="pillar-meta">
                {study.role}, {study.period}
              </p>
              <p className="pillar-summary">{study.summary}</p>
            </Link>
          ))}
        </Grid>
      </SectionField>

      <SectionField tone="ultramarine">
        <Grid>
          <h2 className="section-heading col-span-full">What I do</h2>

          {CAPABILITIES.map((capability) => (
            <div
              key={capability.heading}
              className="capability col-span-full"
              data-testid="capability"
            >
              <h3 className="capability-heading">{capability.heading}</h3>
              <p className="capability-body">{capability.body}</p>
            </div>
          ))}
        </Grid>
      </SectionField>

      <SectionField tone="paper">
        <Grid>
          <div
            className="contact col-span-full lg:col-span-8"
            data-testid="contact"
          >
            <h2 className="section-heading">Start a conversation</h2>
            <p className="contact-body">
              Tell me what you are building and what is in the way. I reply to
              everything.
            </p>
            {/* The address is the link. A button labelled "Get in touch" hides
                the one piece of information a visitor needs to act without
                clicking, and PRODUCT.md asks for proof over claim throughout. */}
            <p>
              <a className="contact-address" href="mailto:hello@mehby.com">
                hello@mehby.com
              </a>
            </p>
          </div>
        </Grid>
      </SectionField>
    </main>
  )
}
