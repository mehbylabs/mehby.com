# mehby.com Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a prerendered portfolio site at mehby.com that converts a two minute skim into a qualified freelance enquiry, carrying its own proof because the owner's source is private and no metrics may be published.

**Architecture:** TanStack Start with file-based routing, prerendered to static HTML at build time, no database and no CMS. Case studies and posts are MDX compiled by the Vite pipeline and validated against a Zod schema. Two build gates block the build: every colour pair must pass WCAG, and every outbound proof link must resolve. Design tokens are OKLCH.

**Tech Stack:** TanStack Start 1.168, TanStack Router 1.170, React 19, TypeScript, Tailwind CSS 4, Vite, Nitro, MDX via `@mdx-js/rollup` and gray-matter, Zod 4, Vitest 4, Playwright 1.62, Satori and Resvg for share images, Resend for the contact form, bun 1.3.3, deployed on Vercel.

**Location:** `/home/ubuntu/projects/mehby/portfolio`

**Required reading before starting:** `PRODUCT.md` and `DESIGN.md` at the repo root. The standing rules in PRODUCT.md are non-negotiable and override any design instinct. In particular: no metrics, no people named except the owner, nothing non-public about CoaChess, no fixed stack list, no em dashes in copy, and labelled placeholders for any missing asset.

---

## Verified facts

Checked against the registry and the installed packages on 2026-08-02. Do not re-derive.

| Fact | Value |
|---|---|
| Archivo Variable axes | `font-weight: 100 900`, `font-stretch: 62% 125%` |
| Martian Mono Variable axes | `font-weight: 100 800`, `font-stretch: 75% 112.5%` |
| Font packages | `@fontsource-variable/archivo@5.3.0`, `@fontsource-variable/martian-mono@5.3.0` |
| Display face | Archivo at `font-stretch: 125%`. There is no separate Expanded package |
| Prerender config | `prerender: { enabled, crawlLinks, autoStaticPathsDiscovery, failOnError, concurrency, filter }` |
| Sitemap config | First-class: `sitemap: { enabled, outputPath, host }`, with per-page `changefreq`, `lastmod`, `images` |
| OG images | No built-in equivalent to `next/og`. Use `satori@0.29.0` plus `@resvg/resvg-js@2.6.2` in a build script |
| Live proof URLs | `https://coachess.net`, `https://app.coachess.net`, `https://live.coachess.net` |

All three proof URLs returned 200 on 2026-08-02. Task 11 turns that into a build-time assertion rather than an assumption.

**Environment gotchas, learned the hard way during Task 1:**
- **The dev and preview port is 3100, never 3000.** Port 3000 on this machine is
  permanently held by an unrelated Dokploy container that answers HTTP 200 on `/`. A
  Playwright `webServer` pointed at 3000 with `reuseExistingServer: true` will happily
  reuse that foreign service, never start our app, and pass tests against it. Both `dev`
  and `preview` use `--strictPort` so a port conflict crashes loudly instead of drifting.
- **Never assert `response.ok()` in an e2e test.** Every HTTP server on earth satisfies it,
  so it cannot distinguish our app from anything else. Assert on content only our
  application renders.

**TanStack Start specifics that differ from React frameworks you may know:**
- Routes are files under `src/routes/`. Dynamic segments use `$slug.tsx`, not `[slug]`.
- Per-route metadata goes in the route's `head` option returning `{ meta, links }`.
- Server-side logic uses `createServerFn`, not server actions.
- After adding or renaming a route file, the route tree regenerates. Run `bun run generate-routes` if it does not pick up automatically.

---

## Task 0: Complete

The application is scaffolded and committed at `edc9d3a`. `PRODUCT.md`, `DESIGN.md`,
`scripts/contrast.mjs` and both plan documents are in place with history preserved.
`bun run build` succeeds and `node scripts/contrast.mjs` passes.

Start at Task 1.

---

## Phase 1: Foundation

### Task 1: Test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `playwright.config.ts`

Nothing can be test-driven until the runners exist, so this comes first.

**Step 1: Install**

```bash
cd /home/ubuntu/projects/mehby/portfolio
bun add -d vitest@4.1.10 @playwright/test@1.62.1
bunx playwright install chromium --with-deps
```

**Step 2: Configure**

`vitest.config.ts` with `environment: 'node'` and `include: ['src/**/*.test.ts']`.
`playwright.config.ts` with `testDir: './tests/e2e'`, `baseURL: 'http://localhost:3100'`,
and a `webServer` running `bun run dev` with `reuseExistingServer: true`.

**Step 3: Add scripts**

```json
"test": "vitest run",
"test:e2e": "playwright test"
```

**Step 4: Prove both runners work**

Write `src/lib/smoke.test.ts` asserting `expect(1 + 1).toBe(2)`.
Run: `bun run test`
Expected: 1 passed. Then delete the smoke file.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add Vitest and Playwright"
```

---

### Task 2: Fonts

**Files:**
- Create: `public/fonts/archivo.woff2`, `public/fonts/martian-mono.woff2`
- Modify: `src/styles.css`, `src/routes/__root.tsx`

There is no `next/font` here, so faces are declared directly and preloaded by hand.

**Step 1: Install and copy the latin width-axis files**

```bash
bun add @fontsource-variable/archivo@5.3.0 @fontsource-variable/martian-mono@5.3.0
mkdir -p public/fonts
cp node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2 public/fonts/archivo.woff2
cp node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-wdth-normal.woff2 public/fonts/martian-mono.woff2
ls -la public/fonts
```

The `wdth` file carries both weight and width axes. That is what makes the display face
possible without a second download.

**Step 2: Declare the faces in `src/styles.css`**

```css
@font-face {
  font-family: 'Archivo';
  src: url('/fonts/archivo.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-display: swap;
}
@font-face {
  font-family: 'Martian Mono';
  src: url('/fonts/martian-mono.woff2') format('woff2-variations');
  font-weight: 100 800;
  font-stretch: 75% 112.5%;
  font-display: swap;
}
```

**Step 3: Preload both in the root route**

In `src/routes/__root.tsx`, add to the `head` `links` array two entries with
`rel: 'preload'`, `as: 'font'`, `type: 'font/woff2'`, `crossOrigin: 'anonymous'`.

**Step 4: Verify**

Run `bun run dev`, open devtools Network, filter Font.
Expected: exactly two woff2 requests, both from the same origin, none to fonts.googleapis.com.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add self-hosted Archivo and Martian Mono variable fonts"
```

---

### Task 3: Token layer, contrast-gated

**Files:**
- Modify: `src/styles.css`, `package.json`

**Step 1: Run the gate first**

Run: `node scripts/contrast.mjs`
Expected: every pair PASS, exit 0. This is the source of truth for the values below.

**Step 2: Write the tokens into `src/styles.css`**

Below the existing `@import "tailwindcss";` add a `@theme` block. Values must match
`scripts/contrast.mjs` exactly.

```css
@theme {
  --color-paper: oklch(0.97 0.008 85);
  --color-ink: oklch(0.22 0.02 265);
  --color-ultramarine: oklch(0.52 0.19 264);
  --color-ultramarine-deep: oklch(0.34 0.15 264);
  --color-rule: oklch(0.88 0.01 85);
  --color-rule-strong: oklch(0.62 0.012 85);
  --color-signal: oklch(0.56 0.16 45);

  --font-display: 'Archivo', system-ui, sans-serif;
  --font-body: 'Archivo', system-ui, sans-serif;
  --font-data: 'Martian Mono', ui-monospace, monospace;

  --text-display: clamp(3rem, 9vw, 7.5rem);
  --text-h1: clamp(2.25rem, 4.5vw, 3.75rem);
  --text-h2: clamp(1.75rem, 2.8vw, 2.5rem);
  --text-h3: 1.333rem;
  --text-body: 1.0625rem;
  --text-data: 0.9375rem;
  --text-fine: 0.8125rem;
}

@layer base {
  body {
    background: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: var(--text-body);
    line-height: 1.6;
  }
  ::selection { background: var(--color-ultramarine); color: var(--color-paper); }
  :focus-visible { outline: 2px solid var(--color-ultramarine); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

**Step 3: Gate the build**

```json
"verify:contrast": "node scripts/contrast.mjs",
"prebuild": "bun run verify:contrast",
"build": "bun run prebuild && vite build"
```

Note: bun does not run npm-style `prebuild` hooks automatically, so it is chained
explicitly inside `build`. Do not rely on the implicit hook.

**Step 4: Prove the gate actually blocks**

Temporarily set `signal` in `scripts/contrast.mjs` to `[0.62, 0.16, 45]`, then run
`bun run build`.
Expected: build aborts with `1 pair(s) below threshold` and a non-zero exit.
Revert, and confirm the build succeeds again.

An unverified gate is not a gate. Do not skip this step.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add OKLCH token layer with a contrast gate on build"
```

---

### Task 4: Grid and section field primitives

**Files:**
- Create: `src/components/Grid.tsx`, `src/components/SectionField.tsx`
- Create: `src/routes/dev/primitives.tsx`
- Test: `tests/e2e/primitives.spec.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';

test('ultramarine field renders paper text on the brand colour', async ({ page }) => {
  await page.goto('/dev/primitives');
  await expect(page.getByTestId('section-field-ultramarine')).toBeVisible();
});

test('grid draws visible column rules', async ({ page }) => {
  await page.goto('/dev/primitives');
  await expect(page.getByTestId('grid-rule').first()).toBeVisible();
});
```

**Step 2: Run it and watch it fail**

Run: `bun run test:e2e tests/e2e/primitives.spec.ts`
Expected: FAIL, the route does not exist.

**Step 3: Implement**

`Grid.tsx`: twelve column CSS grid with hairline rules in `--color-rule`, marked
`aria-hidden` and `data-testid="grid-rule"`.
`SectionField.tsx`: prop `tone: 'paper' | 'ultramarine' | 'ultramarine-deep'`, full bleed,
`data-testid={'section-field-' + tone}`, text set to `--color-paper` on both coloured tones.

**Step 4: Run the test again. Expected: 2 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add grid and section field primitives"
```

---

## Phase 2: Content system

### Task 5: Typed frontmatter with a schema gate

**Files:**
- Create: `src/lib/content.ts`
- Test: `src/lib/content.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { caseStudySchema } from './content';

describe('caseStudySchema', () => {
  it('accepts a complete case study', () => {
    const parsed = caseStudySchema.parse({
      title: 'VoltTunisia',
      summary: 'The national electric vehicle companion for Tunisia.',
      role: 'Designer and engineer',
      period: '2026',
      order: 1,
      surfaces: [{ label: 'Catalog', href: 'https://example.com' }],
    });
    expect(parsed.title).toBe('VoltTunisia');
  });

  it('rejects an em dash in the summary', () => {
    expect(() =>
      caseStudySchema.parse({
        title: 'X',
        summary: 'A thing \u2014 and another.',
        role: 'r',
        period: '2026',
        order: 1,
      }),
    ).toThrow(/em dash/i);
  });

  it('rejects a missing summary', () => {
    expect(() => caseStudySchema.parse({ title: 'X' })).toThrow();
  });
});
```

The em dash test enforces a PRODUCT.md standing rule mechanically rather than by memory.

**Step 2: Run it and watch it fail**

Run: `bun run test`
Expected: FAIL, cannot resolve `./content`.

**Step 3: Implement**

```ts
import { z } from 'zod';

const noEmDash = (field: string) =>
  z.string().refine((s) => !s.includes('\u2014') && !s.includes('--'), {
    message: `${field} must not contain an em dash`,
  });

export const caseStudySchema = z.object({
  title: noEmDash('title'),
  summary: noEmDash('summary'),
  role: z.string(),
  period: z.string(),
  order: z.number().int(),
  surfaces: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
  source: z.url().optional(),
  cover: z.string().optional(),
});

export type CaseStudy = z.infer<typeof caseStudySchema>;
```

Install first: `bun add zod@4.4.3`. Note Zod 4 uses `z.url()`, not `z.string().url()`.

**Step 4: Run the test again. Expected: 3 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add typed content schema enforcing the em dash rule"
```

---

### Task 6: MDX pipeline and loader

**Files:**
- Modify: `vite.config.ts`, `src/lib/content.ts`
- Create: `content/work/coachess.mdx`, `content/work/helmdeck.mdx`, `content/work/volt-tunisia.mdx`
- Test: `src/lib/content.test.ts`

**Step 1: Install and wire MDX**

```bash
bun add -d @mdx-js/rollup@3.1.1 gray-matter@4.0.3
```

Add `mdx()` to the Vite plugin array, before the React plugin.

**Step 2: Write the failing test**

Assert `getCaseStudies()` returns exactly three entries sorted by `order`, that each slug
matches its filename, and that an invalid frontmatter file throws an error naming the path.

**Step 3: Run and watch it fail.**

**Step 4: Implement**

`getCaseStudies()` reads `content/work/*.mdx`, parses with gray-matter, validates each
through `caseStudySchema`, throws on the first invalid file naming the offending path, and
returns sorted by `order`.

Seed the three MDX files with real frontmatter and bodies containing only
`<!-- PLACEHOLDER: narrative pending owner review -->`. **Do not invent case study prose.**
Per PRODUCT.md, CoaChess content must contain no internal repository names, no service
names, no infrastructure detail, and no metrics.

**Step 5: Run the test. Expected: all pass.**

**Step 6: Commit**

```bash
git add -A && git commit -m "Add MDX pipeline and case study loader"
```

---

### Task 7: Specification table

**Files:**
- Create: `src/components/SpecTable.tsx`
- Test: `tests/e2e/spec-table.spec.ts`

The signature component. Real table semantics, not divs.

**Step 1: Write the failing test**

```ts
test('spec table uses real table semantics', async ({ page }) => {
  await page.goto('/work/coachess');
  const table = page.getByRole('table', { name: /specification/i });
  await expect(table).toBeVisible();
  await expect(table.getByRole('rowheader').first()).toBeVisible();
});
```

**Step 2: Run and watch it fail.**

**Step 3: Implement.** `<table>` with a visually hidden `<caption>`, `<th scope="row">` in
Archivo, `<td>` in Martian Mono, dividers in `--color-rule-strong`, row hover tint. Never
use `--color-rule` for a border that carries meaning; it measures 1.32:1 and is decorative
only.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add specification table component"
```

---

### Task 8: Placeholder component

**Files:**
- Create: `src/components/Placeholder.tsx`
- Test: `tests/e2e/placeholder.spec.ts`

PRODUCT.md requires missing assets to ship as obviously provisional blocks.

**Step 1: Write the failing test.** Assert it renders its label as visible text, carries
`role="img"` with an `aria-label` naming what is missing, and reserves a fixed aspect ratio.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** Ruled border in `--color-rule-strong`, Martian Mono caption reading
for example `PLACEHOLDER: headshot`, aspect ratio from a prop so no layout shift occurs when
the real asset lands.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add labelled placeholder component"
```

---

## Phase 3: Pages

### Task 9: Homepage

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/components/Hero.tsx`, `src/components/ProofStrip.tsx`
- Test: `tests/e2e/home.spec.ts`

**Step 1: Write the failing tests**

```ts
test('hero states the positioning and the credential', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ben Yedder/i);
});

test('proof strip shows exactly the three live surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('proof-link')).toHaveCount(3);
});

test('no badge wall is present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stack-badge')).toHaveCount(0);
});
```

**Step 2: Run and watch them fail.**

**Step 3: Implement.** Drenched ultramarine hero, one display line at `font-stretch: 125%`,
three proof links in Martian Mono beneath. Then three pillars, three capability statements
in prose, then contact. No card grid, no badges, no metrics.

**Step 4: Run the tests. Expected: 3 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add homepage with hero and proof strip"
```

---

### Task 10: Case study route and prerendering

**Files:**
- Create: `src/routes/work/$slug.tsx`
- Modify: `vite.config.ts`
- Test: `tests/e2e/work.spec.ts`

**Step 1: Write the failing test.** All three slugs return 200 and render an `h1`. An
unknown slug renders the not-found component.

**Step 2: Run and watch it fail.**

**Step 3: Implement the route**, then enable prerendering in the TanStack Start plugin
options:

```ts
tanstackStart({
  prerender: { enabled: true, crawlLinks: true, failOnError: true },
  sitemap: { enabled: true, host: 'https://mehby.com' },
})
```

`failOnError` matters. Without it a route that throws during prerender silently ships as a
client-only page and loses its SEO value, which is the entire reason this site is
prerendered.

**Step 4: Verify static output exists**

Run: `bun run build && find .output -name '*.html' | sort`
Expected: HTML files for `/`, `/work/coachess`, `/work/helmdeck`, `/work/volt-tunisia`.
Also confirm a sitemap was emitted.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add case study route with prerendering and sitemap"
```

---

### Task 11: Build-time proof link verification

**Files:**
- Create: `scripts/verify-links.mjs`
- Modify: `package.json`
- Test: `scripts/verify-links.test.mjs`

The site claims three products are live. If one goes down the site must stop claiming it.

**Step 1: Write the failing test.** Assert the checker returns `ok: false` for an
unresolvable host and `ok: true` for a 200, using a local server fixture rather than the
live network.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** Read URLs from case study frontmatter, not a duplicated list. Follow
redirects, 10 second timeout, 2 retries, print a table, exit non-zero on unreachable.

**Step 4: Run against the real URLs**

Run: `node scripts/verify-links.mjs`
Expected: three rows, all 200.

Extend the build chain: `"prebuild": "bun run verify:contrast && bun run verify:links"`.

**Step 5: Commit**

```bash
git add -A && git commit -m "Verify proof links at build time"
```

---

### Task 12: About, contact, and writing routes

**Files:**
- Create: `src/routes/about.tsx`, `src/routes/contact.tsx`, `src/routes/writing/index.tsx`
- Test: `tests/e2e/routes.spec.ts`

**Step 1: Write the failing test.** Every route returns 200 with exactly one `h1`.
`/writing` with no posts renders an honest empty state and zero fabricated entries.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** `/about` uses `Placeholder` for the headshot and states only what is
known. **Do not invent pre-2022 history**, it is pending from the owner.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add about, contact and writing routes"
```

---

## Phase 4: Hardening and ship

### Task 13: Contact form

**Files:**
- Create: `src/lib/contact.ts`
- Modify: `src/routes/contact.tsx`
- Test: `src/lib/contact.test.ts`

**Step 1: Write the failing tests.** Five states: valid submission, invalid email, empty
message, honeypot filled meaning silent success without sending, and the mail provider
throwing meaning a user-visible failure with retry.

**Step 2: Run and watch them fail.**

**Step 3: Implement** using `createServerFn` with Zod validation, a honeypot field, and
Resend. **The destination address is a placeholder constant until the owner supplies one.**
Do not use any address found in git config or scraped from another site.

**Step 4: Run the tests. Expected: 5 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add contact server function with full state coverage"
```

---

### Task 14: Not-found and error components

**Files:**
- Modify: `src/routes/__root.tsx`

TanStack Router takes `notFoundComponent` and `errorComponent` in the root route options
rather than as separate files. Write both in voice, as a specification for a page that does
not exist. Both link home.

**Verify:** `bun run dev`, visit `/does-not-exist`, confirm the custom component renders.

**Commit:** `git commit -m "Add not-found and error components in voice"`

---

### Task 15: Metadata, share images, feed

**Files:**
- Modify: every route file, adding a `head` option
- Create: `scripts/og.mjs`, `src/routes/writing/feed.xml.tsx`

Per-route `head` returns `{ meta, links }` with title, description, canonical, and OpenGraph
tags. Sitemap is already handled by the plugin config from Task 10.

Share images: `bun add -d satori@0.29.0 @resvg/resvg-js@2.6.2`, then a build script that
renders each case study title on the ultramarine ground in Archivo and writes PNGs to
`public/og/`. This is the one piece of genuine plumbing that a Next.js build would have
given for free.

RSS via `feed@6.0.0`, served from a route returning `application/rss+xml`.

**Verify:** `bun run build`, confirm `public/og/*.png` exist and are valid PNGs, and that the
sitemap excludes `/dev`.

**Commit:** `git commit -m "Add per-route metadata, share images and feed"`

---

### Task 16: Accessibility and performance audit

**Step 1:** `node scripts/contrast.mjs`. Expected: all pass.
**Step 2:** `bun run test && bun run test:e2e`. Expected: all pass.
**Step 3:** Run `impeccable audit` against the built output. Budget: performance 95 or
above, accessibility 100.
**Step 4:** Fix findings and re-run. **Do not claim the budget is met without pasting the
actual numbers.**

**Commit:** `git commit -m "Fix audit findings"`

---

### Task 17: Deploy

**Step 1:** Remove the `/dev/primitives` scratch route, or exclude it from prerender via the
`filter` option and from the sitemap.
**Step 2:** Push to a new private GitHub repository.
**Step 3:** Import to Vercel. The Nitro adapter targets Vercel via its preset. Confirm the
build passes there including both gates.
**Step 4:** Add `mehby.com` in Vercel and point the registrar. The domain currently has no
DNS records at all, so this is first-time configuration.
**Step 5:** Verify `https://mehby.com` returns 200 with a valid certificate.

---

## Owner-supplied, tracked as placeholders until delivered

| Asset | Blocks |
|---|---|
| Headshot | `/about` visual only |
| Helmdeck and VoltTunisia screenshots | case study covers only |
| Contact email | Task 13 destination |
| Pre-2022 history | `/about` timeline only |
| Case study narratives, owner-reviewed | Task 6 bodies |

None block Tasks 1 through 8, 10, 11, 14 or 15.

## Standing rules, restated because they are easy to lose mid-implementation

No metrics. No people named except the owner. Nothing non-public about CoaChess, meaning no
internal repository names, service names, or infrastructure detail. No fixed stack list or
badge wall. No em dashes, enforced by the schema in Task 5. Placeholders never quietly become
invented content.
