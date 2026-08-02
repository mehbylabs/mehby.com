import { expect, test } from '@playwright/test'

// /writing is empty, and the whole test file is about it staying that way.
//
// The three ways this page gets padded are all the same mistake: three greyed
// "Coming soon" cards, a sample post written to show the layout, or a
// newsletter capture. PRODUCT.md's honest-scope rule rules out all three, and
// a fabricated post is worse than an empty page because it is a claim rather
// than an absence. So the assertions below are almost entirely about what is
// not there.

test.beforeEach(async ({ page }) => {
  await page.goto('/writing')
})

test('is headed Writing', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing')
})

test('says what is true, in one sentence', async ({ page }) => {
  await expect(page.getByTestId('writing-empty')).toHaveText(
    'Nothing published yet. Notes on the work in progress will appear here.',
  )
})

test('lists no posts, real or otherwise', async ({ page }) => {
  const main = page.locator('main')

  await expect(main.getByRole('article')).toHaveCount(0)
  await expect(main.getByRole('listitem')).toHaveCount(0)
  // A heading below the h1 would be a post title or a section that promises
  // one. There is nothing on this page that needs either.
  await expect(main.locator('h2, h3, h4')).toHaveCount(0)
})

test('promises nothing it has not done', async ({ page }) => {
  const text = (await page.locator('main').innerText()).toLowerCase()

  for (const phrase of ['coming soon', 'stay tuned', 'subscribe', 'lorem']) {
    expect(text, `/writing says "${phrase}"`).not.toContain(phrase)
  }
  expect(text).not.toContain('\u2014')
})

test('leads back to the site rather than dead-ending', async ({ page }) => {
  const links = page.locator('main a')

  await expect(links).toHaveCount(1)
  await expect(links).toHaveAttribute('href', '/')
})

test('fills the viewport rather than reading as a render that stopped', async ({
  page,
}) => {
  const height = await page
    .getByTestId('section-field-ultramarine')
    .evaluate((el) => el.getBoundingClientRect().height)
  const viewport = page.viewportSize()!.height

  expect(height).toBeGreaterThan(viewport * 0.6)
})

test('serves the same page with a trailing slash', async ({ page }) => {
  // The route file is writing/index.tsx, so the router's own path carries the
  // slash and the sitemap advertises it. Both spellings have to resolve or the
  // advertised one is a 404 to anybody who typed the other.
  await page.goto('/writing/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing')
})
