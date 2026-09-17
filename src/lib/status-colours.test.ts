import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// DESIGN.md: "Green and red are reserved for live status checks and used
// nowhere else." PRODUCT.md names green on black as anti-reference number one,
// the generic terminal the whole visual direction exists not to be.
//
// The site broke its own rule in its own signature component. `.prompt-user`
// was green, which made a green user@host glyph, the single most recognisable
// mark of a default bash prompt, the first coloured pixel a visitor saw, on
// the home page, on /about, in the footer of every page, and on both failure
// pages.
//
// Nothing caught it. The contrast gate measures green against the ground and
// passes at 9.47, because the number was never the problem. tokens.spec.ts
// asserts the token reaches the browser, which it did. The rule is about where
// a colour is allowed to appear, so that is what this asserts.

const STYLES = 'src/styles.css'

/** Selectors whose declaration block mentions `name`, comments stripped. */
function selectorsUsing(css: string, name: string): Array<string> {
  const code = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // The @theme blocks define the tokens and alias them for shadcn. Neither
    // paints anything, and the rule is about rules that do.
    .replace(/@theme[^{]*\{[^{}]*\}/g, '')
  const found: Array<string> = []

  // Each rule is a selector list followed by a brace-delimited block. Good
  // enough for this stylesheet: it nests only @media and @keyframes, and a
  // selector that reaches a status colour from inside either of those is
  // exactly as interesting as one at the top level.
  for (const [, selector, body] of code.matchAll(
    /([^{}@]+)\{([^{}]*)\}/g,
  ) as Iterable<RegExpMatchArray>) {
    if (body.includes(name)) found.push(selector.trim().replace(/\s+/g, ' '))
  }

  return found
}

test.each(['--color-green', '--color-red'])(
  '%s is used only by live status',
  (token) => {
    const users = selectorsUsing(readFileSync(STYLES, 'utf8'), token)

    expect(
      users.length,
      `${token} is referenced by no rule at all`,
    ).toBeGreaterThan(0)

    const stray = users.filter((selector) => !selector.includes('.status'))

    expect(
      stray,
      `${token} is a live status colour and DESIGN.md reserves it for one. ` +
        `These rules paint something else with it.`,
    ).toEqual([])
  },
)

test('the prompt is not a default bash prompt', () => {
  // The specific regression, named, so the reason survives the rule.
  const css = readFileSync(STYLES, 'utf8')
  const promptUser = /\.prompt-user\s*\{([^}]*)\}/.exec(css)

  expect(promptUser, '.prompt-user is gone; delete this test with it').not.toBe(
    null,
  )
  expect(promptUser![1]).not.toContain('--color-green')
})
