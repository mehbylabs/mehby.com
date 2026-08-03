import { expect, test } from '@playwright/test'

// A site-wide invariant, not a font one, which is why it does not live in
// fonts.spec.ts: a contributor who adds analytics, an embedded widget or a CDN
// script should see a failure that names the actual rule, not one filed under
// font loading.
//
// Fonts are still warmed below, because a third-party @font-face URL is one of
// the likelier ways this gets violated and it is only requested once something
// asks for the face.

const FAMILIES = ['Archivo', 'Martian Mono']

test('nothing is requested from a third party', async ({ page, baseURL }) => {
  // Deliberately not an allow-list of known hosts. The invariant is that this
  // site is wholly self-hosted, so any off-origin request at all is the failure,
  // whether it is fonts.googleapis.com, a CDN someone reached for, or a host
  // nobody thought to enumerate. Self-hosting fonts is also a privacy
  // obligation in the EU, which makes it worth pinning permanently.
  //
  // If this fails, the fix is to vendor the resource, not to widen the rule.
  const foreign: Array<string> = []
  page.on('request', (r) => {
    if (!r.url().startsWith(`${baseURL}/`)) foreign.push(r.url())
  })

  await page.goto('/')
  // Load failures are swallowed on purpose: an unreachable same-origin font is
  // fonts.spec.ts's story to tell, and must not surface here as a network error
  // under a test about third parties.
  await page.evaluate(
    (families) =>
      Promise.all(
        families.map((f) =>
          document.fonts.load(`400 16px "${f}"`).catch(() => undefined),
        ),
      ).then(() => document.fonts.ready.catch(() => undefined)),
    FAMILIES,
  )

  expect(foreign).toEqual([])
})
