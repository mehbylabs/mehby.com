import { expect, test } from '@playwright/test'
import { hydrated, installProbes } from './support/probes'
import type { Page } from '@playwright/test'

// Client side navigation has no browser spinner. Without an indicator of its
// own, a visitor on a cold connection presses a link and nothing happens until
// the next page paints, which is the difference between "loading" and "the
// button is broken".
//
// Every page here is prerendered, so in practice the transition is instant and
// the indicator never appears: it is held back 200ms precisely so it does not
// flash on navigations that were never slow. That makes it awkward to observe,
// so these tests create the condition rather than waiting for one.
//
// Hydration has to finish before any of this means anything. Until React takes
// over, the links are ordinary anchors and a click is a full document
// navigation, which the browser does show a spinner for and which never
// involves the router at all.

const arrive = async (page: Page) => {
  await installProbes(page)
  await page.goto('/')
  await hydrated(page)
}

/** Holds the next route's loader open long enough for the bar to earn its delay. */
const stall = (page: Page) =>
  page.route(/_serverFn|serverFn/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })

test('reports a route transition the visitor has to wait for', async ({
  page,
}) => {
  await arrive(page)
  await stall(page)

  await page.getByTestId('featured-link').click()

  await expect(
    page.getByTestId('route-progress'),
    'a navigation the visitor waits on reports nothing at all, so a cold ' +
      'connection is indistinguishable from a dead button',
  ).toBeVisible()

  // And it leaves when the page arrives.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CoaChess')
  await expect(page.getByTestId('route-progress')).toHaveCount(0)
})

test('stays out of the way of an instant one', async ({ page }) => {
  await arrive(page)

  // No indicator before anything has been asked for.
  await expect(page.getByTestId('route-progress')).toHaveCount(0)

  await page.getByTestId('featured-link').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CoaChess')

  // And none left behind after.
  await expect(page.getByTestId('route-progress')).toHaveCount(0)
})

test('is not announced, because the router already announces the page', async ({
  page,
}) => {
  await arrive(page)
  await stall(page)
  await page.getByTestId('featured-link').click()

  const bar = page.getByTestId('route-progress')
  await expect(bar).toBeVisible()
  // A live region narrating "loading" over the top of the router's own arrival
  // announcement is two announcements for one event.
  await expect(bar).toHaveAttribute('aria-hidden', 'true')
})
