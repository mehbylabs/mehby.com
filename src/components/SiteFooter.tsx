import { Link } from '@tanstack/react-router'
import { CONTACT_DESTINATION } from '#/lib/site'

// The footer, on every page, under the terminal sign-off.
//
// It exists because of a measurement rather than a convention. Before it, the
// link graph of the built output was:
//
//   /                 -> /contact, /work/{coachess,helmdeck,volt-tunisia}
//   /work/$slug       -> /
//   /writing/         -> /
//   /contact          -> mailto only
//   /about            -> nothing at all
//
// So /about and /writing were orphans and /about and /contact were dead ends.
// /about had zero focusable elements: a keyboard user who arrived could not
// leave except through browser chrome. That is WCAG 2.2 AA 2.4.5 Multiple
// Ways, and axe cannot see it because every individual page is internally
// valid.
//
// The links are the same mono paths as the navigation. The address is printed
// here too, on every page, so the action is never hidden behind a click.

const DESTINATIONS = [
  // The home page is the work index, so it is labelled for what it holds
  // rather than for its address.
  { to: '/', label: '~/work', exact: true },
  { to: '/about', label: '~/about', exact: false },
  { to: '/writing', label: '~/writing', exact: false },
  { to: '/contact', label: '~/contact', exact: false },
] as const

export function SiteFooter() {
  return (
    <footer className="site-footer" data-testid="site-footer">
      <div className="shell footer-inner">
        <p className="prompt">
          <span className="prompt-user">mehby</span>
          <span className="prompt-host">@dev:~$</span>
          <span>echo "thanks for reading"</span>
        </p>

        {/* Named, because a page with two navigations and no names on them
            announces both as "navigation" and leaves a screen reader user to
            guess. */}
        <nav aria-label="Site" className="footer-nav">
          <ul className="footer-list">
            {DESTINATIONS.map((destination) => (
              <li key={destination.to}>
                <Link
                  className="nav-link"
                  to={destination.to}
                  // Without this the root link is active on every page, because
                  // every path is prefixed by "/".
                  activeOptions={{ exact: destination.exact }}
                  // Tells a screen reader which of these is the page being
                  // read. Applied by the router from the match rather than by
                  // comparing strings here, so it cannot drift.
                  activeProps={{ 'aria-current': 'page' }}
                >
                  {destination.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="footer-address">
          <a className="contact-address" href={`mailto:${CONTACT_DESTINATION}`}>
            {CONTACT_DESTINATION}
          </a>
        </p>
      </div>
    </footer>
  )
}
