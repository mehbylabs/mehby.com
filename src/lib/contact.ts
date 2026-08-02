import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// The contact form's server half.
//
// Shape of this module, and why: `submitContact` takes the sender as an
// argument and knows nothing about email. `createResendSender` knows about
// Resend and nothing about validation. The server function is the one line
// that joins them.
//
// That split is not a testing convenience. There is no API key in this
// environment, and there will not be one in CI, so a module that reached for a
// provider at import time could not be exercised at all: the five outcomes
// below would be verified by reading them. With the sender as a parameter,
// every outcome including the failure path is proved without a network, and the
// one thing that genuinely needs a key is the one thing left untested.

/** Where enquiries go. Not configurable: it is the address printed on the page. */
export const CONTACT_DESTINATION = 'hello@mehby.com'

export type ContactField = 'name' | 'email' | 'message'

export type OutboundMessage = {
  to: string
  /** The visitor's address, so a reply is one keystroke rather than a copy and paste. */
  replyTo: string
  subject: string
  body: string
}

/** Anything that can deliver a message. Resolved at call time, never at import. */
export type Sender = (message: OutboundMessage) => Promise<void>

export type ContactOutcome =
  | { status: 'sent' }
  | { status: 'invalid'; errors: Partial<Record<ContactField, string>> }
  | { status: 'failed'; reason: string }

// Transport shape. Every field is present on every real submission because the
// form posts all four, so a payload that does not match this is a broken client
// or a hostile request, not a visitor mistake. It throws, which surfaces as a
// server error and lands in the logs, instead of being dressed up as a field
// message nobody can act on.
const payloadSchema = z.object({
  name: z.string(),
  email: z.string(),
  message: z.string(),
  // The honeypot. Optional so an older cached client that does not send it
  // still works, rather than every one of its submissions throwing.
  company: z.string().optional().default(''),
})

export type ContactPayload = z.input<typeof payloadSchema>

// Field rules, separate from transport. Every message is written in the site's
// voice: plain, declarative, no apology and no exclamation. Zod's own defaults
// ("Invalid email address") would ship straight into the interface otherwise.
//
// Values are trimmed before they reach this, so `min(1)` is a real emptiness
// check rather than a check that the visitor pressed the space bar.
const fieldSchema = z.object({
  name: z.string().min(1, 'Tell me your name.'),
  email: z
    .string()
    .min(1, 'An email address is required, or I have no way to reply.')
    .pipe(z.email('That does not look like an email address.')),
  message: z.string().min(1, 'Tell me what you are building.'),
})

const firstErrors = (error: z.ZodError) => {
  const errors: Partial<Record<ContactField, string>> = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as ContactField | undefined
    // First issue per field wins. A field with both a length and a format
    // problem has one input and therefore gets one message.
    if (field && !(field in errors)) errors[field] = issue.message
  }
  return errors
}

/**
 * Validates a submission and hands it to `send`.
 *
 * Never throws for anything a visitor can do; the three outcomes it returns are
 * the three things the interface has to render.
 */
export async function submitContact(
  input: unknown,
  send: Sender,
): Promise<ContactOutcome> {
  const payload = payloadSchema.parse(input)

  // Before validation, deliberately. A bot that fills the honeypot usually
  // fills the real fields badly too, so validating first would hand it a field
  // error naming the trap it fell into and teach it to avoid the field next
  // time. Trimmed, because a browser that autofills a space into a hidden
  // input would otherwise silently discard a real enquiry.
  if (payload.company.trim() !== '') return { status: 'sent' }

  const parsed = fieldSchema.safeParse({
    name: payload.name.trim(),
    email: payload.email.trim(),
    message: payload.message.trim(),
  })

  if (!parsed.success) {
    return { status: 'invalid', errors: firstErrors(parsed.error) }
  }

  const { name, email, message } = parsed.data

  try {
    await send({
      to: CONTACT_DESTINATION,
      replyTo: email,
      subject: `Enquiry from ${name}`,
      // The address is repeated in the body on purpose: a reply-to header is
      // one header away from being lost by a forwarding rule, and the one fact
      // that must survive is how to answer.
      body: `${name} <${email}>\n\n${message}\n`,
    })
  } catch (cause) {
    // Logged and reported. Swallowing this would show the visitor a thank-you
    // for an enquiry that reached nobody, which is the worst available outcome
    // for a page whose only job is to start a conversation.
    console.error('contact: the message could not be sent', cause)
    return {
      status: 'failed',
      reason: 'The message could not be sent. Try again, or email me directly.',
    }
  }

  return { status: 'sent' }
}

/** What Resend answers with. It reports failure in the body, not by throwing. */
export type Delivery = { error: { name: string; message: string } | null }

/** One call to the provider. The seam between our rules and their SDK. */
export type Deliver = (
  key: string,
  message: OutboundMessage,
) => Promise<Delivery>

// The only function in this module that knows Resend's field names, and it is
// field mapping with no branches. It is imported dynamically so the provider
// SDK is not pulled into the graph of a route that merely renders the form.
//
// This is the one thing here a key would be needed to exercise, which is why
// everything that can be decided without one has been moved out of it.
const resendDeliver: Deliver = async (key, message) => {
  const { Resend } = await import('resend')

  return await new Resend(key).emails.send({
    // The `from` domain has to be one verified with the provider. Left
    // configurable so deployment can set it without a code change, with
    // Resend's own sandbox sender as the value that at least fails honestly.
    from: process.env.CONTACT_FROM ?? 'Portfolio <onboarding@resend.dev>',
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.body,
  })
}

/**
 * A sender backed by Resend.
 *
 * The key is read inside the returned function, not here. Reading it at
 * construction would throw during prerender on any machine without one, which
 * is every machine in CI, and would fail the build over a form nobody
 * submitted. Reading it at call time fails loudly at the only moment the answer
 * matters.
 *
 * `env` and `deliver` are both parameters with real defaults, for the same
 * reason: the two facts this function asserts, that a missing key is refused
 * and that a rejected send is not reported as a delivery, are exactly the two
 * that cannot be checked against a live provider without a key and a network.
 */
export function createResendSender(
  env: Record<string, string | undefined> = process.env,
  deliver: Deliver = resendDeliver,
): Sender {
  return async (message) => {
    const key = env.RESEND_API_KEY

    if (!key) {
      throw new Error(
        'RESEND_API_KEY is not set, so the enquiry cannot be delivered. ' +
          'Refusing rather than reporting a send that did not happen.',
      )
    }

    const { error } = await deliver(key, message)

    // Resend reports failure in the response rather than by throwing, so a
    // caller that only guards against exceptions treats a rejected send as a
    // success and tells the visitor their message is on its way.
    if (error) throw new Error(`${error.name}: ${error.message}`)
  }
}

/**
 * The one line that joins the two halves. Validation and delivery are both
 * tested directly in contact.test.ts; this exists so the browser can reach
 * them, and so the provider key never leaves the server.
 */
export const sendContactMessage = createServerFn({ method: 'POST' })
  .validator((data: ContactPayload) => data)
  .handler(({ data }) => submitContact(data, createResendSender()))
