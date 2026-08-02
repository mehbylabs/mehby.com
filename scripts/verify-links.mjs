#!/usr/bin/env bun
// Verifies that every URL the site publishes as proof is actually live, and
// stops the build when one is not. Run by `bun run verify:links`.
//
// Why this exists, and why it is allowed to break a build.
//
// PRODUCT.md puts the entire burden of credibility on a short strip of live
// addresses, because the owner's recent source is private and no metrics may be
// published. That makes a dead proof link categorically different from a dead
// link elsewhere: it is the site making a false claim about a product being
// live, to the one audience it is trying to convince, in the one place it asked
// them to check. The site must stop claiming it rather than ship it.
//
// Run under bun rather than node, unlike scripts/contrast.mjs, for one reason:
// it imports src/lib/content.ts so the URLs come from the case study
// frontmatter that the pages themselves render. A second hardcoded list here
// would be a second thing to drift, and the drift would be invisible precisely
// because both copies would look right in isolation.

import { getCaseStudies, CASE_STUDY_DIR } from '../src/lib/content.ts'

// ---------------------------------------------------------------------------
// The network-flakiness decision.
//
// A network check inside a build fails when the network is flaky, not only when
// a link is genuinely dead. Three things handle that, and one deliberate
// omission.
//
// 1. Failures are classified, and the classes are not treated alike. A reply
//    that arrives is a definitive answer: 200 is LIVE, 404 or 500 is DEAD and
//    is never retried past the budget. No reply at all is UNREACHABLE, which is
//    the ambiguous class, because it looks identical whether the host is down
//    or this machine is.
//
// 2. Transport failures and 5xx are retried, twice, with a short backoff. That
//    absorbs a blip. It does not absorb an outage, and it is not meant to.
//
// 3. UNREACHABLE still fails the build. This is the choice, and it is the one
//    that costs something. The alternative, downgrading "no reply" to a
//    warning, is exactly how this gate becomes decoration: a product that is
//    genuinely down answers with a connection reset or a DNS failure, which is
//    the same signature as a flaky link, so a gate that forgives one forgives
//    the other. The tradeoff, stated plainly: a real network blip can fail a
//    build that should have passed. The cost of that is a re-run. The cost of
//    the opposite mistake is the site telling a prospective client that a
//    product is live when it is not, which is the single failure this site
//    cannot absorb.
//
// 4. VERIFY_LINKS_OFFLINE=1 skips the check entirely, for working on a train.
//    It prints a loud SKIPPED banner rather than passing quietly, and it is
//    IGNORED when CI is set. That last part is the point of having it rather
//    than a plain opt-out: the danger of an escape hatch is not that a
//    developer uses it, it is that it leaks into the deploy environment and
//    nobody notices the gate stopped running. Off CI it is a convenience; on
//    CI it is refused and says so.
//
// What was deliberately NOT done: no "warn on unreachable, fail on 4xx" mode,
// no auto-skip when a connectivity probe fails. Both sound careful and both
// mean the gate passes on the exact signature of a real outage.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000
const RETRIES = 2
/** Attempt 1 fails, wait 300ms; attempt 2 fails, wait 600ms; then give up. */
const BACKOFF_MS = 300

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const contentDir = arg('--content', CASE_STUDY_DIR)
const timeoutMs = Number(arg('--timeout', String(DEFAULT_TIMEOUT_MS)))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One attempt. Returns a reply, or an unreachable verdict. Never throws, so the
 * caller decides what a failure means rather than inheriting it from an
 * exception it did not classify.
 */
async function attempt(url) {
  try {
    const response = await fetch(url, {
      // Follow redirects: a product that moved to a new address is still live,
      // and reporting the address it settled on is what makes a domain parked
      // on a for-sale page visible rather than green.
      redirect: 'follow',
      // GET rather than HEAD. A host that answers HEAD with 405 while serving
      // the page perfectly is common enough that HEAD manufactures false
      // failures, which is the thing this gate can least afford.
      method: 'GET',
      headers: {
        'user-agent': 'mehby.com proof link check (build-time verification)',
        accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    // The status is the whole answer; the body is bandwidth. Cancelling frees
    // the socket so the process can exit without waiting on a slow response.
    await response.body?.cancel().catch(() => undefined)
    return {
      reached: true,
      status: response.status,
      finalUrl: response.url || url,
    }
  } catch (cause) {
    const timedOut =
      cause?.name === 'TimeoutError' ||
      cause?.name === 'AbortError' ||
      /timed?\s?out/i.test(String(cause?.message ?? ''))
    return {
      reached: false,
      detail: timedOut
        ? `timed out after ${timeoutMs}ms`
        : reason(cause).slice(0, 80),
    }
  }
}

/** The most specific thing the platform will tell us about a transport error. */
const reason = (cause) => {
  const inner = cause?.cause
  return String(inner?.code ?? inner?.message ?? cause?.message ?? cause)
}

/**
 * Checks one URL, spending the retry budget only where a retry can help.
 *
 * A 4xx is not retried: the host answered, and asking the same question again
 * gets the same answer while burning the budget that exists for blips. A 5xx is
 * retried, because a server erroring for two seconds during a deploy is a real
 * and recoverable state.
 */
async function check(url) {
  for (let tries = 0; ; tries += 1) {
    const result = await attempt(url)

    const definitive = result.reached && result.status < 500
    if (definitive || tries === RETRIES) {
      if (!result.reached)
        return {
          url,
          status: '-',
          outcome: 'UNREACHABLE',
          detail: result.detail,
        }

      const redirected =
        result.finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')
      return {
        url,
        status: String(result.status),
        outcome: result.status < 400 ? 'LIVE' : 'DEAD',
        detail: redirected ? `redirected to ${result.finalUrl}` : '',
      }
    }

    await sleep(BACKOFF_MS * (tries + 1))
  }
}

// ---------------------------------------------------------------------------

const offlineRequested = Boolean(process.env.VERIFY_LINKS_OFFLINE)
const onCI = Boolean(process.env.CI)

if (offlineRequested && !onCI) {
  console.log(
    'SKIPPED: VERIFY_LINKS_OFFLINE is set, so no proof link was checked.\n' +
      'The site may be claiming a product is live that is not. This flag is ' +
      'ignored on CI.',
  )
  process.exit(0)
}
if (offlineRequested && onCI) {
  console.log('VERIFY_LINKS_OFFLINE is set and is being ignored on CI.\n')
}

/**
 * Every external address the site publishes as evidence, in the order a reader
 * meets it. `surfaces` is the live-product strip. `source` is checked on the
 * same footing because the specification table prints it as a repository a
 * reader can open, and a 404 there is the same false claim in a quieter place.
 */
const studies = getCaseStudies(contentDir)
const urls = [
  ...new Set(
    studies.flatMap((study) => [
      ...study.surfaces.map((surface) => surface.href),
      ...(study.source ? [study.source] : []),
    ]),
  ),
]

console.log(
  `Proof links, read from ${contentDir} frontmatter. ` +
    `timeout ${timeoutMs}ms, ${RETRIES} retries.\n`,
)

if (urls.length === 0) {
  // A gate that reports "0 checked, all fine" is the toothless state this whole
  // script exists to prevent, and deleting a surfaces block reaches it.
  console.error(
    `no proof links found in ${contentDir}. Either the content moved or a ` +
      'surfaces block was emptied. Nothing was verified.',
  )
  process.exit(1)
}

const width = Math.max(40, ...urls.map((url) => url.length)) + 2
console.log(
  'URL'.padEnd(width) + 'Status'.padEnd(8) + 'Outcome'.padEnd(14) + 'Detail',
)

const results = []
for (const url of urls) {
  const result = await check(url)
  results.push(result)
  console.log(
    result.url.padEnd(width) +
      result.status.padEnd(8) +
      result.outcome.padEnd(14) +
      result.detail,
  )
}

const failed = results.filter((result) => result.outcome !== 'LIVE')
if (failed.length > 0) {
  console.error(
    `\n${failed.length} proof link${failed.length === 1 ? '' : 's'} could not ` +
      'be shown to be live. The site must not claim it is.\n' +
      failed.map((f) => `  ${f.url}  ${f.outcome}  ${f.detail}`).join('\n'),
  )
  process.exit(1)
}

console.log(`\nAll ${results.length} proof links are live.`)
