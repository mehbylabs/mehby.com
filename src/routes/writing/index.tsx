import { Link, createFileRoute } from '@tanstack/react-router'
import { Grid } from '#/components/Grid'
import { SectionField } from '#/components/SectionField'

// Nothing is published. So this page says that, once, and stops.
//
// The temptation here is three greyed cards labelled "Coming soon", or a
// sample post, or a newsletter box. All three are the same mistake in
// different clothes: PRODUCT.md's honest-scope rule says unfinished work is
// described accurately or omitted, never padded into the appearance of a
// portfolio, and a fake post is worse than an empty section because it is a
// claim rather than an absence.
//
// One band rather than the usual alternation. A drenched title strip above an
// almost empty paper ground reads as a render that stopped halfway, which is
// the one thing an intentionally empty page must not look like. `page-field`
// gives it the height to read as finished.

export const Route = createFileRoute('/writing/')({
  component: Writing,
  head: () => ({
    meta: [
      { title: 'Writing, Mohamed Elhedi Ben Yedder' },
      {
        name: 'description',
        content: 'Notes on the work. Nothing published yet.',
      },
    ],
  }),
})

function Writing() {
  return (
    <main>
      <SectionField tone="ultramarine" className="page-field">
        <Grid>
          <div className="page-head col-span-full lg:col-span-7">
            <h1 className="page-title">Writing</h1>
            <p className="page-intro" data-testid="writing-empty">
              Nothing published yet. Notes on the work in progress will appear
              here.
            </p>
            <p className="page-actions">
              <Link className="action" to="/">
                Home
              </Link>
            </p>
          </div>
        </Grid>
      </SectionField>
    </main>
  )
}
