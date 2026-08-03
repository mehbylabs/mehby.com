import { Link } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { SectionField } from '#/components/SectionField'
import { CONTACT_DESTINATION } from '#/lib/site'

// The one navigation on the site, and the reason it exists is a measurement
// rather than a convention.
//
// Before this, the link graph of the built output was:
//
//   /                 -> /contact, /work/{coachess,helmdeck,volt-tunisia}
//   /work/$slug       -> /
//   /writing/         -> /
//   /contact          -> mailto only
//   /about            -> nothing at all
//
// So /about and /writing were orphans, reachable from no page on the site and
// findable only through sitemap.xml, and /about and /contact were dead ends
// with no way back. /about had zero focusable elements: a keyboard user who
// arrived could not leave except through browser chrome.
//
// That is WCAG 2.2 AA 2.4.5 Multiple Ways, which PRODUCT.md commits to by
// name, and it is the kind of failure axe cannot see because every individual
// page is internally valid. It was caught by tabbing through each page and
// counting the stops.
//
// Shape, and what it is deliberately not:
//
//   Underlined text links, no fill and no border. Four short enclosed labels
//   sharing a parent is the badge wall PRODUCT.md bans, and a bordered pill is
//   the first step into it. tests/e2e/home.spec.ts measures for that shape
//   rather than for a class name, so this is a constraint and not a taste.
//
//   `ultramarine-deep`, not `ultramarine`. DESIGN.md alternates paper and
//   colour band by band, and pages end on either one: /about and /writing end
//   drenched, / and the case studies end on paper. A footer fixed to either of
//   those tones fuses with the last band of half the site and stops reading as
//   a separate register. The deep ground is the third measured tone, at 11.18
//   for paper text, and DESIGN.md already assigns it to "dense text grounds".
//
//   No heading. A visually hidden h2 here would be a second-level heading
//   after the h3s in the page body on / and on every case study, which is a
//   heading order the reader gains nothing from. The nav carries an
//   aria-label instead, which is what names a landmark.

/** Every published page, in the order the site presents them. */
const DESTINATIONS = [
  // The home page is the work index: it carries "Selected work" and the case
  // studies link back to it as "All work". Labelled for what it holds rather
  // than for its address.
  { to: '/', label: 'Work', exact: true },
  { to: '/about', label: 'About', exact: false },
  // '/writing', not '/writing/', because the generated `to` type offers only
  // the first and the route's canonical link is the second. That disagreement
  // was latent while nothing linked to the page. This link is the first thing
  // that does, so the prerenderer's crawler discovered the second spelling and
  // listed both addresses in sitemap.xml, which is duplicate content handed to
  // a crawler. The canonical stays '/writing/'; SITEMAP_ALIASES in
  // vite.config.ts keeps this spelling out of the sitemap, and "advertises one
  // address per page" in prerender.spec.ts is what holds it there.
  { to: '/writing', label: 'Writing', exact: false },
  { to: '/contact', label: 'Contact', exact: false },
] as const

export function SiteFooter() {
  return (
    <footer className="site-footer" data-testid="site-footer">
      <SectionField tone="ultramarine-deep">
        <Grid>
          {/* Named, because a page with two navigations and no names on them
              announces both as "navigation" and leaves a screen reader user to
              guess. There is only one today; the name costs nothing and is the
              part people forget when the second one lands. */}
          <nav className="footer-nav col-span-full" aria-label="Site">
            <ul className="footer-list">
              {DESTINATIONS.map((destination) => (
                <li key={destination.to}>
                  <Link
                    className="action footer-link"
                    to={destination.to}
                    // Without this the root link is active on every page,
                    // because every path is prefixed by "/".
                    activeOptions={{ exact: destination.exact }}
                    // Tells a screen reader which of these is the page being
                    // read. Applied by the router from the match rather than
                    // by comparing strings here, so it cannot drift.
                    activeProps={{ 'aria-current': 'page' }}
                  >
                    {destination.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* The address, on every page rather than only on the two that
              already print it. PRODUCT.md puts a qualified enquiry first among
              the priorities and asks for proof over claim: the address is the
              action, and hiding it behind a "Contact" link costs a click at
              the exact moment a reader has decided. */}
          <p className="footer-address col-span-full">
            <a
              className="contact-address"
              href={`mailto:${CONTACT_DESTINATION}`}
            >
              {CONTACT_DESTINATION}
            </a>
          </p>
        </Grid>
      </SectionField>
    </footer>
  )
}
