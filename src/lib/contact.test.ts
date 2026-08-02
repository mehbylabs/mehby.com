import { expect, describe, it } from 'vitest'
import {
  CONTACT_DESTINATION,
  createResendSender,
  submitContact,
} from '#/lib/contact'
import type { OutboundMessage, Sender } from '#/lib/contact'

// The contact form is the site's only conversion, so every one of its five
// outcomes is exercised here rather than left to a browser test. Four of them
// are invisible on screen and total in effect:
//
//   invalid   the visitor sees a field message instead of a wall of nothing
//   honeypot  a bot is told it succeeded and nothing is sent
//   failed    the provider broke and the visitor is told, rather than lied to
//   sent      the message actually reached the sender, addressed correctly
//
// The sender is a parameter, not a module import, so none of this touches the
// network and no key is needed to prove the logic. `createResendSender` is the
// only part that knows what Resend is, and the one assertion made about it here
// is the one that matters without a key: that it refuses loudly rather than
// pretending.

/** Records what it was asked to send, and succeeds. */
const recordingSender = () => {
  const sent: Array<OutboundMessage> = []
  const send: Sender = async (message) => {
    sent.push(message)
  }
  return { sent, send }
}

/** Fails the test if anything reaches it. Used wherever "sends nothing" is the claim. */
const forbiddenSender: Sender = async () => {
  throw new Error('the sender was called when nothing should have been sent')
}

const valid = {
  name: 'Amel',
  email: 'amel@example.com',
  message: 'We need a tariff engine that does not lie about the exemptions.',
  company: '',
}

describe('a valid submission', () => {
  it('reports that it was sent', async () => {
    const { send } = recordingSender()

    expect(await submitContact(valid, send)).toEqual({ status: 'sent' })
  })

  it('addresses the message to the owner and replies to the visitor', async () => {
    const { sent, send } = recordingSender()

    await submitContact(valid, send)

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(CONTACT_DESTINATION)
    expect(CONTACT_DESTINATION).toBe('hello@mehby.com')
    // Without reply-to, answering the enquiry means copying the address out of
    // the body by hand, which is the step that does not happen.
    expect(sent[0].replyTo).toBe('amel@example.com')
  })

  it('carries the name and the message the visitor typed', async () => {
    const { sent, send } = recordingSender()

    await submitContact(valid, send)

    expect(sent[0].subject).toContain('Amel')
    expect(sent[0].body).toContain(valid.message)
    expect(sent[0].body).toContain('amel@example.com')
  })

  it('trims surrounding whitespace rather than sending it', async () => {
    const { sent, send } = recordingSender()

    await submitContact(
      { ...valid, name: '  Amel  ', email: '  amel@example.com  ' },
      send,
    )

    expect(sent[0].replyTo).toBe('amel@example.com')
    expect(sent[0].subject).toContain('Amel')
    expect(sent[0].subject).not.toContain('  ')
  })
})

describe('an invalid email', () => {
  it('is rejected with a message against the email field', async () => {
    const outcome = await submitContact(
      { ...valid, email: 'amel@' },
      forbiddenSender,
    )

    expect(outcome.status).toBe('invalid')
    // Field-level, not a single form-level string: the visitor has to be told
    // which of three inputs to go back to.
    expect(outcome.status === 'invalid' && outcome.errors.email).toBeTruthy()
    expect(outcome.status === 'invalid' && outcome.errors.name).toBeUndefined()
    expect(
      outcome.status === 'invalid' && outcome.errors.message,
    ).toBeUndefined()
  })

  it('rejects an empty email too', async () => {
    const outcome = await submitContact(
      { ...valid, email: '' },
      forbiddenSender,
    )

    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.errors.email).toBeTruthy()
  })

  it('rejects an address that is only whitespace', async () => {
    const outcome = await submitContact(
      { ...valid, email: '   ' },
      forbiddenSender,
    )

    expect(outcome.status).toBe('invalid')
  })
})

describe('an empty message', () => {
  it('is rejected with a message against the message field', async () => {
    const outcome = await submitContact(
      { ...valid, message: '' },
      forbiddenSender,
    )

    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.errors.message).toBeTruthy()
    expect(outcome.status === 'invalid' && outcome.errors.email).toBeUndefined()
  })

  it('rejects a message that is only whitespace', async () => {
    const outcome = await submitContact(
      { ...valid, message: '  \n  ' },
      forbiddenSender,
    )

    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.errors.message).toBeTruthy()
  })
})

describe('an empty name', () => {
  it('is rejected with a message against the name field', async () => {
    const outcome = await submitContact({ ...valid, name: '' }, forbiddenSender)

    expect(outcome.status).toBe('invalid')
    expect(outcome.status === 'invalid' && outcome.errors.name).toBeTruthy()
  })
})

describe('every field message is written in the site voice', () => {
  it('carries no em dash and no double hyphen', async () => {
    const outcome = await submitContact(
      { name: '', email: 'nope', message: '', company: '' },
      forbiddenSender,
    )

    const messages = Object.values(
      outcome.status === 'invalid' ? outcome.errors : {},
    )
    expect(messages).toHaveLength(3)
    for (const message of messages) {
      expect(message).not.toContain('\u2014')
      expect(message).not.toContain('--')
      // Zod's own default text ("Invalid email address") is not this site's
      // voice and would ship straight into the interface.
      expect(message.startsWith('Invalid')).toBe(false)
    }
  })
})

describe('a payload that is not a contact form at all', () => {
  it('throws rather than being reported as a field error', async () => {
    // A missing field is not something a visitor can do: the form always
    // submits all four. Reporting it as "invalid" would dress a broken client
    // or a hostile request up as user error and hide it from the logs.
    await expect(
      submitContact({ name: 'Amel' }, forbiddenSender),
    ).rejects.toThrow()
    await expect(submitContact(null, forbiddenSender)).rejects.toThrow()
    await expect(
      submitContact({ ...valid, message: 42 }, forbiddenSender),
    ).rejects.toThrow()
  })
})

describe('the honeypot', () => {
  it('reports success to the bot', async () => {
    expect(
      await submitContact({ ...valid, company: 'Acme' }, forbiddenSender),
    ).toEqual({ status: 'sent' })
  })

  it('sends nothing', async () => {
    const { sent, send } = recordingSender()

    await submitContact({ ...valid, company: 'Acme' }, send)

    expect(sent).toEqual([])
  })

  it('reports success even when the rest of the payload is invalid', async () => {
    // Ordering, pinned. A bot that fills the honeypot rarely fills the real
    // fields well, so a validation pass placed first would hand it a field
    // error and tell it exactly which trap it fell into.
    expect(
      await submitContact(
        { name: '', email: 'nope', message: '', company: 'Acme' },
        forbiddenSender,
      ),
    ).toEqual({ status: 'sent' })
  })

  it('is not tripped by whitespace a browser might submit', async () => {
    const { sent, send } = recordingSender()

    expect(await submitContact({ ...valid, company: '   ' }, send)).toEqual({
      status: 'sent',
    })
    expect(
      sent,
      'a blank honeypot silently swallowed a real enquiry',
    ).toHaveLength(1)
  })
})

describe('a provider failure', () => {
  const breaking: Sender = async () => {
    throw new Error('resend responded 503')
  }

  it('is reported to the visitor rather than swallowed', async () => {
    const outcome = await submitContact(valid, breaking)

    expect(
      outcome.status,
      'a failed send reported success, so the enquiry is lost and nobody knows',
    ).toBe('failed')
  })

  it('carries a reason the interface can print', async () => {
    const outcome = await submitContact(valid, breaking)

    expect(
      outcome.status === 'failed' && outcome.reason.length,
    ).toBeGreaterThan(0)
    expect(outcome.status === 'failed' && outcome.reason).not.toContain(
      '\u2014',
    )
  })

  it('survives a sender that rejects with something that is not an Error', async () => {
    const outcome = await submitContact(valid, async () => {
      throw 'nope'
    })

    expect(outcome.status).toBe('failed')
  })
})

describe('the Resend sender', () => {
  it('refuses at call time when no key is configured', async () => {
    const send = createResendSender({})

    await expect(
      send({
        to: CONTACT_DESTINATION,
        replyTo: 'amel@example.com',
        subject: 'x',
        body: 'x',
      }),
    ).rejects.toThrow(/RESEND_API_KEY/)
  })

  it('is built without touching the environment, so a missing key cannot break the build', () => {
    // Construction is not a send. If the key were read here, importing this
    // module during prerender would throw on a machine that has no key, and
    // the whole site would fail to build over a form nobody submitted.
    expect(() => createResendSender({})).not.toThrow()
  })

  it('reads the key at the moment it sends, not at the moment it is built', () => {
    // The assertion above is satisfied by a sender that reads the key in its
    // constructor and stores it, because reading a missing variable does not
    // throw. Measured: moving the read out of the returned function passed it.
    // This is the version that fails, by changing the environment after
    // construction and before the send.
    const env: Record<string, string | undefined> = { RESEND_API_KEY: 'k' }
    const send = createResendSender(env, async () => ({ error: null }))

    delete env.RESEND_API_KEY

    return expect(
      send({ to: 'a@b.c', replyTo: 'd@e.f', subject: 'x', body: 'x' }),
    ).rejects.toThrow(/RESEND_API_KEY/)
  })

  it('hands the provider the key and the message', async () => {
    const calls: Array<{ key: string; to: string; subject: string }> = []
    const send = createResendSender({ RESEND_API_KEY: 'k' }, async (key, m) => {
      calls.push({ key, to: m.to, subject: m.subject })
      return { error: null }
    })

    await send({
      to: CONTACT_DESTINATION,
      replyTo: 'amel@example.com',
      subject: 'Enquiry from Amel',
      body: 'x',
    })

    expect(calls).toEqual([
      { key: 'k', to: CONTACT_DESTINATION, subject: 'Enquiry from Amel' },
    ])
  })

  it('throws when the provider reports failure in the response instead of throwing', async () => {
    // Resend returns `{ data, error }` and does not throw on a rejected send.
    // A sender that only guards against exceptions therefore reports every
    // rejected message as delivered, which is the exact failure this whole
    // module exists to make impossible.
    const send = createResendSender({ RESEND_API_KEY: 'k' }, async () => ({
      error: { name: 'validation_error', message: 'domain is not verified' },
    }))

    await expect(
      send({ to: 'a@b.c', replyTo: 'd@e.f', subject: 'x', body: 'x' }),
    ).rejects.toThrow(/domain is not verified/)
  })

  it('turns that in-band failure into a failed outcome, not a sent one', async () => {
    const outcome = await submitContact(
      valid,
      createResendSender({ RESEND_API_KEY: 'k' }, async () => ({
        error: { name: 'validation_error', message: 'domain is not verified' },
      })),
    )

    expect(outcome.status).toBe('failed')
  })

  it('resolves when the provider accepts the message', async () => {
    const outcome = await submitContact(
      valid,
      createResendSender({ RESEND_API_KEY: 'k' }, async () => ({
        error: null,
      })),
    )

    expect(outcome).toEqual({ status: 'sent' })
  })

  it('reports the outcome as failed rather than throwing out of submitContact', async () => {
    // The two halves joined: the sender fails loudly, and the caller turns that
    // into something the interface can render.
    const outcome = await submitContact(valid, createResendSender({}))

    expect(outcome.status).toBe('failed')
  })
})
