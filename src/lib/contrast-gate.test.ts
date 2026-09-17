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
  // Points the real gate at a mutated copy of the stylesheet rather than
  // editing either file in place, so an interrupted run cannot leave a
  // poisoned colour behind.
  //
  // The mutation is on styles.css because that is now where the tokens live.
  // The gate used to carry its own copy of all eleven, which meant the header
  // calling it the source of truth was wrong: editing a colour in the
  // stylesheet left the build measuring the old value, and passing.
  const source = readFileSync('src/styles.css', 'utf8')
  const mutated = source.replace(
    '--color-red: oklch(0.6 0.2 25);',
    '--color-red: oklch(0.45 0.2 25);',
  )
  expect(
    mutated,
    'the red token declaration moved; update this test to match src/styles.css',
  ).not.toBe(source)

  const file = join(mkdtempSync(join(tmpdir(), 'contrast-')), 'styles.css')
  writeFileSync(file, mutated)

  const run = spawnSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CONTRAST_STYLES: file },
  })

  expect(run.status).not.toBe(0)
  expect(run.stderr).toContain('1 pair(s) below threshold')
})

test('the contrast gate reads its tokens from the stylesheet', () => {
  // The property that makes this a gate rather than a second opinion. If it
  // ever stops reading styles.css, a colour can change in the file the browser
  // loads while the build keeps checking a copy nobody edited.
  const script = readFileSync(SCRIPT, 'utf8')

  expect(script).toContain('styles.css')
  // And it measures what it read: every token in the stylesheet reaches the
  // printed table, so a token added without a pair is at least visible.
  const declared = [
    ...readFileSync('src/styles.css', 'utf8').matchAll(
      /--color-([\w-]+):\s*oklch\(/g,
    ),
  ].map((match) => match[1])
  const out = execFileSync('node', [SCRIPT], { encoding: 'utf8' })

  expect(declared.length).toBeGreaterThan(0)
  for (const token of declared) {
    expect(out, `${token} is defined but never measured`).toContain(token)
  }
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
