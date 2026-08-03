import { expect, test } from '@playwright/test'
import { NON_TEXT, TOKENS, installProbes } from './support/probes'
import type { Page } from '@playwright/test'

// The contact form, driven the way a visitor drives it.
//
// src/lib/contact.test.ts already proves the five outcomes as logic, with an
// injected sender and no network. This file proves the other half, which that
// one structurally cannot: that the browser reaches those outcomes at all, and
// that each one is legible and operable when it arrives. A form whose server
// half is perfect and whose error never renders is a form that silently loses
// every enquiry.
//
// There is no RESEND_API_KEY in this environment and there is not meant to be.
// That is not a gap in the coverage, it is one of the cases: a valid
// submission with no key configured is the provider-failure path, and it is
// exercised below as exactly that.

const VALID = {
  name: 'Amel',
  email: 'amel@example.com',
  message: 'We need a tariff engine that does not lie about the exemptions.',
}

const fill = async (page: Page, values: Partial<typeof VALID>) => {
  const merged = { ...VALID, ...values }
  await page.getByLabel('Name', { exact: true }).fill(merged.name)
  await page.getByLabel('Email', { exact: true }).fill(merged.email)
  await page.getByLabel('What are you building?').fill(merged.message)
}

const submit = (page: Page) => page.getByTestId('contact-submit').click()

const status = (page: Page) => page.getByTestId('contact-status')

test.beforeEach(async ({ page, javaScriptEnabled }) => {
  await installProbes(page)
  await page.goto('/contact')
  // The submit button is really disabled until React has hydrated, because
  // nothing else stops a native form submission before the handler exists.
  // Waiting on it here is not a convenience: it is the same barrier a visitor
  // is held behind, and the describe block at the end of this file is what
  // proves the barrier is there rather than assuming it.
  if (javaScriptEnabled) {
    await expect(page.getByTestId('contact-submit')).toBeEnabled()
  }
})

test.describe('the page', () => {
  test('carries the heading, the intro and the address', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Start a conversation',
    )
    await expect(page.locator('.page-intro')).toHaveText(
      'Tell me what you are building and what is in the way. I reply to everything.',
    )
    // Scoped to main. The site footer prints the same address on every page,
    // so the unscoped query matches two links; this test is about the copy
    // this page carries, not about the chrome around it.
    await expect(
      page
        .locator('main')
        .getByRole('link', { name: 'hello@mehby.com', exact: true }),
    ).toHaveAttribute('href', 'mailto:hello@mehby.com')
  })

  test('shows the form inline, never behind a dialog', async ({ page }) => {
    // DESIGN.md bans modals, and a contact modal is the specific one worth
    // pinning: it hides the only action the site asks for behind a click and
    // cannot be linked to.
    await expect(page.getByTestId('contact-form')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('writes no em dash anywhere', async ({ page }) => {
    const text = await page.locator('main').innerText()

    expect(text).not.toContain('\u2014')
    expect(text).not.toContain('--')
  })
})

test.describe('the form is operable', () => {
  test('associates a real label with every control', async ({ page }) => {
    // getByLabel resolves through the accessibility tree, so a placeholder
    // masquerading as a label, or a label with no `for`, fails here.
    await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute(
      'name',
      'name',
    )
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute(
      'name',
      'email',
    )
    await expect(page.getByLabel('What are you building?')).toHaveAttribute(
      'name',
      'message',
    )
  })

  test('offers exactly three fields to a keyboard', async ({ page }) => {
    // The honeypot is a fourth input in the DOM and must not be a fourth stop
    // in the tab order, or the trap catches the people it is not aimed at.
    const reachable: Array<string> = []
    await page.getByRole('heading', { level: 1 }).click()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const name = await page.evaluate(
        () => (document.activeElement as HTMLInputElement | null)?.name ?? '',
      )
      if (name && !reachable.includes(name)) reachable.push(name)
    }

    expect(reachable).toEqual(['name', 'email', 'message'])
  })

  test('keeps the honeypot out of the accessibility tree', async ({ page }) => {
    // Three inputs are offered, and there are four in the DOM.
    await expect(page.getByRole('textbox')).toHaveCount(3)
    await expect(
      page.getByRole('textbox', { name: 'Company', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('#contact-company')).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  test('reports that it is ready only once it is', async ({ page }) => {
    await expect(page.getByTestId('contact-submit')).toHaveAttribute(
      'data-ready',
      'true',
    )
  })

  test('shows a focus ring that is visible on the ground it lands on', async ({
    page,
  }) => {
    await page.getByLabel('Name', { exact: true }).focus()
    const ring = await page
      .getByLabel('Name', { exact: true })
      .evaluate((el) => getComputedStyle(el).outlineColor)

    const ratio = await page.evaluate(([a, b]) => window.contrast(a, b), [
      ring,
      TOKENS.paper,
    ] as const)
    expect(
      ratio,
      'the focus ring is invisible on the paper ground',
    ).toBeGreaterThanOrEqual(NON_TEXT)
  })

  test('shows a focus ring on the coloured band too', async ({ page }) => {
    // The sharpest case in DESIGN.md: an ultramarine ring on an ultramarine
    // field measures 1.00 and is literally invisible.
    // The one in main, on the ultramarine band. The footer prints the same
    // address on an ultramarine-deep ground, which is a different measurement
    // and is covered by a11y.spec.ts on every page.
    const address = page
      .locator('main')
      .getByRole('link', { name: 'hello@mehby.com', exact: true })
    await address.focus()
    const ring = await address.evaluate(
      (el) => getComputedStyle(el).outlineColor,
    )

    const ratio = await page.evaluate(([a, b]) => window.contrast(a, b), [
      ring,
      TOKENS.ultramarine,
    ] as const)
    expect(ratio).toBeGreaterThanOrEqual(NON_TEXT)
  })
})

test.describe('an invalid email', () => {
  test('is reported against the email field and nowhere else', async ({
    page,
  }) => {
    await fill(page, { email: 'amel@' })
    await submit(page)

    const email = page.getByLabel('Email', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Name', { exact: true })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('describes the field with the message, so it is announced with it', async ({
    page,
  }) => {
    await fill(page, { email: 'amel@' })
    await submit(page)

    const email = page.getByLabel('Email', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')

    expect(describedBy, 'the error is on screen and unannounced').toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText(/email address/i)
  })

  test('announces the failure in a live region', async ({ page }) => {
    // The region is mounted from the first render, empty. A live region
    // inserted at the same moment it gains text is frequently not announced at
    // all, so its presence before the submission is part of the assertion.
    await expect(status(page)).toHaveAttribute('aria-live', 'polite')

    await fill(page, { email: 'amel@' })
    await submit(page)

    await expect(status(page)).toHaveAttribute('data-status', 'invalid')
    await expect(status(page)).toContainText('Nothing was sent')
  })

  test('moves focus to the field that has to change', async ({ page }) => {
    await fill(page, { email: 'amel@' })
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'invalid')

    await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  })

  test('marks the field by more than colour', async ({ page }) => {
    const email = page.getByLabel('Email', { exact: true })
    const before = await email.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    )

    await fill(page, { email: 'amel@' })
    await submit(page)
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    const after = await email.evaluate(
      (el) => getComputedStyle(el).borderTopWidth,
    )
    expect(
      parseFloat(after),
      'the invalid state is carried by colour alone, which fails WCAG 1.4.1',
    ).toBeGreaterThan(parseFloat(before))
  })
})

test.describe('an empty message', () => {
  test('is reported against the message field', async ({ page }) => {
    await fill(page, { message: '' })
    await submit(page)

    const message = page.getByLabel('What are you building?')
    await expect(message).toHaveAttribute('aria-invalid', 'true')
    await expect(message).toBeFocused()
    await expect(status(page)).toHaveAttribute('data-status', 'invalid')
  })

  test('is caught by this site and not by the browser', async ({ page }) => {
    // noValidate is deliberate: native constraint bubbles are unstyled,
    // transient, and invisible to a screen reader that is not on the field when
    // they appear. If the browser intercepted, no request would be made and no
    // field message would ever render.
    await expect(page.getByTestId('contact-form')).toHaveAttribute('novalidate')
  })
})

test.describe('a bot that fills the honeypot', () => {
  test('is told it succeeded', async ({ page }) => {
    await fill(page, {})
    await page
      .locator('#contact-company')
      .evaluate((el: HTMLInputElement) => (el.value = 'Acme'))
    await submit(page)

    await expect(status(page)).toHaveAttribute('data-status', 'sent')
    await expect(status(page)).toContainText('Message sent')
  })

  test('gets a success that could not have involved a send', async ({
    page,
  }) => {
    // There is no API key in this environment, so a real send cannot succeed.
    // A "sent" here therefore proves the honeypot short-circuited before the
    // provider was reached, which is the whole behaviour: silence, not a
    // rejection that teaches the bot which field is the trap.
    await fill(page, { email: 'not-an-address', message: '' })
    await page
      .locator('#contact-company')
      .evaluate((el: HTMLInputElement) => (el.value = 'Acme'))
    await submit(page)

    await expect(status(page)).toHaveAttribute('data-status', 'sent')
    await expect(page.getByLabel('Email', { exact: true })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('clears the form the way a real success does', async ({ page }) => {
    await fill(page, {})
    await page
      .locator('#contact-company')
      .evaluate((el: HTMLInputElement) => (el.value = 'Acme'))
    await submit(page)

    await expect(status(page)).toHaveAttribute('data-status', 'sent')
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
  })
})

test.describe('a provider that cannot deliver', () => {
  test('tells the visitor rather than thanking them for nothing', async ({
    page,
  }) => {
    // No key is configured, so createResendSender refuses at call time. This is
    // the failure path end to end: the server function catches, the outcome
    // crosses the wire, and the interface renders it.
    await fill(page, {})
    await submit(page)

    await expect(status(page)).toHaveAttribute('data-status', 'failed')
    await expect(status(page)).toContainText('could not be sent')
  })

  test('leaves the message where the visitor typed it', async ({ page }) => {
    await fill(page, {})
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'failed')

    // Clearing the form on failure is the same as losing the enquiry twice.
    await expect(page.getByLabel('What are you building?')).toHaveValue(
      VALID.message,
    )
  })

  test('offers a retry and a way round it', async ({ page }) => {
    await fill(page, {})
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'failed')

    const button = page.getByTestId('contact-submit')
    await expect(button).toBeEnabled()
    await expect(button).not.toHaveAttribute('aria-disabled', 'true')
    await expect(button).toHaveText('Send')
    // The address, inside the form, for a visitor who has had enough of trying.
    await expect(
      page.locator('form').getByRole('link', { name: 'hello@mehby.com' }),
    ).toBeVisible()
  })

  test('retries when the button is pressed again', async ({ page }) => {
    await fill(page, {})
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'failed')

    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST') posts++
    })
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'failed')

    expect(posts, 'pressing Send after a failure did nothing').toBeGreaterThan(
      0,
    )
  })
})

test.describe('while the request is in flight', () => {
  test('the button reports that it is working and refuses a second send', async ({
    page,
  }) => {
    let posts = 0
    await page.route('**/*', async (route, request) => {
      if (request.method() === 'POST') {
        posts++
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
      await route.continue()
    })

    await fill(page, {})
    const button = page.getByTestId('contact-submit')
    await button.click()

    await expect(button).toHaveText('Sending')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true')

    // Double submission is guarded rather than prevented by `disabled`, which
    // would drop a keyboard user's focus to the body mid-request.
    await button.click({ force: true })
    await expect(button).toHaveText('Send', { timeout: 5000 })
    expect(posts, 'the second press sent a second enquiry').toBe(1)
  })
})

test.describe('the network', () => {
  test('stays on this origin even while the form is failing', async ({
    page,
    baseURL,
  }) => {
    const foreign: Array<string> = []
    page.on('request', (r) => {
      if (!r.url().startsWith(`${baseURL}/`)) foreign.push(r.url())
    })

    await fill(page, {})
    await submit(page)
    await expect(status(page)).toHaveAttribute('data-status', 'failed')

    // The provider SDK is dynamically imported inside the sender and the key
    // check happens first, so a machine with no key never opens a socket. This
    // is also the assertion that catches the provider being called from the
    // browser, which would put the key in the client bundle.
    expect(foreign).toEqual([])
  })
})

test.describe('before the page can work', () => {
  // JavaScript off, deliberately, because that is the only deterministic way
  // to stand in the window this guards. A form whose only defence against a
  // native submission is an onSubmit handler is undefended until that handler
  // exists: pressing Send in that window performs a real POST, navigates the
  // browser, and discards everything the visitor typed. Measured rather than
  // assumed, and not hypothetical: before the button was disabled until
  // hydration, every submission assertion in this file failed on a navigation.
  test.use({ javaScriptEnabled: false })

  test('refuses a submission that would be thrown away', async ({ page }) => {
    await expect(page.getByTestId('contact-submit')).toBeDisabled()
  })

  test('still renders the whole page, and the address that does work', async ({
    page,
  }) => {
    // The printed address is the interface for this visitor. It is above the
    // form, not below it, and it is not a fallback that only appears on
    // failure.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Start a conversation',
    )
    await expect(
      page.getByRole('link', { name: 'hello@mehby.com', exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByLabel('What are you building?')).toBeVisible()
  })
})
