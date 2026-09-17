import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// A className that resolves to nothing is invisible. It does not throw, it
// does not warn, it does not fail a type check, and it does not fail any test
// that asserts on text or roles. It fails silently, in the browser, in a
// layout nobody is looking at.
//
// This is not hypothetical. `.hero-actions` was referenced by the hero for the
// whole life of the design system and defined nowhere, so the two primary
// buttons on the home page rendered welded together at 0px: both children are
// `inline-flex`, JSX strips the newline between them, and a div with no
// `display` and no `gap` does nothing about either fact. 150 end-to-end tests
// did not see it, because every one of them asked what the buttons said rather
// than where they were.
//
// So: every class this codebase writes by hand must exist in styles.css.
//
// The site's own classes are the subject. shadcn primitives under
// components/ui are excluded because they are Tailwind end to end and none of
// their classes belong in styles.css.

const STYLES = 'src/styles.css'

// Tailwind utilities used directly in site markup. Deliberately an explicit
// list rather than a pattern: the whole point is that an unrecognised class is
// an error, and "looks a bit like a utility" is not a check. Adding a utility
// here is a two second edit; the alternative is a hole the size of Tailwind.
const TAILWIND = new Set([
  'align-top',
  'border-b-0',
  'gap-6',
  'grid',
  'whitespace-normal',
])

/** Every class selector in the stylesheet, including nested and compound ones. */
function definedClasses(css: string): Set<string> {
  // Comments first. The @font-face block documents a `cp` command whose paths
  // end in `.woff2`, which is a class selector to a regex and nothing to CSS.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return new Set(
    [...code.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((match) => match[1]),
  )
}

/** Every file that writes markup by hand. */
function siteSources(dir = 'src'): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return path === join('src', 'components', 'ui') ? [] : siteSources(path)
    }
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

/**
 * Class tokens written as plain string literals in JSX.
 *
 * Tokens carrying `:`, `[`, `]`, `/` or `&` are Tailwind variants, arbitrary
 * values, or nested selectors (`lg:col-span-7`, `ring-amber/20`). Tailwind
 * generates those on demand, so there is nothing in styles.css to match and
 * nothing to verify.
 */
function usedClasses(files: Array<string>): Map<string, Array<string>> {
  const used = new Map<string, Array<string>>()

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const [, value] of source.matchAll(/className="([^"]+)"/g)) {
      for (const token of value.split(/\s+/)) {
        if (!token || /[:[\]/&]/.test(token)) continue
        const seen = used.get(token) ?? []
        if (!seen.includes(file)) seen.push(file)
        used.set(token, seen)
      }
    }
  }

  return used
}

test('every site class written in markup is defined in the stylesheet', () => {
  const defined = definedClasses(readFileSync(STYLES, 'utf8'))
  const used = usedClasses(siteSources())

  const missing = [...used]
    .filter(([token]) => !defined.has(token) && !TAILWIND.has(token))
    .map(([token, files]) => `.${token} (${files.join(', ')})`)
    .sort()

  expect(
    missing,
    `These classes are referenced in JSX and defined nowhere in ${STYLES}. Either write the rule or delete the reference.`,
  ).toEqual([])
})

test('the scan actually reaches the markup it claims to check', () => {
  // A registry test that silently matched zero files would pass forever. These
  // two assertions are what stop this file from becoming decoration.
  const files = siteSources()

  expect(files).toContain(join('src', 'components', 'Hero.tsx'))
  expect(files.some((file) => file.includes(join('components', 'ui')))).toBe(
    false,
  )

  const used = usedClasses(files)
  expect(used.has('hero-display')).toBe(true)
  expect(used.has('lg:col-span-7')).toBe(false)
})
