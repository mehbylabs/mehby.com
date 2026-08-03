import { expect, test } from '@playwright/test'

// The two states nobody navigates to on purpose, which is exactly why they rot.
//
// Both are declared in the root route options rather than in files of their
// own, because TanStack Router looks for them there: a src/routes/404.tsx is
// simply a route matching the path /404, reachable by typing it and never
// reached by a wrong address. This file drives real wrong addresses, so a
// regression to the file-per-state shape fails here rather than in review.

test.describe('an address that does not exist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/no-such-page')
  })

  test('says so, in the terminal register', async ({ page }) => {
    // The 404 is a terse register line: an error title, a status, and the
    // address that was asked for. The register replaces the old specification
    // table, but the three facts it carried are still all here.
    await expect(page.getByTestId('failure-title')).toHaveText(
      'error: page not found',
    )

    const failure = page.getByTestId('failure')
    await expect(failure).toContainText('404')
    await expect(failure).toContainText('no route on this site matches it')
  })

  test('prints the address that was asked for', async ({ page }) => {
    // A 404 that does not name what it could not find leaves a visitor unable
    // to tell a typing slip from a dead link somebody else published.
    await expect(page.getByTestId('failure')).toContainText('/no-such-page')

    await page.goto('/work/not-a-study/deeper')
    await expect(page.getByTestId('failure')).toContainText(
      '/work/not-a-study/deeper',
    )
  })

  test('leads home', async ({ page }) => {
    // Home is the work index, so the way home is the mono path for it. The
    // nav and footer carry the same path, so the failure page's own link is
    // the first one in reading order.
    const home = page.getByRole('link', { name: '~/work' }).first()

    await expect(home).toHaveAttribute('href', '/')
    await home.click()
    await expect(page.getByTestId('hero-display')).toBeVisible()
  })

  test('does not apologise, joke, or illustrate', async ({ page }) => {
    const text = (await page.locator('main').innerText()).toLowerCase()

    for (const phrase of ['sorry', 'oops', 'whoops', 'lost', 'uh oh']) {
      expect(text, `the 404 says "${phrase}"`).not.toContain(phrase)
    }
    await expect(page.locator('main img, main svg')).toHaveCount(0)
    // Terse. Four table rows, a title and a link, and no paragraph explaining
    // how the reader might be feeling.
    expect(text.length).toBeLessThan(400)
  })

  test('fills the viewport rather than reading as a render that stopped', async ({
    page,
  }) => {
    // The failure state stands at least two thirds of a viewport tall, so a
    // short error over empty ground cannot read as a render that stopped
    // halfway.
    const height = await page
      .locator('main')
      .evaluate((el) => el.getBoundingClientRect().height)

    expect(height).toBeGreaterThan(page.viewportSize()!.height * 0.6)
  })

  test('does not take over a case study that has its own answer', async ({
    page,
  }) => {
    // /work/$slug declares its own notFoundComponent, and it is more specific:
    // an unknown case study gets an answer about case studies.
    await page.goto('/work/not-a-study')

    await expect(page.getByTestId('not-found')).toBeVisible()
    await expect(page.getByTestId('failure-title')).toHaveCount(0)
  })
})

test.describe('the not found page is served, not only rendered', () => {
  test('answers a wrong address with a 404 status', async ({ page }) => {
    // A soft 404 is a page that looks right to a person and tells a crawler the
    // address is fine, which is how dead URLs stay in an index.
    const response = await page.goto('/no-such-page')

    expect(response?.status()).toBe(404)
  })
})
