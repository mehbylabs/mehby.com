// Shared head construction for every route.
//
// Lives under src/routes with a leading dash, which is the router generator's
// convention for a file in the routes directory that is not a route. It sits
// here rather than in src/lib because it is nothing but route options: the only
// thing it knows how to do is fill in the fourteen tags a page needs to unfurl
// correctly, from the four facts a page actually has.
//
// One helper rather than fourteen literal tags per route, because the failure
// mode of the literal version is not a broken page. It is a route where
// somebody added og:title and forgot twitter:title, which looks perfect in a
// browser, is invisible to every test that drives one, and is only ever seen by
// the person who pastes the link into a chat.

export const SITE = 'https://mehby.com'
export const SITE_NAME = 'mehby.com'

/** The card scripts/og.mjs writes for a page that is not a case study. */
export const DEFAULT_SHARE_IMAGE = '/og/default.png'

/** Both dimensions are fixed by scripts/og.mjs and asserted in its tests. */
const SHARE_IMAGE_WIDTH = '1200'
const SHARE_IMAGE_HEIGHT = '630'

export type PageMetadata = {
  /** The whole title, as it should read in a tab and in a search result. */
  title: string
  /** Real sentences. PRODUCT.md's copy rules apply here as much as on a page. */
  description: string
  /** Absolute path on this site, without a host and without a trailing slash. */
  path: string
  /** A card under public/og. Defaults to the site's own. */
  image?: string
  /** What the card says, for a reader who cannot see it. */
  imageAlt?: string
}

/**
 * The `{ meta, links }` a route's `head` returns.
 *
 * og:type and og:site_name are deliberately absent: they are the same on every
 * page, so they are declared once on the root route. The router merges head
 * output from the root down and the deepest match wins per name, which means
 * repeating them here would be harmless and repeating the canonical link would
 * not: links are concatenated rather than deduplicated by rel, so two routes
 * declaring one would emit two canonical addresses for one document.
 */
export function pageHead({
  title,
  description,
  path,
  image = DEFAULT_SHARE_IMAGE,
  imageAlt,
}: PageMetadata) {
  const url = `${SITE}${path}`
  // Absolute. Every unfurler resolves og:image against nothing at all, so a
  // root-relative path is not resolved to this site, it is discarded, and the
  // card ships as a bare line of text.
  const imageUrl = `${SITE}${image}`

  return {
    meta: [
      { title },
      { name: 'description', content: description },

      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      // Declared so a client can reserve the space before the PNG arrives,
      // which is the difference between a card that appears and a card that
      // appears after the message has scrolled away.
      { property: 'og:image:width', content: SHARE_IMAGE_WIDTH },
      { property: 'og:image:height', content: SHARE_IMAGE_HEIGHT },
      { property: 'og:image:alt', content: imageAlt ?? title },

      // summary_large_image, not summary. The cards are 1200 by 630, and the
      // small card crops that to a square, which cuts the title in half.
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
