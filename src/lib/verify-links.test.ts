import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { getCaseStudies } from '#/lib/content'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

// scripts/verify-links.mjs is the site's single most load-bearing gate.
//
// PRODUCT.md makes the live URLs carry the whole burden of proof, because
// the owner's recent source is private and no metrics may be published. A dead
// link in that strip is not a cosmetic bug, it is the site making a false claim
// about a product being live. So the rule is: if the link cannot be shown to
// work, the build stops.
//
// Every test here runs the real script as a subprocess against a real local
// HTTP server. Nothing is mocked, and nothing touches the public network: a
// gate tested against stubs proves only that the stubs agree with each other.

const SCRIPT = 'scripts/verify-links.mjs'

const servers: Array<Server> = []
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        }),
    ),
  )
})

/** Starts a throwaway server on a free port and returns its origin. */
async function serve(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string')
    throw new Error('the fixture server did not bind to a port')
  return `http://127.0.0.1:${address.port}`
}

/** A port with nothing behind it: bound, read, then released. */
async function closedPort(): Promise<number> {
  const server = createServer(() => {})
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string')
    throw new Error('the probe server did not bind to a port')
  const { port } = address
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

/**
 * Writes a content directory the script can read, one .mdx per entry. The
 * hrefs are only ever known at runtime, because the fixture server's port is,
 * which is what makes this a real test of "reads the URLs from frontmatter"
 * rather than a restatement of a constant.
 */
function contentDir(studies: Array<{ slug: string; surfaces: Array<string> }>) {
  const dir = mkdtempSync(join(tmpdir(), 'proof-links-'))
  studies.forEach((study, index) => {
    const surfaces = study.surfaces.length
      ? study.surfaces
          .map((href) => `  - label: surface\n    href: ${href}`)
          .join('\n')
      : ' []'
    writeFileSync(
      join(dir, `${study.slug}.mdx`),
      `---\ntitle: ${study.slug}\nsummary: A fixture case study.\nrole: Engineer\nperiod: 2026\norder: ${index + 1}\nsurfaces:${study.surfaces.length ? `\n${surfaces}` : surfaces}\n---\n\nBody.\n`,
    )
  })
  return dir
}

/**
 * Runs the gate as a subprocess and waits for it, asynchronously.
 *
 * Deliberately not spawnSync. spawnSync blocks this process's event loop, so
 * the fixture server above never gets a turn to answer, and every request the
 * script makes times out. The first draft of this file did exactly that: every
 * assertion failed for the same reason, which looked like the script being
 * broken and was the test harness deadlocking itself.
 */
function run(
  args: Array<string>,
  env: Record<string, string> = {},
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const clean = { ...process.env }
  delete clean.CI
  delete clean.VERIFY_LINKS_OFFLINE

  return new Promise((resolve) => {
    const child = spawn('bun', [SCRIPT, ...args], {
      env: { ...clean, ...env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

test('a 200 passes, and the run reports its own timeout and retry budget', async () => {
  const origin = await serve((_req, res) => res.writeHead(200).end('ok'))
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/live`] }])

  const result = await run(['--content', dir])

  expect(result.stdout).toContain(`${origin}/live`)
  expect(result.stdout).toContain('200')
  expect(result.stdout).toContain('LIVE')
  // The budget is printed rather than assumed, so the defaults required by the
  // task are observable in the output instead of buried in the source.
  expect(result.stdout).toContain('timeout 10000ms')
  expect(result.stdout).toContain('2 retries')
  expect(result.status).toBe(0)
})

test('a 404 fails the build', async () => {
  const origin = await serve((_req, res) => res.writeHead(404).end('gone'))
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/gone`] }])

  const result = await run(['--content', dir])

  expect(result.stdout).toContain('404')
  expect(result.stdout).toContain('DEAD')
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('1 proof link')
})

test('a refused connection fails the build', async () => {
  const port = await closedPort()
  const dir = contentDir([
    { slug: 'fixture', surfaces: [`http://127.0.0.1:${port}/live`] },
  ])

  const result = await run(['--content', dir])

  expect(result.stdout).toContain('UNREACHABLE')
  expect(result.status).not.toBe(0)
})

test('a redirect that ends at 200 passes, and the final address is reported', async () => {
  const origin = await serve((req, res) => {
    if (req.url === '/moved')
      return res.writeHead(302, { location: '/settled' }).end()
    return res.writeHead(200).end('ok')
  })
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/moved`] }])

  const result = await run(['--content', dir])

  expect(result.stdout).toContain('LIVE')
  // Not merely "it passed": a redirect chain that quietly lands somewhere else
  // is worth seeing, and printing it is what makes a domain that has been
  // parked on a for-sale page visible instead of green.
  expect(result.stdout).toContain(`${origin}/settled`)
  expect(result.status).toBe(0)
})

test('a 5xx is retried, and a run that recovers passes', async () => {
  let attempts = 0
  const origin = await serve((_req, res) => {
    attempts += 1
    if (attempts < 3) return res.writeHead(503).end('down')
    return res.writeHead(200).end('ok')
  })
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/flaky`] }])

  const result = await run(['--content', dir])

  expect(attempts, 'the 503 was not retried').toBe(3)
  expect(result.stdout).toContain('LIVE')
  expect(result.status).toBe(0)
})

test('a 5xx that never recovers fails, having used the whole retry budget', async () => {
  let attempts = 0
  const origin = await serve((_req, res) => {
    attempts += 1
    res.writeHead(503).end('down')
  })
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/down`] }])

  const result = await run(['--content', dir])

  expect(attempts).toBe(3)
  expect(result.stdout).toContain('DEAD')
  expect(result.status).not.toBe(0)
})

test('a 404 is not retried, because it is already a definitive answer', async () => {
  let attempts = 0
  const origin = await serve((_req, res) => {
    attempts += 1
    res.writeHead(404).end('gone')
  })
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/gone`] }])

  await run(['--content', dir])

  expect(
    attempts,
    'a 404 was retried. The host answered; repeating the question wastes the ' +
      'budget that exists for transport failures',
  ).toBe(1)
})

test('a host that never answers fails on the timeout', async () => {
  const origin = await serve(() => {
    /* deliberately never responds */
  })
  const dir = contentDir([{ slug: 'fixture', surfaces: [`${origin}/hang`] }])

  const result = await run(['--content', dir, '--timeout', '250'])

  expect(result.stdout).toContain('UNREACHABLE')
  expect(result.stdout).toContain('timed out')
  expect(result.status).not.toBe(0)
}, 20000)

test('the URLs come from the frontmatter it is pointed at, not from a list in the script', async () => {
  const origin = await serve((_req, res) => res.writeHead(200).end('ok'))
  const dir = contentDir([
    { slug: 'alpha', surfaces: [`${origin}/alpha`] },
    { slug: 'beta', surfaces: [`${origin}/beta-one`, `${origin}/beta-two`] },
  ])

  const result = await run(['--content', dir])

  expect(result.stdout).toContain(`${origin}/alpha`)
  expect(result.stdout).toContain(`${origin}/beta-one`)
  expect(result.stdout).toContain(`${origin}/beta-two`)
  // The real proof links must be absent. If they appear, the script is reading
  // a hardcoded list and the fixture directory changed nothing, which is the
  // exact failure this test exists to catch.
  expect(
    result.stdout,
    'the shipped URLs appear in a run pointed at a fixture directory, so the ' +
      'script is not reading frontmatter',
  ).not.toContain('coachess.net')
  expect(result.status).toBe(0)
})

test('a source repository link is checked too, because the page publishes it as proof', async () => {
  const origin = await serve((req, res) =>
    req.url === '/repo' ? res.writeHead(404).end() : res.writeHead(200).end(),
  )
  const dir = mkdtempSync(join(tmpdir(), 'proof-links-'))
  writeFileSync(
    join(dir, 'fixture.mdx'),
    `---\ntitle: fixture\nsummary: A fixture case study.\nrole: Engineer\nperiod: 2026\norder: 1\nsurfaces: []\nsource: ${origin}/repo\n---\n\nBody.\n`,
  )

  const result = await run(['--content', dir])

  expect(result.stdout).toContain(`${origin}/repo`)
  expect(result.status).not.toBe(0)
})

test('finding nothing to check is a failure, not a pass', async () => {
  const dir = contentDir([{ slug: 'fixture', surfaces: [] }])

  const result = await run(['--content', dir])

  // A gate that reports "0 checked, all fine" is the toothless state this whole
  // script exists to avoid, and it is reachable by deleting a surfaces block.
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('no proof links')
})

test('invalid frontmatter fails rather than being skipped', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proof-links-'))
  writeFileSync(join(dir, 'broken.mdx'), `---\ntitle: broken\n---\n\nBody.\n`)

  const result = await run(['--content', dir])

  // Named, not merely non-zero. Every failure mode in this file exits non-zero,
  // so a bare status assertion here passes even when the script does not exist.
  expect(result.stderr).toContain('not a valid case study')
  expect(result.stderr).toContain('broken.mdx')
  expect(result.status).not.toBe(0)
})

test('the offline opt-out skips the check, loudly, and only off CI', async () => {
  const port = await closedPort()
  const dir = contentDir([
    { slug: 'fixture', surfaces: [`http://127.0.0.1:${port}/live`] },
  ])

  const skipped = await run(['--content', dir], { VERIFY_LINKS_OFFLINE: '1' })

  expect(skipped.status).toBe(0)
  expect(
    skipped.stdout + skipped.stderr,
    'the opt-out has to announce itself. A gate that can be turned off ' +
      'silently is a gate that is off',
  ).toContain('SKIPPED')
})

test('the offline opt-out is refused on CI', async () => {
  const port = await closedPort()
  const dir = contentDir([
    { slug: 'fixture', surfaces: [`http://127.0.0.1:${port}/live`] },
  ])

  const result = await run(['--content', dir], {
    VERIFY_LINKS_OFFLINE: '1',
    CI: '1',
  })

  expect(
    result.status,
    'the opt-out was honoured on CI, so the deploy can ship a dead proof link',
  ).not.toBe(0)
  expect(result.stdout + result.stderr).toContain('ignored on CI')
})

test('the proof strip declares no URLs of its own', () => {
  // The predecessor of this test pinned a known drift: ProofStrip.tsx held a
  // hardcoded PROOF_LINKS array while this gate read the frontmatter, so the
  // two could describe different products and the test asserted only that they
  // currently agreed. The component now takes its surfaces as a prop from the
  // home route's loader, so the drift is gone rather than pinned.
  //
  // What is left to check is that it stays gone, and the shape of that check
  // is deliberately crude: no absolute URL may appear in the component's own
  // source at all. A subset assertion could not catch a second list being
  // reintroduced alongside the prop, because a list that is currently correct
  // passes a subset assertion, which is exactly how the original drift stayed
  // green.
  //
  // The site-wide half of this, every external address on every built page
  // against the set the gate checks, is in tests/e2e/prerender.spec.ts, which
  // can read what the pages actually painted.
  const source = readFileSync('src/components/ProofStrip.tsx', 'utf8')
  const urls = [...source.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0])

  expect(
    urls,
    'ProofStrip.tsx names an absolute URL in its own source. Its addresses ' +
      'come from case study frontmatter, which is what scripts/verify-links.mjs ' +
      'checks; a URL written here would be published without ever being verified',
  ).toEqual([])
})

test('the gate checks something, and it comes from the frontmatter', () => {
  // The gate is only worth having while there is something for it to check.
  // A content directory that stopped yielding surfaces would leave every
  // assertion above passing against an empty set.
  const surfaces = getCaseStudies().flatMap((study) => study.surfaces)

  expect(
    surfaces.length,
    'no case study declares any surfaces, so the link gate verifies nothing ' +
      'and the proof strip paints nothing',
  ).toBeGreaterThan(0)

  for (const surface of surfaces) {
    expect(surface.href).toMatch(/^https?:\/\//)
    expect(surface.label.length).toBeGreaterThan(0)
  }
})

test('the build script runs the link gate after contrast and before vite', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

  expect(pkg.scripts['verify:links']).toContain('verify-links.mjs')

  // Chained explicitly rather than through a `prebuild` lifecycle hook, for the
  // same reason the contrast gate is: bun honours prebuild and yarn berry does
  // not, and a gate that depends on which package manager invoked it is not a
  // gate.
  const build: string = pkg.scripts.build
  const contrast = build.search(/verify:contrast|contrast\.mjs/)
  const links = build.search(/verify:links|verify-links\.mjs/)
  const vite = build.indexOf('vite build')

  expect(
    contrast,
    `build does not run the contrast gate: ${build}`,
  ).toBeGreaterThan(-1)
  expect(links, `build does not run the link gate: ${build}`).toBeGreaterThan(
    -1,
  )
  expect(links).toBeGreaterThan(contrast)
  expect(vite).toBeGreaterThan(links)
})
