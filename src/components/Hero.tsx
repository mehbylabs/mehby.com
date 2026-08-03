import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'

// The drenched opening band. PRODUCT.md gives this section a job that is not
// "look impressive": a prospective client arrives mid-conversation with about
// two minutes and is scanning for evidence that this person ships. So the
// order is who, what, and then two ways forward, with nothing between them.
//
// Three decisions worth defending:
//
// 1. The <h1> is the name, not the display line. The display line is the
//    loudest thing on the page and the strongest candidate, but a heading is
//    the document's title in the accessibility tree and in search results, and
//    "I build and ship full stack products, end to end." is a claim rather
//    than a title. Visual weight and heading level are different questions and
//    are answered separately here.
//
// 2. Left aligned. DESIGN.md permits the display line to be centred and only
//    if it reads better that way. It does not: everything else on the page
//    hangs off one left margin, and a centred line inside that reads as a
//    different page pasted in. The permission is declined deliberately rather
//    than overlooked.
//
// 3. `Hire me` is a plain <a>, not a <Link>. There is no /contact route yet,
//    and a typed Link to a route that does not exist does not compile. See
//    NOT_PRERENDERED in vite.config.ts for the other half of that gap.

// One orchestrated reveal, staggered, as DESIGN.md specifies and then stops.
// The index is inline because it is per-element data, not style, and the
// animation that reads it lives in styles.css with its timing and easing.
// prefers-reduced-motion collapses the whole thing in the base layer, which is
// why nothing here checks for it.
const step = (index: number) => ({ '--reveal-index': index }) as CSSProperties

export function Hero() {
  return (
    <header className="hero col-span-full" data-testid="hero">
      <div className="hero-identity" style={step(0)}>
        <h1 className="hero-name">Mohamed Elhedi Ben Yedder</h1>
        <p className="hero-credential">CTO and co-founder of CoaChess</p>
      </div>

      {/* The one display-step line on the site. Its size, its width axis, its
          leading and its measure are set together in .hero-display: at up to
          6.4rem the inherited body leading of 1.6 is a 10rem line box, and
          Archivo's Expanded cut is what DESIGN.md reserves for this step. */}
      <p className="hero-display" data-testid="hero-display" style={step(1)}>
        I build and ship full stack products, end to end.
      </p>

      <p className="hero-subline" style={step(2)}>
        Available for freelance product engineering.
      </p>

      <p className="hero-actions" style={step(3)}>
        <Link
          className="action action-primary"
          to="/work/$slug"
          params={{ slug: 'coachess' }}
        >
          See the work
        </Link>
        <a className="action" href="/contact">
          Hire me
        </a>
      </p>
    </header>
  )
}
