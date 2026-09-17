import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

// PRODUCT.md bans em dashes in every piece of interface and content copy, and
// bans `--` standing in for one. Encoding it here means a case study that
// breaks the rule fails validation at load time instead of relying on somebody
// spotting it in review.
const noEmDash = (field: string) =>
  z.string().refine((s) => !s.includes('\u2014') && !s.includes('--'), {
    message: `${field} must not contain an em dash`,
  })

// YAML types `period: 2026` as a number, and a period is only ever printed.
// Accepting the scalar and normalising it keeps content authoring free of
// defensive quoting without letting an object or a list through.
const scalarString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))

export const caseStudySchema = z.object({
  title: noEmDash('title'),
  summary: noEmDash('summary'),
  role: z.string(),
  period: scalarString,
  order: z.number().int(),
  // The work index gives one case study a larger treatment. Declared in
  // content rather than inferred from array position: the treatment used to
  // key off `i === 0`, so it followed whatever happened to sort first and
  // said nothing about which project the owner wants read.
  featured: z.boolean().default(false),
  surfaces: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
  source: z.url().optional(),
})

export type CaseStudy = z.infer<typeof caseStudySchema>

export type CaseStudyEntry = CaseStudy & {
  /** Filename without the extension. The URL segment for the case study. */
  slug: string
}

export const CASE_STUDY_DIR = 'content/work'

const explain = (error: z.ZodError) =>
  error.issues
    .map((issue) => {
      const field = issue.path.join('.')
      // The em dash refinement already names its own field, so only prefix
      // messages that would otherwise be anonymous.
      return field && !issue.message.startsWith(field)
        ? `${field}: ${issue.message}`
        : issue.message
    })
    .join(', ')

/**
 * Reads every case study in `dir`, validates each one against
 * `caseStudySchema`, and returns them sorted by the `order` field.
 *
 * Reads from disk, so it is server only: call it from a `createServerFn` or a
 * prerendered loader. Keeping it out of the client bundle is the point, since
 * the alternative is shipping a YAML parser to a visitor.
 *
 * An invalid file throws rather than being skipped. A case study that silently
 * vanishes from the work list is a worse failure than a build that stops, and
 * it is the failure nobody notices.
 */
export function getCaseStudies(dir: string = CASE_STUDY_DIR): CaseStudyEntry[] {
  const studies = readStudies(dir)

  // The work index gives exactly one study the featured treatment, so two of
  // them is a content error and not a layout preference. Thrown rather than
  // resolved by taking the first, because silently ignoring the second is the
  // failure nobody notices: the owner marks a new project as the one to read
  // first, the page keeps showing the old one, and nothing says why.
  const featured = studies.filter((study) => study.featured)
  if (featured.length > 1) {
    throw new Error(
      `${dir} marks ${featured.length} case studies as featured ` +
        `(${featured.map((study) => study.slug).join(', ')}). ` +
        `The work index features one.`,
    )
  }

  return studies
}

function readStudies(dir: string): CaseStudyEntry[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map((file) => {
      const path = join(dir, file)
      const { data } = matter(readFileSync(path, 'utf8'))
      const parsed = caseStudySchema.safeParse(data)

      if (!parsed.success) {
        throw new Error(
          `${path} is not a valid case study: ${explain(parsed.error)}`,
        )
      }

      return { ...parsed.data, slug: file.replace(/\.mdx$/, '') }
    })
    .sort((a, b) => a.order - b.order)
}
