import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from '@playwright/test'

// Where the build put the files, for the four spec files that read them.
//
// Four copies of this walk used to live in prerender, metadata, performance and
// a11y, and they all had to change together the day the preset changed. That is
// the drift this module exists to remove: one of the four silently keeping a
// stale directory would not fail, it would find nothing, and `existsSync`
// returning false on a file nobody built is indistinguishable from a page that
// was never prerendered.

/**
 * The adapter's build directory, not the client output directory.
 *
 * Named because the preset decides it: node-server writes `.output`, the vercel
 * preset writes `.vercel/output`. The *client* subdirectory inside it is found
 * rather than named, below, so a preset that renames `static/` costs nothing.
 */
export const BUILD_DIR = '.vercel/output'

/**
 * The directory the prerendered documents were written to.
 *
 * Discovered by walking for the shallowest directory holding an index.html.
 * Pinning `.vercel/output/static` here would turn a preset change into a
 * failure that blames prerendering, or accessibility, or the byte budget,
 * depending on which file read it first.
 */
export const clientDir = () => {
  expect(
    existsSync(BUILD_DIR),
    `${BUILD_DIR} does not exist. Run \`bun run build\` before ` +
      `\`bun run test:e2e\`; these assertions read the built files from disk`,
  ).toBe(true)

  const found: Array<string> = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry === 'index.html') found.push(dir)
    }
  }
  walk(BUILD_DIR)

  const root = found.sort((a, b) => a.length - b.length)[0]
  expect(root, `no index.html anywhere under ${BUILD_DIR}`).toBeTruthy()
  return root
}

/**
 * The prerendered document for a route path.
 *
 * Fails rather than skips when the file is absent, because that absence is the
 * failure: it means the route shipped as a client-rendered shell and a crawler
 * that does not run JavaScript sees an empty document.
 */
export const htmlFor = (path: string) => {
  const base = clientDir()
  const file =
    path === '/' ? join(base, 'index.html') : join(base, path, 'index.html')

  expect(
    existsSync(file),
    `${file} was not emitted, so ${path} ships as a client-rendered page and ` +
      `a crawler that does not run JavaScript sees an empty document`,
  ).toBe(true)
  return readFileSync(file, 'utf8')
}
