// The RSS feed's content, separated from the route that serves it.
//
// Under src/routes with a leading dash, which the router generator ignores, so
// this is a plain module rather than a route. Split out for one reason: a route
// handler cannot be called from vitest, and the thing worth testing here is the
// XML, not the plumbing that returns it. tests/e2e/feed.spec.ts asserts the
// served response; this file is what it asserts about.

import { Feed } from 'feed'
import { SITE } from '../-seo'

export const FEED_PATH = '/writing/feed.xml'
export const FEED_CONTENT_TYPE = 'application/rss+xml; charset=utf-8'

export const FEED_TITLE = 'Writing by Mohamed Elhedi Ben Yedder'
const FEED_DESCRIPTION =
  'Notes on building and shipping full stack products, from the engineer who writes them.'

/**
 * A post, once there are any. Nothing supplies these yet, and that is the
 * point: the empty feed is the case that has to work, because it is the one
 * that ships today.
 */
export type Post = {
  title: string
  description: string
  path: string
  date: Date
}

/**
 * Builds the RSS 2.0 document.
 *
 * `posts` defaults to empty, and an empty feed is a complete channel with no
 * items rather than an error or a 404. A reader that subscribes today and is
 * handed a 404 does not come back tomorrow to see whether it started working,
 * so the first thing this had to get right was having nothing to say.
 *
 * There is deliberately no placeholder item announcing that there are no posts.
 * PRODUCT.md's honest-scope rule covers it: an item saying "nothing yet" is
 * still an item, and every reader would render it as a post.
 */
export function buildFeed(posts: ReadonlyArray<Post> = []): string {
  const feed = new Feed({
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    // `id` is the feed's stable identity and `link` is where a human goes. They
    // are the same address here because the section is the feed's subject, and
    // both carry the trailing slash the writing page declares as its canonical.
    id: `${SITE}/writing/`,
    link: `${SITE}/writing/`,
    language: 'en',
    copyright: `Mohamed Elhedi Ben Yedder, ${new Date().getFullYear()}`,
    // Self reference. Without it a reader that found the feed through the page
    // has no record of the address it came from, which is what breaks a
    // subscription when the document is copied or cached elsewhere.
    feedLinks: { rss: `${SITE}${FEED_PATH}` },
    author: { name: 'Mohamed Elhedi Ben Yedder', link: SITE },
  })

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${SITE}${post.path}`,
      link: `${SITE}${post.path}`,
      description: post.description,
      date: post.date,
    })
  }

  return feed.rss2()
}
