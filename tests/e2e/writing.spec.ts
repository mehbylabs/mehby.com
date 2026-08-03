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
    .locator('main')
    .evaluate((el) => el.getBoundingClientRect().height)
  const viewport = page.viewportSize()!.height

  expect(height).toBeGreaterThan(viewport * 0.6)
})

test('serves the same page with a trailing slash, under the one canonical', async ({
  page,
}) => {
  // The route file is writing/index.tsx, so the router's own path carries the
  // slash even though nothing on the site links to it that way. Somebody will
  // type it, so it has to resolve.
  //
  // The second half is the part that regressed once. The canonical, the
  // sitemap and every link agree on '/writing' because that is the address the
  // server serves; '/writing/' answers 307 and sends you there. So arriving on
  // the slashed spelling must land on the same document AND that document must
  // still name the unslashed one as authoritative. A page that self-canonicals
  // to whatever address it was reached at is how one document becomes two in a
  // crawler's index, and it looks perfect in a browser.
  await page.goto('/writing/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://mehby.com/writing',
  )
})
