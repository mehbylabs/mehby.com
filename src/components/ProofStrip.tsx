import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { checkLive } from '#/lib/live'
import type { LiveStatus } from '#/lib/live'

// Three live URLs, directly under the hero, and the one place the site is
// allowed to assert "live".
//
// This is the answer to the strategic problem PRODUCT.md names: the owner's
// substantial recent work is private, and a visitor who checks GitHub finds
// university projects from 2020. The credibility is carried here, by addresses
// a visitor can open in a second tab, rather than delegated to a public
// repository list.
//
// Each address is checked for real, at request time, by a server function that
// pings the same frontmatter the build gate verifies. The initial render shows
// the honest "checking" state; the result arrives over the wire. Green is
// earned by a live response and used nowhere else on the site.

export type ProofLink = {
  label: string
  href: string
}

export type ProofStripProps = {
  surfaces: ReadonlyArray<ProofLink>
}

const initial: Record<string, LiveStatus | 'pending' | undefined> = {}

export function ProofStrip({ surfaces }: ProofStripProps) {
  const [states, setStates] =
    useState<Record<string, LiveStatus | 'pending' | undefined>>(initial)

  useEffect(() => {
    let alive = true
    checkLive()
      .then((results) => {
        if (!alive) return
        const next: Record<string, LiveStatus> = {}
        for (const result of results) next[result.url] = result
        setStates(next)
      })
      .catch(() => {
        // Leave every address in its checking state. A failed check is not
        // evidence of a dead product, and claiming one either way would lie.
      })
    return () => {
      alive = false
    }
  }, [])

  if (surfaces.length === 0) return null

  return (
    <div className="section rise-in" data-testid="proof-strip" style={{ '--stagger-index': 4 } as CSSProperties}>
      <p className="log-line" id="proof-label" style={{ marginBottom: '1rem' }}>
        <b># live</b> three products, checked just now
      </p>
      <ul
        className="proof-list"
        aria-labelledby="proof-label"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {surfaces.map((link) => {
          const state = states[link.href]
          const live = state !== undefined && state !== 'pending' && state.ok
          const checking = state === undefined || state === 'pending'
          const cls = live
            ? 'status status-live'
            : checking
              ? 'status status-checking'
              : 'status status-dead'

          return (
            <li key={link.href}>
              <a
                className="tcard tcard-chip"
                data-testid="proof-link"
                href={link.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.55rem 1rem',
                  border: '1px solid var(--color-edge-strong)',
                  borderRadius: '0.375rem',
                  background: 'var(--color-panel)',
                  textDecoration: 'none',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 'var(--text-data)',
                }}
              >
                <span className={cls} data-testid="proof-status">
                  <span className="status-dot" aria-hidden="true" />
                  {checking
                    ? 'checking…'
                    : live
                      ? `LIVE · ${state.status}`
                      : 'offline'}
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
