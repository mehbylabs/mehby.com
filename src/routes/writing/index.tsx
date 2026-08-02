import { Link, createFileRoute } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { SectionField } from '#/components/SectionField'
import { SITE, pageHead } from '../-seo'
import { FEED_PATH } from './-feed'

// Nothing is published. So this page says that, once, and stops.
//
// The temptation here is three greyed cards labelled "Coming soon", or a
// sample post, or a newsletter box. All three are the same mistake in
// different clothes: PRODUCT.md's honest-scope rule says unfinished work is
// described accurately or omitted, never padded into the appearance of a
// portfolio, and a fake post is worse than an empty section because it is a
// claim rather than an absence.
//
// One band rather than the usual alternation. A drenched title strip above an
// almost empty paper ground reads as a render that stopped halfway, which is
// the one thing an intentionally empty page must not look like. `page-field`
// gives it the height to read as finished.

export const Route = createFileRoute('/writing/')({
  component: Writing,
  head: () => {
    const head = pageHead({
      title: 'Writing by Mohamed Elhedi Ben Yedder',
      description:
        'Notes on the work behind the case studies. Nothing is published yet, so this page says so plainly rather than padding itself with placeholders.',
      // The trailing slash is load bearing. This route's full path is
      // `/writing/`, which is the address the generated sitemap advertises, and
      // a canonical that disagrees with the sitemap hands a crawler two
      // addresses for one document and lets it pick. Both resolve in a browser,
      // which is why nothing else would ever catch it.
      path: '/writing/',
    })

    return {
      ...head,
      links: [
        ...head.links,
        // Feed discovery, which is the only thing that makes the feed findable:
        // no reader guesses a URL, and there is no visible link to one on a
        // page that says nothing is published. Declared here rather than on the
        // root so it points at the section it belongs to, and absolute so a
        // reader that saved the page still resolves it.
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: 'Writing by Mohamed Elhedi Ben Yedder',
          href: `${SITE}${FEED_PATH}`,
        },
      ],
    }
  },
})

function Writing() {
  return (
    <main>
      <SectionField tone="ultramarine" className="page-field">
        <Grid>
          <div className="page-head col-span-full lg:col-span-7">
            <h1 className="page-title">Writing</h1>
            <p className="page-intro" data-testid="writing-empty">
              Nothing published yet. Notes on the work in progress will appear
              here.
            </p>
            <p className="page-actions">
              <Link className="action" to="/">
                Home
              </Link>
            </p>
          </div>
        </Grid>
      </SectionField>
    </main>
  )
}
