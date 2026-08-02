# Design

## Visual Theme

**Specification.** The site presents engineering work as a technical specification document:
warm paper ground, drawn rules, tabular data, precise figures. Reference objects are Braun
and Vitsoe product datasheets, SBB timetable typography, and a utility bill tariff table.

The theme is **light**, decided by a scene sentence rather than by category convention: a
prospective client in Tunis opens the link on a laptop in a bright cafe at 11am, mid
conversation, skimming for evidence. Bright ambient light, short attention, reading mode.

This is a deliberate rejection of two defaults. The dark terminal developer portfolio is the
first order reflex for this category. The editorial serif brand page is the second order
reflex. Neither is used here. Light also lets the product screenshots, which are themselves
light interfaces, sit naturally instead of floating in a dark void.

## Color

**Strategy: Committed.** One saturated colour carries 30 to 50 percent of surface area
through full bleed section fields, not a trim accent. The hero is fully drenched. Paper
grounds carry reading passages. There is no hedging band of neutral between them.

All values are OKLCH. No pure black, no pure white. Every neutral is tinted warm toward
hue 85.

| Token                | OKLCH                  | Hex       | Role                                                 |
| -------------------- | ---------------------- | --------- | ---------------------------------------------------- |
| `--paper`            | `oklch(0.97 0.008 85)` | `#f8f5ef` | Primary ground                                       |
| `--ink`              | `oklch(0.22 0.02 265)` | `#161b24` | Body and headings on paper                           |
| `--ultramarine`      | `oklch(0.52 0.19 264)` | `#2d5ed4` | Hero drench, section fields, links                   |
| `--ultramarine-deep` | `oklch(0.34 0.15 264)` | `#0c2d84` | Hover, pressed, dense text grounds                   |
| `--rule`             | `oklch(0.88 0.01 85)`  | `#dad7d0` | Decorative hairlines, grid lines                     |
| `--rule-strong`      | `oklch(0.62 0.012 85)` | `#89867e` | Structural borders and table dividers, on paper      |
| `--signal`           | `oklch(0.56 0.16 45)`  | `#bd4d00` | Live indicators on paper, under 3 percent of surface |
| `--rule-on-color`    | `oklch(0.82 0.05 264)` | `#b4c5e5` | Structural borders on ultramarine grounds            |
| `--signal-on-color`  | `oklch(0.85 0.13 70)`  | `#ffbe69` | Live indicator dots on ultramarine grounds           |

### Every role needs two values

The ultramarine ground covers 30 to 50 percent of the site by design, so a token
validated only against paper is validated against half the site. Measured against
ultramarine, `signal` is 1.15 and `rule-strong` is 1.57. Both are unusable there, which is
why the on-colour variants above exist.

The focus ring follows the same rule and is the sharpest case. On paper it is
`--ultramarine` at 5.26. On an ultramarine ground it **must** invert to `--paper`, because
an ultramarine ring on an ultramarine field measures 1.00 and is literally invisible.
Keyboard users would lose focus entirely across half the site.

`--signal-on-color` reaches 3.50 against ultramarine, which clears the non-text threshold
but not the 4.5 body-text one. No usable lightness of a warm hue does. So on colour
grounds the indicator **dot** carries the signal and its **label** is set in `--paper`.

**Inheritance hazard.** The base layer sets `color: var(--color-ink)` on `body`. A section
that sets only `background: var(--color-ultramarine)` therefore inherits ink at 3.02, which
fails body text. Every ultramarine field must set its text colour explicitly. This is not
optional styling; it is the difference between passing and failing.

### Verified contrast

Measured, not estimated. WCAG 2.2, body text threshold 4.5, large text and non text
threshold 3.0.

| Pair                           | Ratio | Verdict                                              |
| ------------------------------ | ----- | ---------------------------------------------------- |
| ink on paper                   | 15.88 | PASS body                                            |
| paper on ultramarine           | 5.26  | PASS body                                            |
| ultramarine on paper           | 5.26  | PASS body                                            |
| paper on ultramarine-deep      | 11.18 | PASS body                                            |
| ultramarine-deep on paper      | 11.18 | PASS body                                            |
| signal on paper                | 4.56  | PASS body                                            |
| ink on rule                    | 12.07 | PASS body                                            |
| rule-strong on paper           | 3.34  | PASS non text                                        |
| rule-on-color on ultramarine   | 3.28  | PASS non text                                        |
| signal-on-color on ultramarine | 3.50  | PASS non text                                        |
| rule on paper                  | 1.32  | Decorative only, never a border that carries meaning |

Measured and deliberately excluded, recorded so nobody reintroduces them:

| Pair                                  | Ratio | Why it is banned                                       |
| ------------------------------------- | ----- | ------------------------------------------------------ |
| ultramarine focus ring on ultramarine | 1.00  | Invisible. Invert to paper on colour grounds           |
| signal on ultramarine                 | 1.15  | Use `--signal-on-color`                                |
| rule-strong on ultramarine            | 1.57  | Use `--rule-on-color`                                  |
| ink on ultramarine                    | 3.02  | Fails body text. Set text explicitly on colour grounds |

Because paper on ultramarine clears 4.5, body copy is permitted directly on the drenched
hero. No lightening of the brand colour is required anywhere.

Any new colour pair must be measured before use. The verification script lives in
`scripts/contrast.mjs`.

## Typography

Two families. Neither appears on the reflex reject list.

- **Archivo** (Omnibus Type) for all structural type. Sturdy grotesque with signage lineage
  and true tabular figures. The **Expanded** cut carries display sizes.
- **Martian Mono** strictly for data: figures, periods, versions, table cells, link URLs.
  Never for body copy, never as decoration. Monospace here is earned by the tabular content,
  not worn as a technical costume.

Both self hosted. The `.woff2` files live in `public/fonts/`, the faces are declared by hand
in `src/styles.css`, and both are preloaded from the server-rendered HTML. Nothing is
fetched from a third party, which is a privacy obligation and not only a performance
preference.

Reference the families as `Archivo` and `Martian Mono`. The fontsource package default
names carry a `Variable` suffix; using those names silently falls back.

No display serif anywhere. No italic display. No all caps body.

### Scale

Modular, ratio 1.333, fluid via `clamp()`.

| Step    | Size                             | Use                              |
| ------- | -------------------------------- | -------------------------------- |
| display | `clamp(3rem, 9vw, 7.5rem)`       | Hero, one line, Archivo Expanded |
| h1      | `clamp(2.25rem, 4.5vw, 3.75rem)` | Page titles                      |
| h2      | `clamp(1.75rem, 2.8vw, 2.5rem)`  | Section heads                    |
| h3      | `1.333rem`                       | Subsections                      |
| body    | `1.0625rem`                      | Reading copy                     |
| data    | `0.9375rem`                      | Martian Mono, tabular figures    |
| fine    | `0.8125rem`                      | Captions, table meta             |

Body measure capped at 68ch.

**Leading is a token, not an afterthought.** The `--text-*` tokens set font size only, so
everything would otherwise inherit the body value of 1.6. At `--text-display`, which reaches
7.5rem, that produces a 12rem line box and the hero falls apart.

| Token                | Value | Applies to                          |
| -------------------- | ----- | ----------------------------------- |
| `--leading-display`  | 0.95  | `--text-display`                    |
| `--leading-h1`       | 1.05  | `--text-h1`                         |
| `--leading-h2`       | 1.15  | `--text-h2`, `--text-h3`            |
| `--leading-body`     | 1.6   | Reading copy on paper               |
| `--leading-on-color` | 1.68  | Reading copy on ultramarine grounds |

Light type on colour reads lighter and needs more air, which is why the on-colour value is
higher.

Hierarchy comes from scale and weight contrast, not from colour or from repeated small
tracked labels above every heading.

## Layout

A **strict, visible grid as voice.** Twelve columns, gutters drawn as real hairlines rather
than implied by whitespace. Confident structure, not asymmetric collage, and never the
generic centred stack that splits the difference between the two.

Sections alternate between paper and full bleed ultramarine fields. That alternation is
what produces the 30 to 50 percent colour commitment structurally, so it cannot quietly
erode during implementation.

Spacing varies deliberately for rhythm: tight inside tabular blocks, generous between
sections. Uniform padding everywhere is the failure mode.

Content is left aligned. Nothing is centred except the hero display line.

## Components

**Specification table.** The signature element and the primary way work is presented. Real
`<table>` semantics with `<th scope>`, `rule-strong` dividers, Martian Mono in data cells,
Archivo in header cells. Rows tint on hover. Used for case study metadata: role, period,
surfaces, architecture, links.

**Live links strip.** Three verified URLs in Martian Mono under the hero. Checked at build
time. A URL that does not resolve renders dimmed with an explicit note rather than being
presented as live.

**Section field.** Full bleed ultramarine band with paper type. Carries its own internal
grid so rules stay continuous across the colour change.

**Placeholder.** A labelled, obviously provisional block for assets not yet supplied. Ruled
border in `rule-strong`, Martian Mono caption naming what belongs there. It must never be
mistakable for a finished element.

### Banned

Cards as the default container. Nested cards, always. Icon plus heading plus two lines,
repeated. Badge or logo walls. Side stripe accent borders. Gradient text. Decorative
glassmorphism. Big number metric heroes. Modals.

## Motion

Restrained by design, because the Specification voice is undermined by flourish.

One orchestrated hero reveal on first load, staggered, roughly 600ms total, ease out expo.
After that: link underlines thicken, table rows tint, focus rings appear. Nothing else.

Transform and opacity only. Layout properties are never animated. Expanding regions
transition `grid-template-rows`. No parallax at any setting, no scroll jacking, no counting
numbers.

`prefers-reduced-motion: reduce` disables the entrance sequence entirely and every
transition falls back to an instant state change.

## Imagery

Product screenshots and generated architecture diagrams are the imagery. No stock
photography anywhere.

Diagrams are exported from the owner's existing Pencil source files. Screenshots are real
captures of shipping interfaces. Every image reserves explicit dimensions so nothing shifts
on load, and alt text is written in the site's voice, describing what is shown rather than
naming a file.

Assets not yet supplied ship as placeholders, never as invented substitutes.
