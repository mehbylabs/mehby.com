import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { caseStudySchema, getCaseStudies } from '#/lib/content'

// The em dash ban is a standing rule in PRODUCT.md. It lives in the schema
// rather than in a review checklist because a rule nobody can forget is worth
// more than a rule everybody agrees with: a bad file has to fail validation,
// not depend on somebody noticing.

const valid = {
  title: 'CoaChess',
  summary: 'A chess coaching platform with three distinct product surfaces.',
  role: 'CTO and co-founder',
  period: '2022 to present',
  order: 3,
  featured: true,
  surfaces: [{ label: 'coachess.net', href: 'https://coachess.net' }],
  source: 'https://github.com/example/repo',
}

describe('caseStudySchema', () => {
  it('accepts a complete case study', () => {
    expect(caseStudySchema.parse(valid)).toEqual(valid)
  })

  it('defaults surfaces to an empty array when absent', () => {
    const { surfaces: _dropped, ...withoutSurfaces } = valid

    expect(caseStudySchema.parse(withoutSurfaces).surfaces).toEqual([])
  })

  it('defaults featured to false, so the index has at most one by intent', () => {
    const { featured: _dropped, ...withoutFeatured } = valid

    expect(caseStudySchema.parse(withoutFeatured).featured).toBe(false)
  })

  it('rejects an em dash in the summary', () => {
    expect(() =>
      caseStudySchema.parse({
        ...valid,
        summary: 'A thing \u2014 and another.',
      }),
    ).toThrow(/em dash/i)
  })

  it('rejects a double hyphen standing in for an em dash', () => {
    expect(() =>
      caseStudySchema.parse({ ...valid, summary: 'A thing -- and another.' }),
    ).toThrow(/em dash/i)
  })

  it('rejects an em dash in the title', () => {
    expect(() =>
      caseStudySchema.parse({ ...valid, title: 'Volt \u2014 Charge' }),
    ).toThrow(/em dash/i)
  })

  it('names the offending field in the em dash message', () => {
    const result = caseStudySchema.safeParse({
      ...valid,
      summary: 'A thing \u2014 and another.',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['summary'])
    expect(result.error?.issues[0]?.message).toBe(
      'summary must not contain an em dash',
    )
  })

  it('rejects a missing summary', () => {
    const { summary: _dropped, ...withoutSummary } = valid

    expect(() => caseStudySchema.parse(withoutSummary)).toThrow()
    expect(
      caseStudySchema.safeParse(withoutSummary).error?.issues[0]?.path,
    ).toEqual(['summary'])
  })

  it('accepts a bare year as a period and normalises it to a string', () => {
    // YAML types `period: 2026` as a number. Requiring a quoted string would
    // make every case study one forgotten quote away from a failed build, for
    // a field that is only ever printed. Widen the schema, not the content.
    const parsed = caseStudySchema.parse({ ...valid, period: 2026 })

    expect(parsed.period).toBe('2026')
  })

  it('still rejects a period that is not a scalar', () => {
    expect(() =>
      caseStudySchema.parse({ ...valid, period: { from: 2026 } }),
    ).toThrow()
  })

  it('rejects a non-integer order', () => {
    expect(() => caseStudySchema.parse({ ...valid, order: 1.5 })).toThrow()
  })

  it('rejects a surface href that is not a URL', () => {
    expect(() =>
      caseStudySchema.parse({
        ...valid,
        surfaces: [{ label: 'coachess.net', href: 'coachess.net' }],
      }),
    ).toThrow()
  })
})

const WORK_DIR = 'content/work'

const frontmatter = (over: Record<string, unknown> = {}) => {
  const fields = {
    title: 'X',
    summary: 'Y',
    role: 'r',
    period: '2026',
    ...over,
  }
  const body = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return `---\n${body}\n---\n\nBody.\n`
}

const fixtureDir = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'work-'))
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents)
  }
  return dir
}

describe('getCaseStudies', () => {
  it('loads every case study in content/work', () => {
    const files = readdirSync(WORK_DIR).filter((f) => f.endsWith('.mdx'))

    expect(files).toHaveLength(3)
    expect(getCaseStudies()).toHaveLength(files.length)
  })

  it('returns entries sorted by order, whatever the filenames are', () => {
    // Driven by a fixture, deliberately. This used to assert the real slugs in
    // their real sequence, which made it a change detector: it failed the day
    // the owner reordered his own case studies, an editorial decision and not
    // a regression.
    //
    // The fixture is what actually proves the claim in the test's name. The
    // filenames here sort alphabetically to a/b/c while `order` sorts them to
    // c/a/b, so a loader returning directory order fails and a loader sorting
    // correctly passes. Real content could never prove that, because its
    // filenames and its order can happen to agree.
    const dir = fixtureDir({
      'a.mdx': frontmatter({ order: 2 }),
      'b.mdx': frontmatter({ order: 3 }),
      'c.mdx': frontmatter({ order: 1 }),
    })

    const entries = getCaseStudies(dir)

    expect(entries.map((e) => e.order)).toEqual([1, 2, 3])
    expect(entries.map((e) => e.slug)).toEqual(['c', 'a', 'b'])
  })

  it('refuses a second featured case study', () => {
    // Two featured studies is a content error, not a layout preference. It
    // throws rather than resolving to the first, because taking the first
    // silently is the failure nobody notices: the owner marks a new project as
    // the one to read first, the index keeps showing the old one, and nothing
    // anywhere says why.
    const dir = fixtureDir({
      'a.mdx': frontmatter({ order: 1, featured: true }),
      'b.mdx': frontmatter({ order: 2, featured: true }),
    })

    expect(() => getCaseStudies(dir)).toThrow(/featured/)
  })

  it('features exactly one of the real case studies', () => {
    expect(getCaseStudies().filter((e) => e.featured)).toHaveLength(1)
  })

  it('sorts the real content by its declared order', () => {
    const entries = getCaseStudies()

    // The sequence itself is editorial and is not asserted here. What is
    // asserted is that whatever the content declares is what the loader
    // returns, in ascending order and with no duplicates.
    const orders = entries.map((e) => e.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('derives the slug from the filename', () => {
    const slugs = getCaseStudies()
      .map((e) => e.slug)
      .sort()
    const filenames = readdirSync(WORK_DIR)
      .filter((f) => f.endsWith('.mdx'))
      .map((f) => f.replace(/\.mdx$/, ''))
      .sort()

    expect(slugs).toEqual(filenames)
    expect(slugs.every((s) => s.length > 0)).toBe(true)
  })

  it('carries the validated frontmatter through', () => {
    const coachess = getCaseStudies().find((e) => e.slug === 'coachess')

    expect(coachess?.title).toBe('CoaChess')
    expect(coachess?.role).toBe('CTO and co-founder')

    // The shape, not the list. Asserting the exact URLs made this a change
    // detector: it failed the day a fourth CoaChess surface was published,
    // which is a legitimate content edit and not a regression. What the loader
    // actually guarantees is that every surface arrives as an absolute https
    // address whose label is the host a visitor will land on, which is what
    // scripts/verify-links.mjs then checks for real.
    const surfaces = coachess?.surfaces ?? []
    expect(surfaces.length).toBeGreaterThan(0)

    for (const surface of surfaces) {
      const url = new URL(surface.href)
      expect(url.protocol).toBe('https:')
      expect(
        surface.label,
        `surface label "${surface.label}" does not name the host it points at`,
      ).toBe(url.host)
    }
  })

  it('throws naming the offending path when a file is invalid', () => {
    const dir = fixtureDir({
      'good.mdx': frontmatter({ order: 1 }),
      'broken.mdx': frontmatter({ order: 'first' }),
    })

    expect(() => getCaseStudies(dir)).toThrow(/broken\.mdx/)
  })

  it('names the reason as well as the path', () => {
    const dir = fixtureDir({ 'broken.mdx': '---\ntitle: X\norder: 1\n---\n' })

    // A build failure that says only "invalid" costs the reader a debugging
    // session. The failure has to point at the field.
    expect(() => getCaseStudies(dir)).toThrow(/summary/)
  })

  it('fails on an invalid file rather than dropping it from the list', () => {
    // Alphabetically last, so a loader that filters instead of throwing would
    // still return the good entry and look healthy.
    const dir = fixtureDir({
      'aaa-good.mdx': frontmatter({ order: 1 }),
      'zzz-broken.mdx': frontmatter({ order: 2, summary: '' }).replace(
        'summary: ',
        '',
      ),
    })

    expect(() => getCaseStudies(dir)).toThrow(/zzz-broken\.mdx/)
  })

  it('applies the em dash gate to files on disk', () => {
    const dir = fixtureDir({
      'dashed.mdx': frontmatter({ order: 1, summary: 'A thing \u2014 and.' }),
    })

    expect(() => getCaseStudies(dir)).toThrow(/em dash/i)
    expect(() => getCaseStudies(dir)).toThrow(/dashed\.mdx/)
  })

  it('ignores files that are not mdx', () => {
    const dir = fixtureDir({
      'real.mdx': frontmatter({ order: 1 }),
      'README.md': '# not a case study\n',
      'notes.txt': 'nothing here',
    })

    expect(getCaseStudies(dir).map((e) => e.slug)).toEqual(['real'])
  })
})

describe('case study bodies', () => {
  // The schema can only see frontmatter. PRODUCT.md bans em dashes in all
  // content copy, so the prose needs its own gate or the rule holds for
  // exactly the fields somebody remembered to type into the schema.
  it.each(readdirSync(WORK_DIR).filter((f) => f.endsWith('.mdx')))(
    '%s has no em dash in its body',
    (file) => {
      const { content } = matter(readFileSync(join(WORK_DIR, file), 'utf8'))

      expect(content).not.toMatch(/\u2014/)
      expect(content).not.toMatch(/--/)
      expect(content.trim().length).toBeGreaterThan(0)
    },
  )
})

// Importing vite.config resolves the whole plugin pipeline, which is real work
// and is the only thing in this file that does any. Under parallel load it has
// measured over vitest's 5000ms default and flaked the suite; run alone it
// settles in about 1.2s. The assertions are sound, so the fix is a budget that
// reflects what the work costs rather than a retry that hides it.
const PIPELINE_TIMEOUT = 30_000

describe('the mdx pipeline', () => {
  const plugins = async () => {
    const config = (await import('../../vite.config')).default
    return (config.plugins as Array<any>)
      .flat(Infinity)
      .filter((p): p is { name: string } => Boolean(p && p.name))
  }

  it(
    'registers mdx ahead of the react plugin',
    async () => {
      const names = (await plugins()).map((p) => p.name)
      const mdx = names.indexOf('@mdx-js/rollup')
      const react = names.findIndex((n) => n.startsWith('vite:react'))

      expect(
        mdx,
        `mdx plugin missing from vite.config.ts: ${names}`,
      ).toBeGreaterThan(-1)
      expect(react).toBeGreaterThan(-1)
      expect(mdx).toBeLessThan(react)
    },
    PIPELINE_TIMEOUT,
  )

  it(
    'compiles a shipped case study to a component',
    async () => {
      const plugin: any = (await plugins()).find(
        (p) => p.name === '@mdx-js/rollup',
      )
      const file = resolve(WORK_DIR, 'helmdeck.mdx')
      const transform = plugin.transform.handler ?? plugin.transform

      const out = await transform.call({}, readFileSync(file, 'utf8'), file)

      expect(out.code).toContain('MDXContent')
      expect(out.code).toContain('Why a protocol rather than adapters')
    },
    PIPELINE_TIMEOUT,
  )

  it(
    'strips frontmatter instead of rendering it as prose',
    async () => {
      const plugin: any = (await plugins()).find(
        (p) => p.name === '@mdx-js/rollup',
      )
      const file = resolve(WORK_DIR, 'helmdeck.mdx')
      const transform = plugin.transform.handler ?? plugin.transform

      const out = await transform.call({}, readFileSync(file, 'utf8'), file)

      expect(out.code).not.toContain('role: Designer and engineer')
      expect(out.code).not.toContain('source: https://github.com')
    },
    PIPELINE_TIMEOUT,
  )
})
