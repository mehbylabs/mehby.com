# mehby.com

My portfolio. A prerendered TanStack Start site where two gates block the build:
every colour pair must clear WCAG 2.2 AA, and every product the site claims is
live must actually answer.

**Live:** https://mehby.com

## Why this repository is worth a look

The site sells full stack product engineering, so it is built the way I would
build a client's product rather than the way portfolios usually get built.

**The build refuses to ship a lie.** The homepage claims four products are
live. `scripts/verify-links.mjs` reads those URLs from case study frontmatter,
requests each one, and exits non-zero if any is unreachable. A 4xx fails
immediately; a connection failure is retried twice and then fails. There is an
offline escape hatch, and it is refused when `CI` is set, because the danger is
not a developer using it on a train, it is it leaking into the deploy
environment where nobody notices the gate stopped running.

**Colour is measured, not eyeballed.** `scripts/contrast.mjs` holds every design
token as OKLCH and asserts twelve pairs against WCAG thresholds. It caught four
real defects during development, including a focus ring that measured **1.00:1**
against its own background, which is to say invisible, across a third of the
site.

**The proof strip checks itself at request time.** The hero pings the same
frontmatter URLs through a server function and renders `LIVE · 200`, `offline`,
or `checking…`. Green is earned by a real response and used nowhere else in the
design.

**Tests are mutation tested.** Assertions were deliberately broken to confirm
each one fails for the right reason. That process found tests of my own that
passed against broken implementations, including an end-to-end test that was
asserting against an unrelated service on a shared port, and a font test that
would have passed while the page rendered in a fallback typeface.

## Stack

TanStack Start, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vite, Nitro,
MDX for case studies, Playwright and Vitest, deployed on Vercel.

## Running it

```bash
bun install
bun run dev          # http://localhost:3001
```

Port 3001, not 3000, because 3000 is occupied on my machine by an unrelated
service that answers 200. Both `dev` and `preview` use `--strictPort` so a
conflict fails loudly instead of drifting to another port and producing tests
that pass against the wrong application.

```bash
bun run test         # 96 unit tests
bun run test:e2e     # 298 end-to-end tests
bun run build        # runs both gates, then prerenders 8 pages
bun run lint
bun run check        # formatting
```

`bun run build && bun run test:e2e` is the real gate. Several specs read the
built output from disk and fail, rather than skip, when it is absent.

One-time setup for end-to-end tests:

```bash
bunx playwright install chromium
```

## Layout

```
content/work/*.mdx      case studies: frontmatter plus narrative
scripts/contrast.mjs    the WCAG gate
scripts/verify-links.mjs the proof-link gate
scripts/og.mjs          share images, generated at build time
src/lib/live.ts         the request-time live check
src/components/         hand-built components
src/components/ui/      shadcn/ui
tests/e2e/              Playwright
docs/DEPLOY.md          the deploy runbook
PRODUCT.md, DESIGN.md   product context and the design system
```

## Environment

See `.env.example`. Two variables, both server side, neither prefixed `VITE_`:
`RESEND_API_KEY` for the contact form, and `CONTACT_FROM` for the sender
address. Without the first, the form fails visibly rather than pretending an
enquiry was sent.

## Licence

The code is available to read and learn from. The content, copy, case studies
and imagery are mine and are not licensed for reuse.
