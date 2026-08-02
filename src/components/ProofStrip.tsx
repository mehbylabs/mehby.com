import type { CSSProperties } from 'react'

// Three live URLs, directly under the hero and still on the drenched field.
//
// This is the site's answer to the strategic problem PRODUCT.md names: the
// owner's substantial recent work is private, and a visitor who checks GitHub
// finds university projects from 2020. The credibility has to be carried here,
// by addresses a visitor can open in a second tab, rather than delegated to a
// public repository list.
//
// Set in Martian Mono because DESIGN.md lists link URLs among the things that
// are data. The typeface is earned by the content and is not worn as a
// technical costume: nothing else on this page is monospaced.
//
// No border and no fill on the links, deliberately. Three short enclosed
// labels sharing a parent is the badge wall PRODUCT.md bans, and it is exactly
// the shape this component would take if the links were styled as chips.
// tests/e2e/home.spec.ts measures for that shape rather than for a class name.

export type ProofLink = {
  label: string
  href: string
}

export const PROOF_LINKS: ReadonlyArray<ProofLink> = [
  { label: 'coachess.net', href: 'https://coachess.net' },
  { label: 'app.coachess.net', href: 'https://app.coachess.net' },
  { label: 'live.coachess.net', href: 'https://live.coachess.net' },
]

export function ProofStrip() {
  return (
    <div
      className="proof-strip col-span-full"
      data-testid="proof-strip"
      style={{ '--reveal-index': 4 } as CSSProperties}
    >
      {/* Names the list for assistive technology as well as painting the
          label, so the three addresses are not announced as a bare list of
          links with no reason to exist. */}
      <p className="proof-label" id="proof-label">
        Shipping now
      </p>
      <ul className="proof-list" aria-labelledby="proof-label">
        {PROOF_LINKS.map((link) => (
          <li key={link.href}>
            <a className="proof-link" data-testid="proof-link" href={link.href}>
              {/* The signal dot carries the "live" meaning, and the label is
                  set in paper. DESIGN.md: --signal-on-color reaches 3.50
                  against ultramarine, which clears the non-text threshold and
                  not the 4.5 body-text one, and no usable lightness of a warm
                  hue does. Decorative, so it is hidden rather than described. */}
              <span className="proof-dot" aria-hidden="true" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
