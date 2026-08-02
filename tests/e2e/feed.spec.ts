import { expect, test } from '@playwright/test'

// The RSS feed at /writing/feed.xml.
//
// Nothing is published yet, which is the whole reason this file is careful. The
// two failure modes for an empty feed are crashing on an empty item list and
// serving a 404 because somebody decided a feed with no posts is not a feed. A
// reader that subscribes today and gets a 404 does not come back to check
// later, so the empty case has to be a real, valid, empty feed.

const FEED = '/writing/feed.xml'

test('the feed is served as RSS, not as HTML', async ({ request }) => {
  const response = await request.get(FEED)

  // The status is asserted as a value, not through response.ok(), which is true
  // for anything in the 200s and tells a reader of this file nothing.
  expect(response.status()).toBe(200)

  // The header is the half that is easy to get wrong and impossible to see: a
  // feed served as text/html renders as a wall of angle brackets in a browser
  // and is refused by most readers outright.
  const type = response.headers()['content-type'] ?? ''
  expect(type).toContain('application/rss+xml')
  expect(type).toContain('utf-8')
})

test('the feed is well formed XML', async ({ request, page }) => {
  const xml = await (await request.get(FEED)).text()

  // Parsed by a real XML parser rather than pattern matched. A regex that finds
  // <rss> in a document is happy with an unclosed tag, a stray ampersand, or a
  // half written channel, and every one of those is a feed no reader accepts.
  const error = await page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    const failure = doc.querySelector('parsererror')
    return failure ? failure.textContent : null
  }, xml)

  expect(error, `the feed did not parse: ${error}`).toBeNull()
})

test('the empty feed is a complete channel, not a stub', async ({
  request,
  page,
}) => {
  const xml = await (await request.get(FEED)).text()

  const channel = await page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    const read = (tag: string) =>
      doc.querySelector(`channel > ${tag}`)?.textContent ?? null
    return {
      version: doc.documentElement.getAttribute('version'),
      root: doc.documentElement.tagName,
      title: read('title'),
      link: read('link'),
      description: read('description'),
      items: doc.querySelectorAll('channel > item').length,
    }
  }, xml)

  expect(channel.root).toBe('rss')
  expect(channel.version).toBe('2.0')
  expect(channel.title).toContain('Mohamed Elhedi Ben Yedder')
  // The same address the writing page declares as its canonical, trailing
  // slash included. A feed that points at a second spelling of its own page is
  // the same "two documents" mistake in a place nobody looks.
  expect(channel.link).toBe('https://mehby.com/writing/')
  expect(channel.description?.length ?? 0).toBeGreaterThan(20)

  // Zero, and valid. Not an error, not a placeholder item announcing that there
  // are no items, which is the shape somebody reaches for to make a feed look
  // less empty and which every reader would then show as a post.
  expect(channel.items).toBe(0)
})

test('the feed obeys the copy rules the rest of the site does', async ({
  request,
}) => {
  const xml = await (await request.get(FEED)).text()

  // Without this the rest of the test passes happily against a 404 page, which
  // is exactly how it first passed: an error document has no em dash in it
  // either.
  expect(xml).toContain('<rss')

  expect(xml, 'the feed contains an em dash').not.toContain('\u2014')
  expect(xml).not.toContain('--')
})

test('the writing page points readers at the feed', async ({ page }) => {
  await page.goto('/writing')

  // A feed nobody can find is a feed nobody reads. The alternate link is how a
  // reader's browser extension and every feed reader discovers it.
  const alternate = page.locator(
    'link[rel="alternate"][type="application/rss+xml"]',
  )
  await expect(alternate).toHaveAttribute(
    'href',
    'https://mehby.com/writing/feed.xml',
  )
})
