import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableRow,
} from '#/components/ui/table'

// The signature component. DESIGN.md calls the specification table "the primary
// way work is presented", and PRODUCT.md's second design principle is why:
// "the work is presented the way the work actually is: tabular, precise,
// annotated". So this is a real <table> on the shadcn Table primitive, with a
// real <caption> and real <th scope="row">, and not a div grid that looks like
// one. The difference is invisible on screen and total to a screen reader,
// which is why tests/e2e/spec-table.spec.ts asserts on ARIA roles rather than
// on markup.
//
// The borders come from styles.css: a structural edge-strong rule across the
// top of the table, decorative edge rules between the rows. No tone prop is
// needed because the whole site stands on one ground; the dividers are the
// same everywhere.

export type Surface = {
  label: string
  href: string
}

// Shaped from what src/lib/content.ts returns for a case study, minus the parts
// that are not table rows: `title` and `summary` are page copy, `order` and
// `slug` are routing, `cover` is the image. `caption` is the one addition, and
// it is required rather than derived from the title so that the accessible name
// of the table can say what the table is and not merely repeat the heading
// above it.
//
// `stack` has no counterpart in the frontmatter schema yet and is supplied by
// the caller. PRODUCT.md permits capability "in per-project tables" and bans it
// as a fixed list, so if it ever moves into content it belongs per case study,
// which is the shape here.
export type SpecTableProps = {
  /** Names the table for assistive technology. Not painted. */
  caption: string
  role: string
  period: string
  /** Live surfaces, label plus href. An empty list omits the row. */
  surfaces?: ReadonlyArray<Surface>
  /** Public repository, if there is one. */
  source?: string
  /** Chosen in context for this project, never a capability inventory. */
  stack?: ReadonlyArray<string>
}

type Row = {
  label: string
  value: ReactNode
}

// DESIGN.md sets link URLs in Martian Mono as data, so the source cell prints
// the address rather than a word like "GitHub": which repository is being
// claimed is the evidence, and hiding it behind a label is the claim without
// the proof. The scheme is dropped because it is the one part of a URL that
// carries no information.
const displayUrl = (href: string) =>
  href.replace(/^https?:\/\//, '').replace(/\/$/, '')

// Every link in this table leaves the site. The evidence should not also be
// the exit: a visitor who opens a surface to check it, and finds the case
// study replaced by somebody else's product, has no route back that does not
// involve the browser's history.
//
// `rel` is not optional with a named target. `noopener` denies the opened page
// a handle on this one, and `noreferrer` keeps the visit out of the
// destination's referrer log, which is the same privacy position the rest of
// the site takes by serving its own fonts.
//
// No "opens in a new tab" text. That warning is WCAG 3.2.5, which is AAA, and
// the site targets AA. In a specification table where every cell value is an
// address, appending the same sentence to each one turns a data table into
// prose and costs a screen reader user more than it tells them.
const AWAY = { target: '_blank', rel: 'noopener noreferrer' } as const

export function SpecTable({
  caption,
  role,
  period,
  surfaces = [],
  source,
  stack = [],
}: SpecTableProps) {
  // Rows are collected rather than written inline because a row with no data is
  // omitted, not printed empty. PRODUCT.md asks for honest scope: an empty
  // "Source" cell on a project with no public repository reads as a rendering
  // fault, and a dash reads as a claim that there is nothing to show.
  const rows: Array<Row> = [
    { label: 'Role', value: role },
    { label: 'Period', value: period },
  ]

  if (surfaces.length > 0) {
    rows.push({
      label: 'Surfaces',
      value: (
        <ul className="spec-list">
          {surfaces.map((surface) => (
            <li key={surface.href}>
              <a href={surface.href} {...AWAY}>
                {surface.label}
              </a>
            </li>
          ))}
        </ul>
      ),
    })
  }

  if (source) {
    rows.push({
      label: 'Source',
      value: (
        <a href={source} {...AWAY}>
          {displayUrl(source)}
        </a>
      ),
    })
  }

  if (stack.length > 0) {
    rows.push({ label: 'Stack', value: stack.join(', ') })
  }

  return (
    <Table className="spec-table" data-testid="spec-table">
      {/* Visually hidden, not hidden. A table with no accessible name is
          announced as "table" and nothing else, and there are three of them on
          a work page. Hidden with the clip technique rather than `display:
          none`, which would delete the name it exists to provide. */}
      <TableCaption className="spec-caption">{caption}</TableCaption>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} className="border-b-0">
            {/* scope="row" is load-bearing. Without it the association between
                a label and the value beside it is left to the browser's
                heuristics, and a table the browser reads as ambiguous
                announces every value under the wrong header. */}
            <TableHead scope="row" className="whitespace-normal align-top">
              {row.label}
            </TableHead>
            <TableCell className="whitespace-normal align-top">
              {row.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
