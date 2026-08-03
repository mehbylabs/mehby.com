import { expect, test } from '@playwright/test'

// Permanent smoke test. Two jobs:
//  1. Keep `bun run test:e2e` green on a fresh clone.
//  2. Assert the page came from OUR app, not from whatever else happens to be
//     listening on the port. Port 3000 on this machine is held by an unrelated
//     service that returns HTTP 200, so a status-only assertion passes against
//     the wrong application. Always assert on content only we render.
//
// Deliberately thin. Everything about how the home page is built is pinned in
// tests/e2e/home.spec.ts; this file only answers "is that our server", and it
// stays answerable in one glance when the port is the thing that is wrong.

test('home page is served by our app', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('h1')).toHaveText('Mohamed Elhedi Ben Yedder')
  // The proof chip carries its live status and then the address; the address
  // is the part that identifies the site.
  await expect(page.getByTestId('proof-link').first()).toContainText(
    'coachess.net',
  )
})
