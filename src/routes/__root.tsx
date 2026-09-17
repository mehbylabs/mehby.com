import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Button } from '#/components/ui/button'
import { SiteFooter } from '#/components/SiteFooter'
import { SITE_NAME } from './-seo'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      // The two facts that are the same on every page, declared once. The
      // router merges head output from the root down and the deepest match
      // wins per name, so a route that sets its own og:title still inherits
      // these. Everything that varies per page comes from `pageHead` in
      // src/routes/-seo.ts instead.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      // The fallback title, and it is meant to be reached by nothing. Every
      // published route sets its own; this is what an unpublished harness page
      // gets, and it exists so the answer is never the scaffold's name.
      {
        title: 'Mohamed Elhedi Ben Yedder',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // Declared, so the browser stops guessing. Without an icon link every
      // browser requests /favicon.ico, which this site does not serve, and
      // Lighthouse logs the resulting 404 under errors-in-console on every
      // page. Measured before the fix: one failed request per page load, 6.2 kB
      // of 404 body, and the only failing best-practices audit.
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      // Both faces are needed above the fold, and neither is discoverable until
      // the stylesheet has parsed. Preloading here puts them in flight from the
      // initial HTML instead. crossOrigin is required even though these are
      // same-origin: font fetches are always CORS-mode, and a preload without
      // it will not be matched, so the file downloads twice.
      {
        rel: 'preload',
        href: '/fonts/archivo.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/martian-mono.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  // Both live in the root route options rather than in files of their own,
  // which is where TanStack Router looks for them. A `src/routes/404.tsx`
  // would simply be a route matching the path `/404`, reachable by typing it
  // and never reached by a wrong address.
  //
  // `/work/$slug` declares its own notFoundComponent, which takes precedence
  // inside that subtree: an unknown case study gets an answer about case
  // studies, and everything else lands here.
  notFoundComponent: NotFound,
  errorComponent: ErrorState,
  shellComponent: RootDocument,
})

// The navigation, rendered by the shell so the failure states get it too: a
// 404 with no way onward is the page that needs navigation most.
// ~/writing is deliberately absent, and the footer still carries it.
//
// Nothing is published, so it was a third of the primary navigation leading to
// a page whose entire content is one sentence saying there is nothing there.
// For the visitor PRODUCT.md describes, arriving with about two minutes and
// scanning for evidence, that is a wasted click out of three.
//
// The page is honest and stays exactly as it is; what was wrong was promoting
// it. PRODUCT.md's honest-scope rule says unfinished work is described
// accurately or omitted, and the same judgement applies to how prominently it
// is advertised. The footer keeps it reachable, the feed stays discoverable
// from its own head, and it returns here when there is something to read.
const NAV = [
  { to: '/', label: '~/work', exact: true },
  { to: '/about', label: '~/about', exact: false },
] as const

// WCAG 2.4.1, Bypass Blocks. Every page on this site put three navigation
// links and a button between the top of the document and the first word of
// content, so a keyboard or switch user paid four stops on every navigation to
// reach the thing they came for. SiteFooter.tsx already shows the care taken
// over 2.4.5 Multiple Ways; this is the criterion next to it.
//
// Off screen until it takes focus, then the first thing on the page. It is the
// first element in the body, because a skip link that is not first is a link
// to skip the things you have already tabbed through.
//
// The target is `#content`, which every route's <main> carries.
//
// Inside the banner rather than a bare first child of <body>, which is the
// more common placement. It is still the first focusable element in the
// document, which is the only property that matters, and it keeps every
// focusable element on the site inside one of the three landmarks the
// accessibility suite walks.
function SkipLink() {
  return (
    <a className="skip-link" href="#content" data-testid="skip-link">
      Skip to content
    </a>
  )
}

function SiteNav() {
  return (
    <header className="site-nav" data-testid="site-nav">
      <SkipLink />
      <div className="shell site-nav-inner">
        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV.map((destination) => (
              <li key={destination.to}>
                <Link
                  className="nav-link"
                  to={destination.to}
                  activeOptions={{ exact: destination.exact }}
                  activeProps={{ 'aria-current': 'page' }}
                >
                  {destination.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Outline, not fill. The hero carries the page's one orange fill, and
            a second one in the navigation competed with it on every scroll
            position. Still a button rather than a fourth ~/path link, because
            this is the only conversion affordance that survives a long scroll.
            
            "Contact" rather than the hero's "Start a conversation": this is
            navigation, where the register is a destination and not an
            invitation, and the longer phrase overflows the bar at 375px. */}
        <Button asChild variant="outline" size="sm">
          <Link to="/contact">Contact</Link>
        </Button>
      </div>
    </header>
  )
}

// Both states are written as what they are: a terminal register line about a
// page that does not exist, and one about a page that did not render.
//
// No apology paragraph, because an apology is a sentence the reader has to
// finish before learning anything. No illustration, because the site has no
// illustration anywhere and inventing one for the failure states means the
// most decorative page is the one nobody wanted to reach. No joke, because a
// visitor who mistyped an address wants the address, and PRODUCT.md's voice
// does not exclaim.
//
// The address that was asked for is printed back, because a 404 that does not
// say what it could not find leaves a visitor unable to tell a typing slip
// from a dead link somebody else published.

function Failure({
  title,
  lines,
  children,
}: {
  title: string
  lines: Array<{ label: string; value: string }>
  children?: ReactNode
}) {
  return (
    <main id="content" tabIndex={-1} data-testid="failure">
      <section className="shell section page-centered page-head">
        <p className="prompt" data-testid="failure-prompt">
          <span className="prompt-user">mehby</span>
          <span className="prompt-host">@dev:~$</span>
          <span>echo</span>
          <span className="cursor" aria-hidden="true" />
        </p>
        <h1 className="page-title" data-testid="failure-title">
          {title}
        </h1>
        {lines.map((line) => (
          <p className="log-line" key={line.label}>
            <b>{line.label}</b> {line.value}
          </p>
        ))}
        <div className="page-actions">
          <Link className="nav-link" to="/">
            ~/work
          </Link>
          {children}
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
    <Failure
      title="error: page not found"
      lines={[
        { label: 'status', value: '404' },
        { label: 'path', value: pathname },
        { label: 'cause', value: 'no route on this site matches it' },
      ]}
    />
  )
}

function ErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <Failure
      title="error: this page did not render"
      lines={[
        { label: 'status', value: '500' },
        { label: 'cause', value: error.message || 'unreported' },
        {
          label: 'scope',
          value: 'this page, the rest of the site is unaffected',
        },
      ]}
    >
      {/* Second action, not a replacement for the first. The error may be
          transient, and re-rendering is cheaper for the visitor than
          navigating away and coming back. */}
      <Button variant="outline" size="sm" type="button" onClick={reset}>
        Try again
      </Button>
    </Failure>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* The navigation and footer sit outside {children}, so they are
            siblings of the route's <main> rather than inside it. The route's
            main element is what every page-level assertion scopes to, and the
            chrome belongs to the contentinfo and banner landmarks, not the
            main one. Rendered by the shell, so the failure states get them
            too. */}
        <SiteNav />
        {children}
        <SiteFooter />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
