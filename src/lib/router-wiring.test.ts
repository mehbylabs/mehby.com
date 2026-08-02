import { expect, test } from 'vitest'
import { getRouter } from '#/router'

// Permanent smoke test. Two jobs:
//  1. Keep `bun run test` green on a fresh clone, so a red run always means a
//     real failure rather than "no tests written yet".
//  2. Assert the app's router actually assembles from the generated route tree.
//     This breaks if routeTree.gen.ts goes stale, a route file fails to import,
//     or the `#/` alias stops resolving.

test('router assembles from the generated route tree', () => {
  const router = getRouter()

  expect(Object.keys(router.routesById)).toContain('/')
  expect(router.routeTree.id).toBe('__root__')
})
