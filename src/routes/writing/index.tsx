import { Link, createFileRoute } from '@tanstack/react-router'
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
// The path header names the directory, the empty line says what is true, and
// the single link goes back to the work. Nothing else belongs on an empty
// page, and nothing else is here.

export const Route = createFileRoute('/writing/')({
  component: Writing,
  head: () => {
    const head = pageHead({
      title: 'Writing by Mohamed Elhedi Ben Yedder',
      description:
        'Notes on the work behind the case studies. Nothing is published yet, so this page says so plainly rather than padding itself with placeholders.',
      // No trailing slash, and the absence is load bearing.
      //
      // This used to read '/writing/', on the argument that the route's full
      // path carries the slash and a canonical must agree with the sitemap.
      // The argument was right and the address was wrong, because it left out
      // the only party that gets a vote: the server. Measured against the
      // built output, `curl -sI /writing/` answers
      //
      //   307 Temporary Redirect
      //   location: /writing
      //
      // so `/writing/` is not an address this site serves, it is an address it
      // sends you away from. A canonical pointing at it told every crawler
      // that the authoritative copy of this document lives at a URL which
      // immediately redirects to the copy it was already reading, and the
      // sitemap agreed with the canonical rather than with the server. Three
      // declarations, two of them pointing at a redirect.
      //
      // So the served address wins. Canonical, sitemap and `<Link to>` are now
      // all '/writing', which is also the only spelling the router's generated
      // `to` type has ever accepted. '/writing/' still resolves, because
      // somebody will type it, and vite.config.ts keeps it out of the sitemap
      // so one document is advertised once.
      path: '/writing',
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
    <main id="content" tabIndex={-1}>
      <section className="shell section page-centered">
        <div className="section-path">
          <span className="section-path-code">~/writing</span>
          <h1 className="page-title">Writing</h1>
        </div>
        <p className="page-intro" data-testid="writing-empty">
          Nothing published yet. Notes on the work in progress will appear here.
        </p>
        <p className="page-back">
          <Link className="nav-link" to="/">
            ~/work
          </Link>
        </p>
      </section>
    </main>
  )
}
