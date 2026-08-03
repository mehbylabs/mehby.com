import { createServerFn } from '@tanstack/react-start'

// The hero's live proof check. The build already refuses to ship when a proof
// link is dead (scripts/verify-links.mjs), but that check runs at build time
// and the page should not keep claiming something that went down after deploy.
// This server function re-runs the same check at request time, from the same
// frontmatter, and the proof strip renders the result.
//
// It must run server-side: the targets are third-party origins with no CORS
// allowance for browser clients. The browser only ever talks to this function,
// which is why tests/e2e/no-third-party.spec.ts keeps passing.

export type LiveStatus = {
  url: string
  status: number | null
  ok: boolean
}

const TIMEOUT_MS = 8000

async function ping(url: string): Promise<LiveStatus> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })
    return { url, status: res.status, ok: res.ok }
  } catch {
    return { url, status: null, ok: false }
  } finally {
    clearTimeout(timer)
  }
}

export const checkLive = createServerFn({ method: 'GET' }).handler(async () => {
  const { getCaseStudies } = await import('#/lib/content')
  const urls = [
    ...new Set(getCaseStudies().flatMap((study) => study.surfaces.map((s) => s.href))),
  ]
  return Promise.all(urls.map(ping))
})
