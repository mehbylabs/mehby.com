# Portfolio UI/UX Remediation Plan

> **For the implementer:** execute task by task, in order. Each task commits on
> its own. Phase 1 must land first: it changes rendered output that later
> phases assert against.

**Goal:** Fix a P0 rendering defect, unblock the conversion path, resolve three
places where the site contradicts its own PRODUCT.md and DESIGN.md, ship real
imagery, and close the hygiene backlog, without abandoning the terminal concept.

**Architecture:** Five sequenced phases, each independently shippable. Every
task is test first. The P0 shipped precisely because no test covered that class
of defect, so the first task of the plan is the guard that would have caught it.

**Tech stack:** TanStack Start, React 19, Tailwind v4 `@theme`, vitest,
Playwright with axe-core.

---

## Where this came from

A two-assessment critique run on 2026-09-17: an independent design review and a
deterministic detector pass (`impeccable@4.1.0` plus a 21 check ripgrep scan).

Design health score at the time of writing: **24/40**, "acceptable, significant
improvements needed".

The deterministic scan came back clean on every classic anti-pattern: no
gradient text, no side stripe borders, no `transition: all`, no layout property
animation, no reflex fonts, no hardcoded hex in components, no em dashes. The
findings below are not about slop. They are about a design system that
documents more intent than it implements.

### Decisions taken

1. **CTA hierarchy.** Hero keeps "See the work" as the single orange fill,
   because exploration is the correct first action for a two minute scan.
   "Start a conversation" sits beside it as an outline. The nav CTA drops to
   outline so exactly one orange fill exists above the fold. "Hire me" is
   retired everywhere: the site already owns the better phrase, and "Hire me"
   presumes a decision the visitor has not made.
2. **`.section-path` survives as page identity only.** The terminal concept
   stays. The path appears where it is a real address, and is dropped from the
   home page's interior sections where it was decoration.
3. **Diagrams are drafted from the existing MDX narratives.** Nothing
   non-public is disclosed.
4. **`/writing` leaves the primary nav** until something is published, and
   stays reachable from the footer.

---

## Phase 1: Correctness

### Task 1.1: Guard against undefined site classes

**Files:** create `src/lib/class-registry.test.ts`

Scan `src/routes/**` and `src/components/*.tsx` for `className="..."` string
literals. Exclude `src/components/ui/**`, which is pure Tailwind. Drop tokens
containing `:`, `[`, `]`, `/`, or `&`, which are Tailwind variants and
arbitrary values. Assert every remaining token is either defined as a selector
in `src/styles.css` or listed in a small explicit Tailwind allowlist.

Expected first run: FAIL, naming `hero-actions`, `page-actions`, `tcard-chip`,
`proof-list`, `note-label`, `contact-form`.

### Task 1.2: Define the action rows

**Files:** modify `src/styles.css`

`.hero-actions` is referenced at `Hero.tsx:57` and defined nowhere. Both
children are `inline-flex shrink-0`, and JSX strips the newline between them,
so the built HTML reads `</a><a data-slot="button"` with zero characters
between. Two 40px buttons, one solid orange and one outlined, touching at 0px,
in the first screen. `.page-actions` has the same defect on the 404 and 500
pages.

### Task 1.3: Retire the remaining phantoms

**Files:** modify `src/styles.css`, `src/components/ProofStrip.tsx`,
`src/routes/contact.tsx`, `src/routes/about.tsx`

Move the 14 inline declarations at `ProofStrip.tsx:92-104` into a real
`.tcard-chip` rule. Same for `.proof-list` and `.contact-form`. Define or
delete `.note-label`.

### Task 1.4: `.page-centered`

**Files:** modify `src/styles.css`, `src/routes/__root.tsx`,
`src/routes/work/$slug.tsx`

The `minHeight: 65vh` plus centered flex column block is copy pasted
identically three times.

### Task 1.5: Playwright regression for the fused buttons

**Files:** modify `tests/e2e/home.spec.ts`

Assert the two hero buttons have a horizontal gap of at least 8px between their
bounding boxes. This is the assertion that catches the bug at the layer a user
experiences it, rather than at the layer the class registry checks.

---

## Phase 2: Conversion path

The site's one job is a qualified inbound enquiry inside a two minute scan.
Every task here serves that.

### Task 2.1: ProofStrip honesty and announcement

**Files:** modify `src/components/ProofStrip.tsx`

Three defects in one component. The list has no live region, so a screen
reader user hears "checking" once per surface and never learns any result. The
label asserts "checked just now" into prerendered HTML above chips that have
checked nothing. The `.catch` leaves every chip in `checking` permanently, so
a failure is indistinguishable from a hang.

Add `aria-live="polite"`, derive the label from state, add a distinct
`unreachable` state in muted (not red, which is reserved for live status), and
drop the HTTP status from the chip label.

### Task 2.2: Pull the proof above the fold

**Files:** modify `src/components/ProofStrip.tsx`, `src/styles.css`

The strip borrows `className="section"`, inheriting up to 96px of
`padding-block` inside a parent that already carries the same token. Computed
from the tokens, the chips start around 830px at 1440px wide. A 13 inch laptop
has roughly 745px usable, so the element carrying the entire credibility
argument is off the first screen.

### Task 2.3: One orange fill per viewport

**Files:** modify `src/components/Hero.tsx`, `src/routes/__root.tsx`

### Task 2.4: The home contact section becomes a real action

**Files:** modify `src/routes/index.tsx`

A visitor who scrolls the home page to its end currently gets a 20px underlined
`mailto:` and never learns the form exists.

### Task 2.5: Promote the contact success state

**Files:** modify `src/routes/contact.tsx`, `src/styles.css`

A successful send is confirmed only by `.form-status` at 13px in the lowest
contrast text colour on the site, above a form that just emptied itself, with
focus left on the Send button.

### Task 2.6: Proof links stop being exit doors

**Files:** modify `src/components/ProofStrip.tsx`, `src/components/SpecTable.tsx`

### Task 2.7: Focus not obscured, WCAG 2.2 SC 2.4.11

**Files:** modify `src/styles.css`, `tests/e2e/a11y.spec.ts`

The sticky nav is 45px at `z-index: 40` and nothing sets `scroll-padding-top`.
`a11y.spec.ts` already notes that the `wcag22aa` tag selects exactly one axe
rule, so axe cannot see this.

### Task 2.8: Skip link

**Files:** modify `src/routes/__root.tsx`, `src/styles.css`

Four tab stops before content on every page. WCAG 2.4.1.

### Task 2.9: The featured case study

**Files:** modify `src/lib/content.ts`, `content/work/coachess.mdx`,
`src/routes/index.tsx`, `src/styles.css`

At 1440px the grid resolves to three columns, card 0 spans all three, cards 1
and 2 fill two, and column 3 is empty. Nothing about card 0 changes except
width, so the flagship reads as a stretched card. Drive the treatment from a
frontmatter field, pull the featured study out of the grid, and give it a
genuinely different shape.

---

## Phase 3: Identity contradictions

### Task 3.1: The green prompt

**Files:** modify `src/styles.css`, create an assertion

PRODUCT.md names green on black as anti-reference number one. DESIGN.md says
green is reserved for live status and used nowhere else. `.prompt-user` is
green and ships in the hero, the footer on every page, `/about`, and both error
pages. It is the first coloured pixel a visitor sees.

### Task 3.2: Real spacing rhythm

**Files:** modify `src/styles.css` and the four `paddingTop: 0` call sites

DESIGN.md: "Uniform padding everywhere is the failure mode." One
`padding-block` token is applied to every section on every page, with four
inline overrides as the only variation. There is no spacing token namespace,
which is why 29 inline rem literals exist across 10 files.

### Task 3.3: The type scale

**Files:** modify `src/styles.css`, `DESIGN.md`

DESIGN.md claims ratio 1.333. Actual: fine to data 1.15, data to body 1.13,
body to h3 1.18. The honest reading is that fine, data, and body are parallel
registers rather than hierarchy steps, so forcing 1.25 between them would be
wrong. The real defect is body to h3, where h3 is a heading, and it shows up
as a 3px difference between `.tcard-title` and `.tcard-summary` on the most
scannable evidence on the site.

### Task 3.4: Stop `.section-path` being scaffolding

**Files:** modify the five route files that render it

PRODUCT.md bans small tracked labels above every section. The path is above
every single section heading, nine occurrences, no exceptions.

### Task 3.5: `# coachess/`

**Files:** modify `src/routes/index.tsx`

In every shell `#` is a comment marker or a root prompt, not a path component.

---

## Phase 4: Imagery

### Task 4.1: The dead `cover` field

**Files:** modify `src/lib/content.ts`, both MDX files that set it

`cover` is in the schema, set in two frontmatter files, read by nothing, and
the files it points at do not exist.

### Task 4.2: Architecture diagrams

**Files:** create `src/components/diagrams/`, modify `src/routes/work/$slug.tsx`

The site sells product engineering and ships zero pixels of any product. The
largest element on every case study is a dashed box labelled PLACEHOLDER.
Screenshots need the owner. Diagrams do not: the MDX already describes a five
surface shared identity system, a protocol isolation layer, and a four tier
progressive tariff computation.

---

## Phase 5: Hygiene

| Task | Change |
| --- | --- |
| 5.1 | Delete four unused shadcn primitives. They keep `.uppercase`, `.italic`, and `.animate-pulse` in the shipped CSS, all three banned by DESIGN.md |
| 5.2 | Remove six dead tokens and the two `text-white` literals, the only untokenised colour in the codebase and invisible to the contrast gate |
| 5.3 | `contrast.mjs` duplicates the token values with nothing keeping them in sync, while its header calls it the single source of truth. Parse them from `styles.css` |
| 5.4 | `content.test.ts` flakes at the default 5000ms timeout and passes in 1.2s isolated |
| 5.5 | Add 360px to the responsive matrix |
| 5.6 | The four surfaces are four subdomains of one company, while two case studies declare none. The strip shows breadth it lacks |
| 5.7 | `/writing` is a third of the primary nav and contains one sentence saying nothing is there |
| 5.8 | Success is defined as a qualified enquiry and nothing in the interface qualifies |
| 5.9 | No route transition pending state |

---

## Verification

After every phase: `bun run test`.
After the final phase: `bun run test`, `bun run verify:contrast`, `bun run lint`,
`bun run check`, and `bun run test:e2e`.
