import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { Button } from '#/components/ui/button'

// The terminal hero. It opens like a session: a prompt, a command, an answer.
// `whoami` outputs the name and the credential, then the statement that the
// rest of the page exists to prove.
//
// The <h1> is the name, not the display line. The display line is the loudest
// thing on the page and the strongest candidate, but a heading is the
// document's title in the accessibility tree and in search results, and "I
// build and ship full stack products, end to end." is a claim rather than a
// title. The name is both.
//
// Left aligned. Everything on the page hangs off one left margin, and a
// centred line inside that reads as a different page pasted in.
//
// The entrance stagger: each element carries its index and the `.rise-in`
// animation reads it. The index is per-element data, not style, which is why
// it is inline. prefers-reduced-motion is handled in the base layer, which
// collapses every duration, so nothing here checks for it.

const step = (index: number) => ({ '--stagger-index': index }) as CSSProperties

export function Hero() {
  return (
    <header data-testid="hero">
      <p className="prompt rise-in" data-testid="hero-prompt" style={step(0)}>
        <span className="prompt-user">mehby</span>
        <span className="prompt-host">@dev:~$</span>
        <span>whoami</span>
        <span className="cursor" aria-hidden="true" />
      </p>

      <div className="hero-identity rise-in" style={step(1)}>
        <h1 className="hero-name" data-testid="hero-name">
          Mohamed Elhedi Ben Yedder
        </h1>
        <p className="hero-credential log-line">
          <b>CTO and co-founder of CoaChess</b> / available for freelance
          product engineering
        </p>
      </div>

      <p
        className="hero-display rise-in"
        data-testid="hero-display"
        style={step(2)}
      >
        I build and ship full stack products, end to end.
      </p>

      <div
        className="hero-actions rise-in"
        data-testid="hero-actions"
        style={step(3)}
      >
        {/* One orange fill on the page, and it belongs to the work.
            
            Both of these used to be `variant="default"`, which put two orange
            fills within 200 vertical pixels pointing at different
            destinations, and the larger of the two went to the exploratory
            action. A visitor could not tell which one was the site's ask.
            
            The work keeps the fill because exploration is the correct first
            action for a two minute scan: PRODUCT.md's visitor is deciding
            whether this person ships, and the evidence is what answers that.
            The conversation sits beside it as the outline, and is the fill on
            the page where it is the only thing being asked for. */}
        <Button asChild size="lg">
          <Link to="/work/$slug" params={{ slug: 'coachess' }}>
            See the work
          </Link>
        </Button>
        {/* "Hire me" presumed the decision. PRODUCT.md defines the job as
            deciding whether to start a conversation, and says the voice does
            not sell; the site already owned the right phrase and had it on
            zero buttons. */}
        <Button asChild variant="outline" size="lg">
          <Link to="/contact">Start a conversation</Link>
        </Button>
      </div>
    </header>
  )
}
