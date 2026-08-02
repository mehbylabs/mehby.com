# mehby.com Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a static portfolio site at mehby.com that converts a two minute skim into a qualified freelance enquiry, carrying its own proof because the owner's source is private and no metrics may be published.

**Architecture:** Next.js App Router, fully statically generated, no database and no CMS. Case studies and posts are MDX files read at build time. A build step verifies that every outbound proof link resolves, so the site cannot silently start lying. Design tokens are OKLCH and every colour pair is contrast tested in CI.

**Tech Stack:** Next.js 16.2.12, React 19, TypeScript, Tailwind CSS 4.3.3, MDX via gray-matter and next-mdx-remote 6, Vitest 4.1.10, Playwright 1.62.1, Resend 6.18.1, Zod 4.4.3, bun 1.3.3, deployed on Vercel.

**Required reading before starting:** `PRODUCT.md` and `DESIGN.md` at the repo root. The standing rules in PRODUCT.md are non-negotiable and override any design instinct. In particular: no metrics, no people named except the owner, nothing non-public about CoaChess, no fixed stack list, no em dashes in copy, and labelled placeholders for any missing asset.

---

## Verified facts

Do not re-derive these. They were checked against the registry on 2026-08-02.

| Fact | Value |
|---|---|
| Archivo Variable axes | `font-weight: 100 900`, `font-stretch: 62% 125%` |
| Martian Mono Variable axes | `font-weight: 100 800`, `font-stretch: 75% 112.5%` |
| Font packages | `@fontsource-variable/archivo@5.3.0`, `@fontsource-variable/martian-mono@5.3.0` |
| Display face | Archivo at `font-stretch: 125%`. There is no separate Expanded package |
| Live proof URLs | `https://coachess.net`, `https://app.coachess.net`, `https://live.coachess.net` |

The three proof URLs each returned 200 on 2026-08-02. Task 12 makes that a build-time assertion rather than a assumption.

---

## Phase 1: Foundation

### Task 1: Scaffold the application

**Files:**
- Create: everything under `/home/ubuntu/projects/mehby-com` except the four files already committed

The repo already exists with `PRODUCT.md`, `DESIGN.md`, `scripts/contrast.mjs` and `docs/plans/`. Scaffold into a temporary directory and merge, so the existing commit history is preserved.

**Step 1: Scaffold into a temp directory**

```bash
cd /tmp && rm -rf mehby-scaffold
bunx create-next-app@16.2.12 mehby-scaffold \
  --typescript --tailwind --app --src-dir --import-alias "@/*" \
  --no-eslint --use-bun --yes
```

**Step 2: Merge into the repo, keeping committed files**

```bash
cd /tmp/mehby-scaffold
rm -rf .git README.md
cp -rn . /home/ubuntu/projects/mehby-com/
cd /home/ubuntu/projects/mehby-com && bun install
```

**Step 3: Verify it builds and runs**

Run: `cd /home/ubuntu/projects/mehby-com && bun run build`
Expected: build completes with no errors, and a route table listing `/` is printed.

**Step 4: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js application"
```

---

### Task 2: Install fonts and wire the type system

**Files:**
- Create: `src/fonts/archivo.woff2`, `src/fonts/martian-mono.woff2`
- Create: `src/app/fonts.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Install the font packages and copy the latin width-axis files**

```bash
bun add @fontsource-variable/archivo@5.3.0 @fontsource-variable/martian-mono@5.3.0
mkdir -p src/fonts
cp node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2 src/fonts/archivo.woff2
cp node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-wdth-normal.woff2 src/fonts/martian-mono.woff2
ls -la src/fonts
```

The `wdth` file carries both the weight and the width axis, which is what makes the display face possible without a second download.

**Step 2: Declare the faces**

Create `src/app/fonts.ts`:

```ts
import localFont from 'next/font/local';

export const archivo = localFont({
  src: '../fonts/archivo.woff2',
  variable: '--font-archivo',
  display: 'swap',
  weight: '100 900',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

export const martianMono = localFont({
  src: '../fonts/martian-mono.woff2',
  variable: '--font-martian',
  display: 'swap',
  weight: '100 800',
  declarations: [{ prop: 'font-stretch', value: '75% 112.5%' }],
});
```

**Step 3: Apply both variables on `<html>`**

In `src/app/layout.tsx`, import the fonts and set
`className={`${archivo.variable} ${martianMono.variable}`}` on the `html` element.
Set `lang="en"`.

**Step 4: Verify**

Run: `bun run build`
Expected: build succeeds. Then `bun run dev` and confirm in devtools that
`--font-archivo` resolves and no network request is made to fonts.googleapis.com.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add self-hosted Archivo and Martian Mono variable fonts"
```

---

### Task 3: Token layer, contrast-gated

**Files:**
- Modify: `src/app/globals.css`
- Modify: `package.json`
- Test: `scripts/contrast.mjs` already exists and already passes

**Step 1: Run the existing contrast gate first**

Run: `node scripts/contrast.mjs`
Expected: every pair PASS, exit code 0. This is the source of truth for the values below.

**Step 2: Write the tokens**

Replace the contents of `src/app/globals.css` with the Tailwind 4 import plus a
`@theme` block. Values come from `DESIGN.md` and must match `scripts/contrast.mjs` exactly.

```css
@import "tailwindcss";

@theme {
  --color-paper: oklch(0.97 0.008 85);
  --color-ink: oklch(0.22 0.02 265);
  --color-ultramarine: oklch(0.52 0.19 264);
  --color-ultramarine-deep: oklch(0.34 0.15 264);
  --color-rule: oklch(0.88 0.01 85);
  --color-rule-strong: oklch(0.62 0.012 85);
  --color-signal: oklch(0.56 0.16 45);

  --font-display: var(--font-archivo);
  --font-body: var(--font-archivo);
  --font-data: var(--font-martian);

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
  :focus-visible {
    outline: 2px solid var(--color-ultramarine);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

**Step 3: Wire the gate into the build**

Add to `package.json` scripts:

```json
"verify:contrast": "node scripts/contrast.mjs",
"prebuild": "npm run verify:contrast"
```

**Step 4: Verify the gate actually blocks**

Temporarily change `signal` in `scripts/contrast.mjs` to `[0.62, 0.16, 45]` and run
`bun run build`.
Expected: build aborts, `1 pair(s) below threshold`, non-zero exit.
Revert the change and confirm the build succeeds again.

This step matters. An unverified gate is not a gate.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add OKLCH token layer with a contrast gate on prebuild"
```

---

### Task 4: Grid and section field primitives

**Files:**
- Create: `src/components/Grid.tsx`
- Create: `src/components/SectionField.tsx`
- Test: `tests/e2e/primitives.spec.ts`

`DESIGN.md` calls for a strict visible grid with drawn hairlines, and section fields that
alternate paper and ultramarine to produce the colour commitment structurally.

**Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';

test('ultramarine field renders paper-coloured text on the brand colour', async ({ page }) => {
  await page.goto('/dev/primitives');
  const field = page.getByTestId('section-field-ultramarine');
  await expect(field).toHaveCSS('background-color', 'oklch(0.52 0.19 264)');
});

test('grid draws visible column rules', async ({ page }) => {
  await page.goto('/dev/primitives');
  await expect(page.getByTestId('grid-rule').first()).toBeVisible();
});
```

**Step 2: Run it and watch it fail**

Run: `bunx playwright test tests/e2e/primitives.spec.ts`
Expected: FAIL, the route `/dev/primitives` does not exist.

**Step 3: Implement**

`Grid.tsx` renders a twelve column CSS grid with `gap` and absolutely positioned
hairline rules in `--color-rule`, marked `aria-hidden` and `data-testid="grid-rule"`.
`SectionField.tsx` takes `tone: 'paper' | 'ultramarine' | 'ultramarine-deep'`, renders
full bleed with `data-testid={`section-field-${tone}`}`, and sets text to `--color-paper`
on the two coloured tones.

Add a scratch route `src/app/dev/primitives/page.tsx` rendering both. Exclude `/dev`
from the sitemap in Task 15 and from production via `robots`.

**Step 4: Run the test again**

Run: `bunx playwright test tests/e2e/primitives.spec.ts`
Expected: 2 passed.

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
        summary: 'A thing \u2014 and another thing.',
        role: 'r',
        period: '2026',
        order: 1,
      }),
    ).toThrow(/em dash/i);
  });

  it('rejects a summary that is missing', () => {
    expect(() => caseStudySchema.parse({ title: 'X' })).toThrow();
  });
});
```

The em dash test enforces a PRODUCT.md standing rule mechanically rather than by memory.

**Step 2: Run it and watch it fail**

Run: `bunx vitest run src/lib/content.test.ts`
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
  surfaces: z.array(z.object({ label: z.string(), href: z.string().url() })).default([]),
  source: z.string().url().optional(),
  cover: z.string().optional(),
});

export type CaseStudy = z.infer<typeof caseStudySchema>;
```

**Step 4: Run the test again**

Run: `bunx vitest run src/lib/content.test.ts`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add typed content schema enforcing the em dash rule"
```

---

### Task 6: MDX loader

**Files:**
- Modify: `src/lib/content.ts`
- Create: `content/work/coachess.mdx`, `content/work/helmdeck.mdx`, `content/work/volt-tunisia.mdx`
- Test: `src/lib/content.test.ts`

**Step 1: Write the failing test**

Add a test asserting `getCaseStudies()` returns exactly three entries sorted by `order`,
and that every slug matches its filename.

**Step 2: Run and watch it fail**

Run: `bunx vitest run src/lib/content.test.ts`

**Step 3: Implement**

`getCaseStudies()` reads `content/work/*.mdx`, parses with `gray-matter`, validates each
through `caseStudySchema`, throws on the first invalid file naming the offending path, and
returns entries sorted by `order`.

Seed the three MDX files with real frontmatter and placeholder bodies marked
`<!-- PLACEHOLDER: narrative pending owner review -->`. Do not invent case study prose.
Per PRODUCT.md, CoaChess content must contain no internal repository names, no service
names, no infrastructure detail and no metrics.

**Step 4: Run the test again**

Expected: all pass.

**Step 5: Commit**

```bash
git add -A && git commit -m "Add MDX case study loader with three seeded entries"
```

---

### Task 7: Specification table

**Files:**
- Create: `src/components/SpecTable.tsx`
- Test: `tests/e2e/spec-table.spec.ts`

This is the signature component. It must use real table semantics, not divs.

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

**Step 3: Implement**

`<table>` with a visually hidden `<caption>`, `<th scope="row">` for labels in Archivo,
`<td>` values in Martian Mono, dividers in `--color-rule-strong`, row hover tint. No
borders in `--color-rule`, which fails the 3:1 non-text threshold and is decorative only.

**Step 4: Run the test again. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add specification table component"
```

---

### Task 8: Placeholder component

**Files:**
- Create: `src/components/Placeholder.tsx`
- Test: `tests/e2e/placeholder.spec.ts`

PRODUCT.md requires that missing assets ship as obviously provisional blocks.

**Step 1: Write the failing test**

Assert the placeholder renders its `label` as visible text, carries
`role="img"` with an `aria-label` naming what is missing, and is never mistakable for content.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** Ruled border in `--color-rule-strong`, Martian Mono caption reading
for example `PLACEHOLDER: headshot`, fixed aspect ratio passed as a prop so no layout shift
occurs when the real asset lands.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add labelled placeholder component"
```

---

## Phase 3: Pages

### Task 9: Homepage

**Files:**
- Modify: `src/app/page.tsx`
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
  const links = page.getByTestId('proof-link');
  await expect(links).toHaveCount(3);
});

test('no badge wall is present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stack-badge')).toHaveCount(0);
});
```

**Step 2: Run and watch them fail.**

**Step 3: Implement**

Drenched ultramarine hero, one display line at `font-stretch: 125%`, the three proof links
in Martian Mono beneath. Then the three pillars, then three capability statements in prose,
then contact. No card grid, no badges, no metrics.

**Step 4: Run the tests. Expected: 3 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add homepage with hero and proof strip"
```

---

### Task 10: Case study route

**Files:**
- Create: `src/app/work/[slug]/page.tsx`
- Test: `tests/e2e/work.spec.ts`

**Step 1: Write the failing test.** Assert all three slugs return 200 and render an `h1`,
and that an unknown slug returns 404.

**Step 2: Run and watch it fail.**

**Step 3: Implement** with `generateStaticParams` over `getCaseStudies()` and
`notFound()` for unknown slugs. Render the MDX body through `next-mdx-remote`, with the
specification table above the narrative.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add statically generated case study route"
```

---

### Task 11: About, contact, and writing

**Files:**
- Create: `src/app/about/page.tsx`, `src/app/contact/page.tsx`, `src/app/writing/page.tsx`
- Test: `tests/e2e/routes.spec.ts`

**Step 1: Write the failing test.** Every route returns 200 and has exactly one `h1`.
`/writing` with no posts renders an honest empty state and no fabricated entries.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** `/about` uses a `Placeholder` for the headshot and states only what
is known. Do not invent pre-2022 history; that content is pending from the owner.

**Step 4: Run the test. Expected: pass.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add about, contact and writing routes"
```

---

## Phase 4: Hardening and ship

### Task 12: Build-time proof link verification

**Files:**
- Create: `scripts/verify-links.mjs`
- Modify: `package.json`
- Test: `scripts/verify-links.test.mjs`

The site claims three products are live. If one goes down the site must not keep asserting it.

**Step 1: Write the failing test.** Assert the checker returns `ok: false` for a host that
cannot resolve, and `ok: true` for one returning 200, using a local server fixture rather
than the network.

**Step 2: Run and watch it fail.**

**Step 3: Implement.** Read the URLs from the case study frontmatter rather than a
duplicated list. Follow redirects, 10 second timeout, 2 retries. Print a table. Exit
non-zero only when a link is unreachable, so a transient failure does not silently ship.

**Step 4: Run against the real URLs**

Run: `node scripts/verify-links.mjs`
Expected: three rows, all 200.

Add `"verify:links"` to scripts and extend `prebuild` to
`npm run verify:contrast && npm run verify:links`.

**Step 5: Commit**

```bash
git add -A && git commit -m "Verify proof links at build time"
```

---

### Task 13: Contact form

**Files:**
- Create: `src/app/contact/actions.ts`
- Test: `src/app/contact/actions.test.ts`

**Step 1: Write the failing tests.** Cover all five states: valid submission, invalid email,
empty message, honeypot filled meaning silent success without sending, and Resend throwing
meaning a user-visible failure with retry.

**Step 2: Run and watch them fail.**

**Step 3: Implement** a server action with Zod validation, a honeypot field, and Resend.
The destination address is a placeholder constant until the owner supplies one. Do not use
any address discovered elsewhere.

**Step 4: Run the tests. Expected: 5 passed.**

**Step 5: Commit**

```bash
git add -A && git commit -m "Add contact form server action with full state coverage"
```

---

### Task 14: Error and not-found pages

**Files:**
- Create: `src/app/not-found.tsx`, `src/app/error.tsx`

Written in voice as a specification for a page that does not exist. Both link home.

**Verify:** `bun run build`, then visit `/does-not-exist` and confirm the custom page renders.

**Commit:** `git commit -m "Add 404 and error pages in voice"`

---

### Task 15: Metadata, share images, sitemap, RSS

**Files:**
- Create: `src/app/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/writing/feed.xml/route.ts`

Share images use `next/og` on the ultramarine ground with Archivo. Sitemap and robots
exclude `/dev`.

**Verify:** `bun run build`, then confirm `/sitemap.xml` omits `/dev` and
`/opengraph-image` renders.

**Commit:** `git commit -m "Add metadata, share images, sitemap and feed"`

---

### Task 16: Accessibility and performance audit

**Step 1:** Run `node scripts/contrast.mjs`. Expected: all pass.

**Step 2:** Run the full Playwright suite. Expected: all pass.

**Step 3:** Run `impeccable audit` against the built site. Budget: performance 95 or above,
accessibility 100.

**Step 4:** Fix findings, then re-run. Do not claim the budget is met without pasting the
actual numbers.

**Commit:** `git commit -m "Fix audit findings"`

---

### Task 17: Deploy

**Step 1:** Push to a new private GitHub repository.
**Step 2:** Import to Vercel, confirm the build passes there including both prebuild gates.
**Step 3:** Add `mehby.com` in Vercel and point the registrar's nameservers or A record. The
domain currently has no DNS records at all, so this is a first-time configuration.
**Step 4:** Verify `https://mehby.com` returns 200 and the certificate is valid.

---

## Owner-supplied, tracked as placeholders until delivered

| Asset | Blocks |
|---|---|
| Headshot | `/about` visual only |
| Helmdeck and VoltTunisia screenshots | case study covers only |
| Contact email | Task 13 destination |
| Pre-2022 history | `/about` timeline only |
| Case study narratives, owner-reviewed | Task 6 bodies |

None of these block Tasks 1 through 5, 7, 8, 12, 14 or 15.

## Standing rules, restated because they are easy to lose mid-implementation

No metrics. No people named except the owner. Nothing non-public about CoaChess, meaning no
internal repository names, service names, or infrastructure detail. No fixed stack list or
badge wall. No em dashes, enforced by the schema in Task 5. Placeholders never become
invented content.
