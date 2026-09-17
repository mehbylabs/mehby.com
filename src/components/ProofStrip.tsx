import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { checkLive } from '#/lib/live'
import type { LiveStatus } from '#/lib/live'

// The live addresses, directly under the hero, and the one place the site is
// allowed to assert "live".
//
// This is the answer to the strategic problem PRODUCT.md names: the owner's
// substantial recent work is private, and a visitor who checks GitHub finds
// university projects from 2020. The credibility is carried here, by addresses
// a visitor can open, rather than delegated to a public repository list.
//
// Each address is checked for real, at request time, by a server function that
// pings the same frontmatter the build gate verifies. Green is earned by a
// live response and used nowhere else on the site.
//
// Three states, and the difference between them is the whole point. PRODUCT.md
// asks for proof over claim, so the label may not say anything has been
// checked until something has: the prerendered document ships `checking`, and
// the count arrives with the answer. A check that never completes says so,
// rather than sitting in `checking` forever and reading as a hung page, and it
// says so in muted rather than red, because a failed check is not evidence of
// a dead product and red is reserved for one that answered badly.

export type ProofLink = {
  label: string
  href: string
  /** The case study this address belongs to. Named, not counted. */
  project: string
}

export type ProofStripProps = {
  surfaces: ReadonlyArray<ProofLink>
}

type Phase = 'checking' | 'answered' | 'unreachable'

const initial: Record<string, LiveStatus | undefined> = {}

export function ProofStrip({ surfaces }: ProofStripProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [states, setStates] =
    useState<Record<string, LiveStatus | undefined>>(initial)

  useEffect(() => {
    let alive = true
    checkLive()
      .then((results) => {
        if (!alive) return
        const next: Record<string, LiveStatus> = {}
        for (const result of results) next[result.url] = result
        setStates(next)
        setPhase('answered')
      })
      .catch(() => {
        // The check itself did not complete: offline, a deploy mid-request, a
        // server function that threw. Distinct from an address that answered
        // badly, and reported as its own state rather than left looking like
        // a check still in progress.
        if (alive) setPhase('unreachable')
      })
    return () => {
      alive = false
    }
  }, [])

  if (surfaces.length === 0) return null

  const responding = surfaces.filter((link) => states[link.href]?.ok).length

  // Where these addresses come from, said plainly.
  //
  // The label used to read "4 surfaces", which implied four things shipped.
  // They are four surfaces of one platform, and the two most recent case
  // studies declare none at all, so the strip was showing breadth it did not
  // have while saying nothing about the depth it did. Naming the platform is
  // both more honest and better evidence than an anonymous count: four live
  // surfaces of one product is a harder thing to build than four addresses.
  const projects = [...new Set(surfaces.map((link) => link.project))]
  const provenance =
    projects.length === 1
      ? `${surfaces.length} surfaces of ${projects[0]}`
      : `${surfaces.length} surfaces across ${projects.length} projects`

  const status =
    phase === 'answered'
      ? `${responding} responding`
      : phase === 'unreachable'
        ? 'the check did not complete, open them and see'
        : 'checking'

  return (
    // Last in the hero's entrance sequence: prompt, identity, statement,
    // actions, then the evidence under them. The index is per-element data
    // rather than style, which is why it is inline.
    <div
      className="proof-strip rise-in"
      data-testid="proof-strip"
      style={{ '--stagger-index': 4 } as CSSProperties}
    >
      {/* The summary is the live region, not the list. A list of four chips
          that each mutate announces four fragments and a result nobody
          assembled; one sentence announces the answer. Mounted from the first
          render with text in it, so the change is something assistive
          technology can compare against. */}
      <p
        className="log-line proof-label"
        id="proof-label"
        data-testid="proof-label"
        data-phase={phase}
        role="status"
        aria-live="polite"
      >
        <b># live</b> {provenance}, {status}
      </p>
      <ul className="proof-list" aria-labelledby="proof-label">
        {surfaces.map((link) => {
          const state = states[link.href]
          const live = state?.ok === true
          const cls = live
            ? 'status status-live'
            : phase === 'answered'
              ? 'status status-dead'
              : 'status status-checking'

          return (
            <li key={link.href}>
              {/* Opens away. This strip is the site's evidence and it was also
                  its highest traffic exit: four addresses that replaced the
                  portfolio with somebody else's product and left no route
                  back. `noopener` denies the opened page a handle on this one,
                  `noreferrer` keeps the visit out of the destination's
                  referrer log. */}
              <a
                className="tcard tcard-chip"
                data-testid="proof-link"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={cls} data-testid="proof-status">
                  <span className="status-dot" aria-hidden="true" />
                  {/* Reserved to the longest word this can say. The status
                      starts as `checking` and becomes `LIVE`, which is four
                      characters narrower, so without a reserved box every chip
                      resizes when the answer lands and the whole row reflows.
                      tests/e2e/performance.spec.ts asserts a cumulative layout
                      shift of exactly zero on this page, and it means it. */}
                  <span className="status-label">
                    {live
                      ? 'LIVE'
                      : phase === 'answered'
                        ? 'offline'
                        : phase === 'unreachable'
                          ? 'unchecked'
                          : 'checking'}
                  </span>
                </span>
                {link.label}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
