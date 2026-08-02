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

  test('says so, as a specification', async ({ page }) => {
    await expect(page.getByTestId('failure-title')).toHaveText(
      'No page at this address',
    )

    const table = page.getByRole('table')
    await expect(table).toHaveAccessibleName(/does not exist/)
    await expect(table.getByRole('rowheader')).toHaveCount(4)
    await expect(table.getByRole('row').first()).toContainText('404')
  })

  test('prints the address that was asked for', async ({ page }) => {
    // A 404 that does not name what it could not find leaves a visitor unable
    // to tell a typing slip from a dead link somebody else published.
    await expect(page.getByRole('table')).toContainText('/no-such-page')

    await page.goto('/work/not-a-study/deeper')
    await expect(page.getByRole('table')).toContainText(
      '/work/not-a-study/deeper',
    )
  })

  test('leads home', async ({ page }) => {
    const home = page.getByRole('link', { name: 'Home' })

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
    const height = await page
      .getByTestId('section-field-ultramarine')
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
