import { readFileSync } from 'node:fs'
import { expect, describe, it } from 'vitest'

// .env.example, held to the code it documents.
//
// The failure this exists to catch is not a broken build, it is a deploy that
// looks complete and is not. Every variable this site reads is read on the
// server, at call time, with a fallback: a deployment missing one of them
// builds, prerenders, serves seven pages and passes every browser test, and
// fails only on a visitor's enquiry. So the checklist somebody works from at
// deploy time is the only thing standing between "configured" and "silently
// half-configured", which makes the checklist itself worth testing.
//
// Both directions are checked, because they fail differently and both fail
// quietly:
//
//   a variable read by the code and absent here    nobody sets it, and the
//                                                  first person to notice is a
//                                                  visitor whose message
//                                                  vanished
//
//   a variable listed here and read by nothing     somebody sets a value that
//                                                  does nothing, and every
//                                                  later debugging session
//                                                  starts from a false premise

const EXAMPLE = readFileSync('.env.example', 'utf8')

/**
 * Every environment variable this repository reads, and where.
 *
 * Written out rather than derived, because the two things being compared have
 * to be independent for the comparison to mean anything. The `sources` are
 * grepped, so a variable that moves file still has to be found; the names are
 * literals, so a variable that is renamed in both the code and the example at
 * once still has to be renamed here too.
 */
const VARIABLES = [
  {
    name: 'RESEND_API_KEY',
    source: 'src/lib/contact.ts',
    // Assignable in a copied .env, so the example must carry the line.
    assignable: true,
  },
  {
    name: 'CONTACT_FROM',
    source: 'src/lib/contact.ts',
    assignable: true,
  },
  {
    name: 'VERIFY_LINKS_OFFLINE',
    source: 'scripts/verify-links.mjs',
    // Documented, not assignable. It is a build-time escape hatch, and a
    // `VERIFY_LINKS_OFFLINE=` line in a file people copy to .env is an
    // invitation to set it.
    assignable: false,
  },
  {
    name: 'CI',
    source: 'scripts/verify-links.mjs',
    assignable: false,
  },
] as const

describe('.env.example', () => {
  for (const variable of VARIABLES) {
    it(`documents ${variable.name}, which ${variable.source} reads`, () => {
      // The variable really is read where this file says it is. Without this
      // half, the list above could drift into fiction and every assertion
      // below would keep passing against it.
      expect(
        readFileSync(variable.source, 'utf8'),
        `${variable.source} no longer reads ${variable.name}, so either this ` +
          `list is stale or the variable moved`,
      ).toContain(variable.name)

      expect(
        EXAMPLE,
        `${variable.name} is read by ${variable.source} and is not named in ` +
          `.env.example, so nothing tells whoever deploys this that it exists`,
      ).toContain(variable.name)
    })
  }

  it('gives every assignable variable a line that survives being copied', () => {
    // `cp .env.example .env` has to produce a file that works. A variable
    // documented only in a comment is a variable somebody has to notice and
    // type out, and the one they miss is the one nothing fails on.
    for (const variable of VARIABLES.filter((v) => v.assignable)) {
      expect(
        EXAMPLE,
        `${variable.name} is documented in prose but has no NAME= line, so ` +
          `copying this file to .env does not carry it`,
      ).toMatch(new RegExp(`^${variable.name}=`, 'm'))
    }
  })

  it('offers no assignment for a variable that must not be set locally', () => {
    // The other direction. CI is set by the platform and VERIFY_LINKS_OFFLINE
    // is refused when CI is set; a `CI=` line in a file people copy would make
    // the proof link gate unskippable locally and stop Playwright reusing a
    // running dev server, for no benefit at all.
    for (const variable of VARIABLES.filter((v) => !v.assignable)) {
      expect(
        EXAMPLE,
        `${variable.name} has an assignment line in .env.example. It is not a ` +
          `variable anybody should set in .env, and this file gets copied`,
      ).not.toMatch(new RegExp(`^${variable.name}=`, 'm'))
    }
  })

  it('names every variable it assigns, and assigns no value to any of them', () => {
    // The point of the file. A committed example with a real key in it is the
    // way keys leak, and it leaks in the one place everybody has already
    // agreed is safe to read.
    const assignments = [...EXAMPLE.matchAll(/^([A-Z_][A-Z0-9_]*)=(.*)$/gm)]

    expect(
      assignments.length,
      '.env.example assigns nothing at all, so it documents nothing that ' +
        'survives being copied',
    ).toBeGreaterThan(0)

    for (const [, name, value] of assignments) {
      expect(
        VARIABLES.map((v) => v.name),
        `.env.example assigns ${name}, which nothing in this repository reads`,
      ).toContain(name)
      expect(
        value.trim(),
        `${name} has a value in .env.example. This file is committed; names ` +
          `belong in it and values never do`,
      ).toBe('')
    }
  })

  it('carries no string shaped like a real credential', () => {
    // Belt and braces over the assertion above, which only looks at the right
    // hand side of an assignment. A key pasted into a comment as "for example"
    // is committed just as thoroughly.
    const SECRET_SHAPES = [
      { pattern: /re_[A-Za-z0-9_-]{16,}/, what: 'a Resend API key' },
      { pattern: /sk_live_[A-Za-z0-9]{10,}/, what: 'a live secret key' },
      { pattern: /AKIA[0-9A-Z]{16}/, what: 'an AWS access key id' },
      { pattern: /ghp_[A-Za-z0-9]{20,}/, what: 'a GitHub token' },
      { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: 'a private key' },
    ]

    for (const shape of SECRET_SHAPES) {
      expect(
        shape.pattern.test(EXAMPLE),
        `.env.example contains something shaped like ${shape.what}`,
      ).toBe(false)
    }
  })
})
