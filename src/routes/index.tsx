import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Hero } from '#/components/Hero'
import { ProofStrip } from '#/components/ProofStrip'
import { getCaseStudies } from '#/lib/content'
import { CONTACT_DESTINATION } from '#/lib/site'
import { pageHead } from './-seo'

// The home page, one session. The hero opens a terminal session, the proof
// strip checks the products for real, the work index is a set of open files,
// and the capabilities are a log of what this person actually does.

const listCaseStudies = createServerFn({ method: 'GET' }).handler(() =>
  getCaseStudies().map(({ slug, title, summary, role, period, surfaces }) => ({
    slug,
    title,
    summary,
    role,
    period,
    surfaces,
  })),
)

export const Route = createFileRoute('/')({
  component: Home,
  loader: () => listCaseStudies(),
  head: () =>
    pageHead({
      title: 'Mohamed Elhedi Ben Yedder, full stack product engineer',
      description:
        'I build and ship full stack products end to end, from an empty repository to something people use. CTO and co-founder of CoaChess, available for freelance work.',
      path: '/',
      imageAlt:
        'Mohamed Elhedi Ben Yedder, full stack product engineer',
    }),
})

const CAPABILITIES = [
  {
    index: '01',
    heading: 'Product engineering',
    body: 'Interfaces in React and TypeScript, services in Python. I take a product from an empty repository to something people use, without a handoff in the middle where the intent gets lost.',
  },
  {
    index: '02',
    heading: 'Systems with hard rules',
    body: 'Federation pairing rules, national electricity tariffs, tax exemptions, wire protocols. The work I am best at is the kind where the domain has real constraints and getting them subtly wrong is worse than shipping late.',
  },
  {
    index: '03',
    heading: 'Real time and infrastructure',
    body: 'Synchronous products where latency and state are the product, not a detail. Self-hosted video with server side recording, and the deployment work that keeps it running.',
  },
]

function Home() {
  const studies = Route.useLoaderData()
  const surfaces = studies.flatMap((study) => study.surfaces)

  return (
    <main>
      <section className="shell section">
        <Hero />
        <ProofStrip surfaces={surfaces} />
      </section>

      <section className="shell section" data-testid="work-section">
        <div className="section-path">
          <span className="section-path-code">~/work</span>
          <h2 className="section-path-title">Work that ships</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {studies.map((study, i) => (
            <Link
              key={study.slug}
              className="tcard"
              data-testid="pillar-link"
              to="/work/$slug"
              params={{ slug: study.slug }}
              style={i === 0 ? { gridColumn: '1 / -1' } : undefined}
            >
              <span className="tcard-path">{`# ${study.slug}/`}</span>
              <h3 className="tcard-title">{study.title}</h3>
              <p className="tcard-meta">
                {study.role} · {study.period}
              </p>
              <p className="tcard-summary">{study.summary}</p>
              <span className="tcard-action">read the case study →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell section" data-testid="capability-section">
        <div className="section-path">
          <span className="section-path-code">~/what-i-do</span>
          <h2 className="section-path-title">What I actually do</h2>
        </div>

        {CAPABILITIES.map((capability) => (
          <div
            key={capability.heading}
            className="capability"
            data-testid="capability"
          >
            <span className="capability-index">{capability.index}</span>
            <div>
              <h3 className="capability-heading">{capability.heading}</h3>
              <p className="capability-body">{capability.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="shell section" data-testid="contact">
        <div className="section-path">
          <span className="section-path-code">~/contact</span>
          <h2 className="section-path-title">Start a conversation</h2>
        </div>
        <p className="hero-subline" style={{ marginBottom: '1.5rem' }}>
          Tell me what you are building and what is in the way. I reply to
          everything.
        </p>
        <a
          className="contact-address"
          href={`mailto:${CONTACT_DESTINATION}`}
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: 'var(--text-h3)',
            color: 'var(--color-orange)',
            textDecoration: 'underline',
            textUnderlineOffset: '0.25em',
          }}
        >
          {CONTACT_DESTINATION}
        </a>
      </section>
    </main>
  )
}
