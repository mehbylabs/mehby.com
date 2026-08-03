import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// scripts/contrast.mjs is only a gate if a failing pair actually stops the
// build. A script that nobody runs, or that runs and is ignored, is decoration.
// These tests pin both halves of that: the script fails loudly, and the build
// script is the thing that runs it.

const SCRIPT = 'scripts/contrast.mjs'

test('the contrast gate passes for the shipped tokens', () => {
  const out = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
  expect(out).toContain('All pairs pass WCAG 2.2 AA.')
})

test('the contrast gate fails, non-zero, when a pair drops below threshold', () => {
  // Runs a mutated copy rather than editing the real script, so this test can
  // never leave a poisoned token behind if it is interrupted.
  const source = readFileSync(SCRIPT, 'utf8')
  const mutated = source.replace(
    'signal: [0.56, 0.16, 45]',
    'signal: [0.62, 0.16, 45]',
  )
  expect(
    mutated,
    'the signal token literal moved; update this test to match scripts/contrast.mjs',
  ).not.toBe(source)

  const file = join(mkdtempSync(join(tmpdir(), 'contrast-')), 'contrast.mjs')
  writeFileSync(file, mutated)

  const run = spawnSync('node', [file], { encoding: 'utf8' })

  expect(run.status).not.toBe(0)
  expect(run.stderr).toContain('1 pair(s) below threshold')
})

test('the build script runs the contrast gate before vite build', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

  expect(pkg.scripts['verify:contrast']).toContain(SCRIPT)

  // Chained explicitly rather than relying on a `prebuild` lifecycle hook.
  // bun 1.3 does honour prebuild, but yarn berry does not, and a gate that
  // depends on which package manager invoked it is not a gate.
  const build: string = pkg.scripts.build
  const gate = build.search(/verify:contrast|contrast\.mjs/)
  const vite = build.indexOf('vite build')

  expect(gate, `build script does not run the gate: ${build}`).toBeGreaterThan(
    -1,
  )
  expect(vite).toBeGreaterThan(gate)
})
