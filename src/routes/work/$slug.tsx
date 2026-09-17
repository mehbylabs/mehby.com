import { Suspense, lazy } from 'react'
import {
  Link,
  createFileRoute,
  notFound,
  useRouterState,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Placeholder } from '#/components/Placeholder'
import { SpecTable } from '#/components/SpecTable'
import { getCaseStudies } from '#/lib/content'
import { pageHead } from '../-seo'
import type { ComponentType } from 'react'

// One dynamic route serves every case study. The three prerendered paths are
// enumerated from the same content loader in vite.config.ts, which is the
// generateStaticParams equivalent here: the router generator refuses to
// auto-discover a path containing `$`, so a dynamic route that nobody lists is
// simply never prerendered and ships client-only.
//
// The data arrives from two places, and it has to. Frontmatter comes from
// getCaseStudies(), which reads the filesystem and is therefore server only.
// The narrative comes from a Vite glob, because remark-frontmatter strips the
// YAML block before MDX compiles it, so the compiled module exports the body
// and nothing else. Neither source can supply what the other does.

const fetchCaseStudy = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(({ data }) => getCaseStudies().find((s) => s.slug === data) ?? null)

// Deliberately NOT `{ eager: true }`. An eager glob compiles to static imports,
// which means every module that reaches this route file has to be able to
// transform MDX, and the unit tests reach it: src/lib/router-wiring.test.ts
// builds the router from the generated route tree, and vitest has no MDX
// plugin. An eager glob turns that into a parse error in a test that has
// nothing to do with case studies.
//
// The lazy importer costs nothing here because React.lazy resolves it during
// SSR before the response is finished, so the narrative is in the prerendered
// HTML rather than fetched after hydration. tests/e2e/prerender.spec.ts reads
// the file on disk and asserts exactly that, so this cannot silently regress
// into a client-side fetch.
const BODIES = import.meta.glob('/content/work/*.mdx') as Record<
  string,
  () => Promise<{ default: ComponentType }>
>

// Built once at module scope. A React.lazy created during render is a new
// component type on every pass, which remounts its subtree each time.
const NARRATIVES: Record<string, ComponentType | undefined> =
  Object.fromEntries(
    Object.entries(BODIES).map(([path, load]) => [
      path.slice('/content/work/'.length, -'.mdx'.length),
      lazy(load),
    ]),
  )

// `stack` has no counterpart in the frontmatter schema, and SpecTable takes it
// as an optional prop for that reason. Supplied here per case study rather
// than as a shared list, because PRODUCT.md permits capability "in per-project
// tables" and bans it as a fixed inventory. Every entry below is named in the
// narrative of the study it belongs to, so the table claims nothing the prose
// does not already say.
const STACK: Record<string, ReadonlyArray<string>> = {
  coachess: ['TypeScript', 'React', 'Python'],
  helmdeck: ['TypeScript', 'Agent Client Protocol'],
  'volt-tunisia': ['TypeScript', 'React', 'Postgres'],
}

export const Route = createFileRoute('/work/$slug')({
  component: CaseStudy,
  notFoundComponent: NotFound,
  loader: async ({ params }) => {
    const study = await fetchCaseStudy({ data: params.slug })
    // Thrown rather than returned as null, so the response carries a 404 and a
    // crawler is told the page is absent instead of being handed a soft one.
    if (!study) throw notFound()
    return study
  },
  // Without loaderData there is no case study, only the notFound component, and
  // a head built from an absent study would advertise a canonical address for a
  // page that does not exist. The root's fallback title covers that case.
  head: ({ loaderData }) =>
    loaderData
      ? pageHead({
          title: `${loaderData.title}, a case study by Mohamed Elhedi Ben Yedder`,
          // The summary from the frontmatter, unaltered. It is already the one
          // sentence written to describe this project, it is already validated
          // against the em dash rule by the schema, and a second description
          // written for crawlers would be a second thing to keep true.
          description: loaderData.summary,
          path: `/work/${loaderData.slug}`,
          // Generated per slug by scripts/og.mjs from this same frontmatter.
          image: `/og/${loaderData.slug}.png`,
          imageAlt: `${loaderData.title}, ${loaderData.role}, ${loaderData.period}`,
        })
      : {},
})

function CaseStudy() {
  const study = Route.useLoaderData()
  const Narrative = NARRATIVES[study.slug]

  return (
    <main id="content" tabIndex={-1}>
      <section className="shell section">
        <div className="section-path">
          <span className="section-path-code">{`~/work/${study.slug}`}</span>
          <h1 className="page-title">{study.title}</h1>
        </div>
        <p className="hero-subline">{study.summary}</p>
        <p className="page-back">
          <Link className="nav-link" to="/">
            All work
          </Link>
        </p>
      </section>

      <section className="shell section section-continues">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* No cover image exists for any of the three. PRODUCT.md: ship a
              labelled placeholder that is obviously one, never an invented
              substitute, and reserve the space the real asset will take so the
              reflow does not land on the day nobody is watching. */}
          <div className="lg:col-span-7">
            <Placeholder label={`${study.title} cover`} ratio={16 / 9} />
          </div>

          {/* The specification table, above the narrative on purpose. A visitor
              with two minutes reads the table; the prose is for the second
              audience PRODUCT.md describes, who read more slowly and care how
              the decisions were made. */}
          <div className="lg:col-span-4 lg:col-start-9">
            <SpecTable
              caption={`Specification: ${study.title}`}
              role={study.role}
              period={study.period}
              surfaces={study.surfaces}
              source={study.source}
              stack={STACK[study.slug]}
            />
          </div>

          <div className="prose lg:col-span-8" data-testid="narrative">
            <Suspense fallback={null}>
              {Narrative ? <Narrative /> : null}
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  )
}

function NotFound() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <main id="content" tabIndex={-1} data-testid="not-found">
      <section className="shell section page-centered">
        <div className="section-path">
          <span className="section-path-code">{`~/work${pathname}`}</span>
          <h1 className="page-title">No case study here</h1>
        </div>
        <p className="hero-subline">
          That address does not match any of the work on this site. It may have
          been a typing slip, or a link that was never real.
        </p>
        <p className="page-back">
          <Link className="nav-link" to="/">
            All work
          </Link>
        </p>
      </section>
    </main>
  )
}
