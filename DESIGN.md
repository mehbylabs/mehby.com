# Design

## Visual Theme

**Terminal session.** The site reads as a working terminal session: a prompt, real
commands, honest status. Warm near-black ground, one loud orange, amber prompt glyphs,
green and red reserved for live status. Martian Mono carries the terminal voice:
prompts, paths, metadata, data. Archivo carries the statements and the prose.

The theme is **dark and warm**, decided by a scene sentence rather than by category
convention: a prospective client in Tunis opens the link on a laptop in the evening,
mid-conversation, skimming for evidence. The ground is warm near-black, never pure
black, so the page reads as a session rather than as the generic terminal cliche.

This is a deliberate rejection of two defaults. The generic terminal (green-on-black,
monospace for everything, ASCII art, a glow behind the hero) is the first order reflex
for the category. The light editorial-typographic brand page is the second order
reflex. Neither is used here.

## Color

**Strategy: One ground, one accent.** A single warm near-black ground carries the whole
site; the accent is one loud orange, used as a fill and as a display accent. Amber marks
prompt glyphs and small highlights. Green and red are reserved for live status checks
and used nowhere else.

All values are OKLCH. No pure black, no pure white. Every neutral is tinted warm toward
hue 70.

| Token         | OKLCH                 | Hex       | Role                                          |
| ------------- | --------------------- | --------- | --------------------------------------------- |
| `--bg`        | `oklch(0.145 0.01 70)`| `#0d0906` | Ground, the whole document                    |
| `--panel`     | `oklch(0.185 0.012 70)`| `#16120d` | Cards, placeholders, chip fills               |
| `--panel-lift`| `oklch(0.225 0.014 70)`| `#201b15` | Hover grounds, shadcn secondary               |
| `--text`      | `oklch(0.93 0.012 75)` | `#ede7df` | Body and headings on ground                   |
| `--muted`     | `oklch(0.64 0.02 72)`  | `#948a7f` | Metadata, log lines, secondary copy           |
| `--orange`    | `oklch(0.66 0.2 45)`   | `#f05d00` | The one accent: fills, links, display type    |
| `--amber`     | `oklch(0.85 0.13 85)`  | `#f5c761` | Prompt glyphs, path codes, small highlights   |
| `--green`     | `oklch(0.75 0.16 150)` | `#55c975` | Live status only                              |
| `--red`       | `oklch(0.6 0.2 25)`    | `#de3b3d` | Offline status only                           |
| `--edge`      | `oklch(0.35 0.015 70)` | `#403932` | Decorative rules, row dividers                |
| `--edge-strong`| `oklch(0.52 0.02 70)` | `#71675d` | Structural borders, focus boundaries          |

### Colour rules

The gate in `scripts/contrast.mjs` is the single source of truth, and `bun run build`
refuses to build if any measured pair drops below its WCAG threshold. The rules the gate
enforces, stated so nobody has to rediscover them from the numbers:

- **Orange is a fill and a display accent, never body-size text on bg.** Text on orange
  measures 2.73; button labels on orange are always `bg`, which measures 5.90.
- **Green and red only for live status.** The proof strip earns green with a live
  response and red with a dead one, and neither is used anywhere else. Form errors are
  amber, not red.
- **Amber for prompt glyphs and small highlights.** The `$`, the path codes, the
  timeline periods, the `PLACEHOLDER` labels.
- **`edge` is decorative.** It measures 1.75 on bg, which is why structural borders use
  `edge-strong`. A border a user must perceive to understand the layout is structural.

### Verified contrast

Measured, not estimated. WCAG 2.2, body text threshold 4.5, large text and non text
threshold 3.0.

| Pair                    | Ratio | Verdict                         |
| ----------------------- | ----- | ------------------------------- |
| text on bg              | 16.10 | PASS body                       |
| muted on bg             | 5.87  | PASS body                       |
| text on panel           | 15.17 | PASS body                       |
| muted on panel          | 5.53  | PASS body                       |
| amber on bg             | 12.45 | PASS body                       |
| green on bg             | 9.47  | PASS body                       |
| red on bg               | 4.54  | PASS body                       |
| bg on orange            | 5.90  | PASS body (button label)        |
| orange on bg            | 5.90  | PASS large / non-text (display) |
| orange on panel         | 5.56  | PASS non-text                   |
| edge-strong on bg       | 3.58  | PASS non-text                   |
| edge-strong on panel    | 3.38  | PASS non-text                   |
| edge on bg              | 1.75  | Decorative only, never structural |

Any new colour pair must be measured before use. The verification script lives in
`scripts/contrast.mjs`.

## Typography

Two families, each with one job.

- **Archivo** (Omnibus Type) for statements: headings, prose, button labels. Sturdy
  grotesque with signage lineage. The **Expanded** cut carries display sizes.
- **Martian Mono** strictly for data: prompts, paths, periods, table cells, link URLs,
  captions. Never for body copy, never as decoration. Monospace here is earned by the
  session's own register, not worn as a technical costume.

Both self hosted. The `.woff2` files live in `public/fonts/`, the faces are declared by
hand in `src/styles.css`, and both are preloaded from the server-rendered HTML. Nothing
is fetched from a third party, which is a privacy obligation and not only a performance
preference.

Reference the families as `Archivo` and `Martian Mono`. The fontsource package default
names carry a `Variable` suffix; using those names silently falls back.

No display serif anywhere. No italic display. No all caps body.

### Scale

Modular, ratio 1.333, fluid via `clamp()`.

| Step    | Size                            | Use                              |
| ------- | ------------------------------- | -------------------------------- |
| display | `clamp(2.6rem, 7vw, 5.8rem)`    | Hero statement, one line, Archivo Expanded |
| h1      | `clamp(2.1rem, 4.2vw, 3.4rem)`  | Page titles                      |
| h2      | `clamp(1.6rem, 2.6vw, 2.3rem)`  | Section heads                    |
| h3      | `1.25rem`                       | Subsections, card titles         |
| body    | `1.0625rem`                     | Reading copy                     |
| data    | `0.9375rem`                     | Martian Mono, tabular figures    |
| fine    | `0.8125rem`                     | Captions, paths, table meta      |

Body measure capped at 68ch.

**Leading is a token, not an afterthought.** The `--text-*` tokens set font size only, so
everything would otherwise inherit the body value of 1.65. At `--text-display`, which
reaches 5.8rem, that produces a 9.6rem line box and the hero falls apart.

| Token                | Value | Applies to                          |
| -------------------- | ----- | ----------------------------------- |
| `--leading-display`  | 1.02  | `--text-display`                    |
| `--leading-h1`       | 1.08  | `--text-h1`                         |
| `--leading-h2`       | 1.2   | `--text-h2`, `--text-h3`            |
| `--leading-body`     | 1.65  | Reading copy                        |

Hierarchy comes from scale and weight contrast, not from colour or from repeated small
tracked labels above every heading.

## Layout

Everything hangs off one left margin. The container is the **shell**: a single column,
width-capped, with the site's inset padding. Every section is a **section** with the
same generous vertical rhythm, and content within is one of three shapes:

- **Section headers are paths.** A mono prefix in amber (`~/work`) with an Archivo
  statement beside it. The path is the terminal's address for the content; the statement
  is the heading.
- **`tcard`** for open files: a panel card with a mono path line, a title, meta, a
  summary, and an orange action line. The work index is a set of open files.
- **Capability rows** for statements about the owner: a mono index in amber with prose
  on the right, divided by a decorative rule.

The grid ladder the previous design drew is gone. The layout is one fluid column that
steps to 12 columns on wide screens for the case study layout only; nothing on the site
is measured against a painted grid.

Spacing varies deliberately for rhythm: tight inside tabular blocks, generous between
sections. Uniform padding everywhere is the failure mode.

Content is left aligned. Nothing is centred.

## Components

**Prompt.** The session's opening line: `mehby@dev:~$`, a command, and a block cursor
that blinks. The cursor's animation is the terminal's own; under reduced motion it
collapses to a static block, which is the correct state.

**Status chip.** A dot plus a mono label. Green is earned by a live response, red by a
dead one, and the checking state is muted. Green and red appear nowhere else.

**Specification table.** The signature element and the primary way work is presented.
Real `<table>` semantics on the shadcn Table primitive, with `<th scope>` and a visually
hidden `<caption>`. A structural `edge-strong` rule across the top, decorative `edge`
rules between rows, Martian Mono in data cells, Archivo in header cells. Used for case
study metadata: role, period, surfaces, source, stack.

**Placeholder.** A labelled, obviously provisional block for assets not yet supplied.
Dashed `edge-strong` border, Martian Mono caption naming what belongs there. It must
never be mistakable for a finished element.

**Prose.** The MDX narrative: a capped measure, Archivo body, and section headings that
echo the site's hierarchy.

### Banned

Cards as the default container. Nested cards, always. Icon plus heading plus two lines,
repeated. Badge or logo walls. Side stripe accent borders. Gradient text. Decorative
glassmorphism (the nav's backdrop blur is functional, not decorative). Big number metric
heroes. Modals.

## Motion

Restrained by design, because the terminal voice is undermined by flourish.

Three motions, each one the thing it is:

- **Cursor blink.** The block cursor in a prompt, at a terminal's rate, step-end.
- **Status pulse.** A live status dot rings at its edge; the pulse reads as "still
  checking, still alive".
- **Hover lifts.** A `tcard` lifts two pixels and its border goes orange; a link's colour
  shifts. Hover states are colour and transform only.

Transform, opacity and colour only. Layout properties are never animated. No parallax at
any setting, no scroll jacking, no counting numbers.

`prefers-reduced-motion: reduce` collapses every animation and transition to an instant
state change.

## Imagery

Product screenshots and generated architecture diagrams are the imagery. No stock
photography anywhere.

Diagrams are exported from the owner's existing Pencil source files. Screenshots are real
captures of shipping interfaces. Every image reserves explicit dimensions so nothing shifts
on load, and alt text is written in the site's voice, describing what is shown rather than
naming a file.

Assets not yet supplied ship as placeholders, never as invented substitutes.
