import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { CONTACT_DESTINATION, sendContactMessage } from '#/lib/contact'
import { pageHead } from './-seo'
import type { ContactField, ContactOutcome } from '#/lib/contact'
import type { FormEvent } from 'react'

// The site's only conversion, and therefore the page with the most ways to
// fail quietly.
//
// Inline, on the page. DESIGN.md bans modals outright, and a contact modal is
// the specific one worth naming: it hides the only action the site is asking
// for behind a click, cannot be linked to, and traps focus around a form that
// has no reason to trap anything.
//
// The address is printed above the form and is not a fallback nobody sees. It
// is the whole interface for a visitor with JavaScript off, since a server
// function is an RPC endpoint and cannot be a plain form action, and it is the
// escape hatch when the provider is down. Printing it also follows PRODUCT.md's
// proof-over-claim rule: a button labelled "Get in touch" withholds the one
// fact needed to act.
//
// The fields carry mono labels with an amber `$` glyph, the terminal's prompt
// register. The `$` is hidden from the accessibility tree so the field's
// accessible name is just the word.
//
// Validation is server side, and the form carries `noValidate` so the browser
// does not intercept first. Two reasons that is deliberate rather than lazy:
// the rules that decide whether an enquiry is deliverable live on the server
// and are tested there, and native constraint bubbles are unstyled, transient,
// and invisible to a screen reader that is not focused on the field at the
// moment they appear. `type="email"` stays, because it still selects the right
// keyboard on a phone.

export const Route = createFileRoute('/contact')({
  component: Contact,
  head: () =>
    pageHead({
      title: 'Start a conversation with Mohamed Elhedi Ben Yedder',
      description:
        'Tell me what you are building and what is in the way. The form reaches me directly, the address is printed beside it, and I reply to everything.',
      path: '/contact',
    }),
})

const FIELD_ORDER: Array<ContactField> = ['name', 'email', 'message']

const errorId = (field: ContactField) => `contact-${field}-error`

// One sentence per outcome, in the live region. The invalid case deliberately
// does not repeat the field messages: they are already associated with their
// inputs, and hearing all three twice is worse than hearing them once. The
// failed case carries the reason the server gave, because "something went
// wrong" is not something a visitor can act on.
const summarise = (outcome: ContactOutcome | null) => {
  if (outcome === null) return ''
  // The sent case is deliberately silent here. It is the one outcome that
  // replaces the form with a panel of its own, and focus moves to that panel,
  // which assistive technology reads on arrival. Announcing the same sentence
  // from the live region as well says it twice.
  if (outcome.status === 'sent') return ''
  if (outcome.status === 'invalid')
    return 'Nothing was sent. The fields marked below need attention.'
  return outcome.reason
}

function Contact() {
  const [pending, setPending] = useState(false)
  const [outcome, setOutcome] = useState<ContactOutcome | null>(null)
  const [sentTo, setSentTo] = useState('')
  const sentPanel = useRef<HTMLDivElement>(null)
  // False on the server and through the first client render, true once React
  // has hydrated. See the two comments on the submit button for what it is
  // for: without it there is a real window, measured in this build and not
  // hypothetical, in which pressing Send performs a native form submission,
  // navigates away, and loses everything the visitor typed.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  const errors = outcome?.status === 'invalid' ? outcome.errors : {}
  const summary = summarise(outcome)
  const sent = outcome?.status === 'sent'

  // Focus follows the content. The Send button the visitor pressed is gone
  // once the panel replaces the form, and focus left on a removed element
  // falls to the body, which drops a keyboard user to the top of the document
  // with no announcement of what happened.
  useEffect(() => {
    if (sent) sentPanel.current?.focus()
  }, [sent])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Guarded rather than disabled. A disabled button loses focus to the body
    // mid-submission, which drops a keyboard user out of the form.
    if (pending) return

    const form = event.currentTarget
    const data = new FormData(form)
    const read = (field: string) => String(data.get(field) ?? '')

    setPending(true)
    let result: ContactOutcome
    try {
      result = await sendContactMessage({
        data: {
          name: read('name'),
          email: read('email'),
          message: read('message'),
          company: read('company'),
        },
      })
    } catch (cause) {
      // The transport itself broke: offline, a 500, a deploy mid-request. The
      // one thing that must not happen here is nothing, which is what an
      // unhandled rejection looks like on screen.
      console.error('contact: the request did not complete', cause)
      result = {
        status: 'failed',
        reason:
          'The message could not be sent. Try again, or email me directly.',
      }
    } finally {
      setPending(false)
    }

    setOutcome(result)

    if (result.status === 'sent') {
      // Kept so the confirmation can name the address the reply is going to.
      // A visitor who mistyped their own email should be able to see that from
      // the confirmation rather than from the silence that follows.
      setSentTo(read('email'))
      form.reset()
      return
    }

    if (result.status === 'invalid') {
      // The live region says something is wrong; this says where. Without it a
      // keyboard user is left at the submit button and has to walk back up the
      // form to find out which field the announcement was about.
      const first = FIELD_ORDER.find((field) => result.errors[field])
      if (first) {
        const element = form.elements.namedItem(first)
        if (element instanceof HTMLElement) element.focus()
      }
    }
  }

  const field = (name: ContactField) => ({
    id: `contact-${name}`,
    name,
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? errorId(name) : undefined,
  })

  // The invalid state is carried by a thicker amber border, never by red: red
  // is reserved for live status. The width change is what keeps the state
  // legible beyond colour (WCAG 1.4.1), and amber on bg measures 12.45.
  const invalidStyle =
    'aria-invalid:border-amber aria-invalid:border-2 aria-invalid:ring-amber/20'

  return (
    <main id="content" tabIndex={-1}>
      <section className="shell section">
        <div className="section-path">
          <span className="section-path-code">~/contact</span>
          <h1 className="page-title">Start a conversation</h1>
        </div>
        <p className="page-intro">
          Tell me what you are building and what is in the way. I reply to
          everything.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <a className="contact-address" href={`mailto:${CONTACT_DESTINATION}`}>
            {CONTACT_DESTINATION}
          </a>
        </p>
      </section>

      <section className="shell section" style={{ paddingTop: 0 }}>
        <form
          className="contact-form"
          data-testid="contact-form"
          method="post"
          noValidate
          aria-busy={pending || undefined}
          onSubmit={onSubmit}
        >
          {/* Mounted from the first render, always, and never conditionally
              rendered. A live region inserted into the DOM at the same moment
              it gains text is frequently not announced at all: the assistive
              technology has nothing to compare the change against. */}
          <p
            className="form-status"
            data-testid="contact-status"
            data-status={outcome?.status ?? 'idle'}
            role="status"
            aria-live="polite"
          >
            {summary}
          </p>

          {/* The peak-end moment of the site's only flow.
              
              It used to be this: the form emptied itself, focus stayed on the
              Send button, and the sole confirmation was the line above at
              --text-fine in --color-muted, which is the smallest type size on
              the site in its lowest contrast text colour. A sighted keyboard
              user saw three cleared fields and no visible reason, and a screen
              reader user heard one sentence and was left in a form that no
              longer held anything they had written.
              
              So the form is replaced rather than reset in place, the
              confirmation is set at the same step as a subsection heading, and
              it names the address the reply is going to so a visitor who
              mistyped their own email finds out now rather than never. */}
          {sent ? (
            <div
              className="form-sent"
              data-testid="contact-sent"
              ref={sentPanel}
              tabIndex={-1}
            >
              <p className="form-sent-headline">Message sent.</p>
              <p className="form-sent-detail">
                I reply to everything, and the reply goes to{' '}
                <b>{sentTo || 'the address you gave'}</b>.
              </p>
            </div>
          ) : null}

          {outcome?.status === 'failed' ? (
            // The retry affordance is the Send button, which is never disabled
            // after a failure, plus the address for a visitor who has had
            // enough of trying.
            <p className="form-alternative">
              <a href={`mailto:${CONTACT_DESTINATION}`}>
                {CONTACT_DESTINATION}
              </a>
            </p>
          ) : null}

          {/* Everything a visitor fills in, gone once they have sent it. An
              emptied form under a confirmation invites a second send nobody
              asked for and reads as though the first one was discarded. */}
          {sent ? null : (
            <>
              <div className="field">
                <Label htmlFor="contact-name" className="field-label">
                  <span className="label-glyph" aria-hidden="true">
                    $
                  </span>{' '}
                  Name
                </Label>
                <Input
                  {...field('name')}
                  className={invalidStyle}
                  type="text"
                  autoComplete="name"
                />
                {errors.name ? (
                  <p className="field-error" id={errorId('name')}>
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <Label htmlFor="contact-email" className="field-label">
                  <span className="label-glyph" aria-hidden="true">
                    $
                  </span>{' '}
                  Email
                </Label>
                <Input
                  {...field('email')}
                  className={invalidStyle}
                  type="email"
                  autoComplete="email"
                />
                {errors.email ? (
                  <p className="field-error" id={errorId('email')}>
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <Label htmlFor="contact-message" className="field-label">
                  <span className="label-glyph" aria-hidden="true">
                    $
                  </span>{' '}
                  What are you building?
                </Label>
                <Textarea
                  {...field('message')}
                  className={invalidStyle}
                  rows={7}
                />
                {errors.message ? (
                  <p className="field-error" id={errorId('message')}>
                    {errors.message}
                  </p>
                ) : null}
              </div>

              {/* The honeypot. Off screen rather than `display: none`, because a
              bot that parses CSS skips a hidden field and fills a visible
              one. tabIndex -1 keeps it out of the keyboard path, and
              aria-hidden keeps it out of the accessibility tree: together
              those are what stop it being a trap for the people it is not
              aimed at. Named `company`, which is a field a form filler
              expects to exist. */}
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="contact-company">Company</label>
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
              </div>

              {/* Two disabled states, two mechanisms, and they are not
              interchangeable.

              Before hydration the button is really `disabled`, because
              nothing else stops a native form submission: the handler that
              calls preventDefault does not exist yet, so a press in that
              window navigates the browser and discards the message. The
              address printed above the form is what a visitor without
              JavaScript uses, and it is on the page for that reason rather
              than as decoration.

              While a request is in flight it is `aria-disabled` instead, and
              the double submit is refused in the handler. A real `disabled`
              here would move focus to the body mid-request and drop a
              keyboard user out of the form they are using. */}
              <div>
                <Button
                  type="submit"
                  data-testid="contact-submit"
                  data-ready={ready || undefined}
                  data-pending={pending || undefined}
                  disabled={!ready}
                  aria-disabled={pending || undefined}
                >
                  {pending ? 'Sending' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  )
}
