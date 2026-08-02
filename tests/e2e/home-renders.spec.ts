import { expect, test } from '@playwright/test'

// Permanent smoke test. Two jobs:
//  1. Keep `bun run test:e2e` green on a fresh clone.
//  2. Assert the page came from OUR app, not from whatever else happens to be
//     listening on the port. Port 3000 on this machine is held by an unrelated
//     service that returns HTTP 200, so a status-only assertion passes against
//     the wrong application. Always assert on content only we render.

test('home page is served by our app', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('h1')).toHaveText('Welcome to TanStack Start')
  await expect(page.locator('code')).toHaveText('src/routes/index.tsx')
})
