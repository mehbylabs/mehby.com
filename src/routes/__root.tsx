import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Grid } from '#/components/Grid'
import { SectionField } from '#/components/SectionField'
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

// Both states are written as what they are: a specification for a page that
// does not exist, and a specification for one that did not render. The
// alternative shapes were all rejected deliberately.
//
// No apology paragraph, because an apology is a sentence the reader has to
// finish before learning anything. No illustration, because the site has no
// illustration anywhere and inventing one for the failure states means the
// most decorative page is the one nobody wanted to reach. No joke, because a
// visitor who mistyped an address wants the address, and PRODUCT.md's voice
// does not exclaim.
//
// The table is the same specification table the case studies are presented
// with, so the failure state reads as part of the same document rather than as
// a page from another site. It is a plain <table> rather than the SpecTable
// component because SpecTable's rows are a fixed vocabulary about a case study
// (role, period, surfaces, source, stack) and none of them describe this.

function FailureField({
  title,
  caption,
  rows,
  children,
}: {
  title: string
  caption: string
  rows: Array<{ label: string; value: ReactNode }>
  children?: ReactNode
}) {
  return (
    <main>
      {/* One band, carrying the page. A short field over an empty paper ground
          reads as a render that stopped halfway, which is the one thing an
          error state must not look like. */}
      <SectionField tone="ultramarine" className="page-field">
        <Grid>
          <div className="page-head col-span-full lg:col-span-7">
            <h1 className="page-title" data-testid="failure-title">
              {title}
            </h1>
          </div>

          <table className="timeline col-span-full lg:col-span-6">
            <caption className="spec-caption">{caption}</caption>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="page-actions col-span-full">
            <Link className="action" to="/">
              Home
            </Link>
            {children}
          </p>
        </Grid>
      </SectionField>
    </main>
  )
}

function NotFound() {
  // The address that was asked for, printed back. A 404 that does not say what
  // it could not find leaves a visitor unable to tell a typing slip from a
  // dead link somebody else published.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <FailureField
      title="No page at this address"
      caption="Specification: a page that does not exist"
      rows={[
        { label: 'Status', value: '404' },
        { label: 'Address', value: pathname },
        { label: 'Cause', value: 'No route on this site matches it' },
        { label: 'Content', value: 'None. Nothing was moved or removed' },
      ]}
    />
  )
}

function ErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <FailureField
      title="This page did not render"
      caption="Specification: a page that failed"
      rows={[
        { label: 'Status', value: '500' },
        { label: 'Cause', value: error.message || 'Unreported' },
        {
          label: 'Scope',
          value: 'This page. The rest of the site is unaffected',
        },
      ]}
    >
      {/* Second action, not a replacement for the first. The error may be
          transient, and re-rendering is cheaper for the visitor than
          navigating away and coming back. */}
      <button className="action" type="button" onClick={reset}>
        Try again
      </button>
    </FailureField>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Outside {children}, so it is a sibling of the route's <main> and
            lands in the contentinfo landmark rather than inside the main one.
            Rendered by the shell, so the failure states get it too: a 404 with
            no way onward is the page that needs navigation most. */}
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
