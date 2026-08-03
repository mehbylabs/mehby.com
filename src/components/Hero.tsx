import { Link } from '@tanstack/react-router'
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

export function Hero() {
  return (
    <header data-testid="hero">
      <p className="prompt" data-testid="hero-prompt">
        <span className="prompt-user">mehby</span>
        <span className="prompt-host">@dev:~$</span>
        <span>whoami</span>
        <span className="cursor" aria-hidden="true" />
      </p>

      <div className="section" style={{ paddingBlock: '1.5rem' }}>
        <h1 className="hero-name" data-testid="hero-name">
          Mohamed Elhedi Ben Yedder
        </h1>
        <p className="log-line" style={{ marginTop: '0.5rem' }}>
          <b>CTO and co-founder of CoaChess</b> / available for freelance
          product engineering
        </p>
      </div>

      <p className="hero-display" data-testid="hero-display">
        I build and ship full stack products, end to end.
      </p>

      <div className="hero-actions" style={{ marginTop: '2rem' }}>
        <Button asChild size="lg">
          <Link to="/work/$slug" params={{ slug: 'coachess' }}>
            See the work
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/contact">Hire me</Link>
        </Button>
      </div>
    </header>
  )
}
