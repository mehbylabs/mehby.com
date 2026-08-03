import { createFileRoute } from '@tanstack/react-router'
import { FEED_CONTENT_TYPE, buildFeed } from './-feed'

// Serves /writing/feed.xml.
//
// The filename is `feed[.]xml.tsx`. A bare dot is a path separator in the file
// router, so `feed.xml.tsx` would produce the route `/writing/feed/xml`, which
// is a path no feed reader will ever ask for and which nothing would have
// caught: the file exists, the route builds, and the address is wrong. The
// brackets escape it.
//
// A route with server handlers and no component. The handler returns a Response
// directly, so nothing renders and no HTML shell is produced for it.

export const Route = createFileRoute('/writing/feed.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildFeed(), {
          headers: {
            // The half that is invisible until it is wrong. Served as
            // text/html, the feed renders in a browser as a wall of angle
            // brackets and is refused outright by most readers.
            'content-type': FEED_CONTENT_TYPE,
            // Short, because the feed is generated per request and the cost of
            // a stale one is a reader missing a post for an hour.
            'cache-control': 'public, max-age=600',
          },
        }),
    },
  },
})
