# Product

## Register

brand

## Users

Two audiences, weighted.

**Primary: prospective freelance clients.** Technical founders, CTOs, and product leads
evaluating whether to hire a contractor to build or rescue a web product. They arrive from a
shared link, a DM, or a search, on a laptop, mid-conversation, with maybe two minutes of
attention. They are scanning for one thing: evidence that this person actually ships working
software rather than talking about it.

**Secondary: engineers and peers.** Readers of the writing section, people evaluating the
open-source work, and recruiters. They read more slowly and care about how decisions were
made, not just what was built.

The job to be done: _decide, quickly and with confidence, whether to start a conversation._

## Product Purpose

A portfolio for Mohamed Elhedi Ben Yedder, CTO and co-founder of CoaChess, positioning him
for freelance full-stack product work.

Priority order, set by the owner:

1. Freelance and client leads
2. Personal brand and writing
3. Demonstration of technical craft
4. Employment

Success is a qualified inbound enquiry. Every structural decision resolves in favour of that
outcome when priorities conflict.

The strategic problem the site solves: the owner's substantial recent work is private. A
visitor who checks GitHub finds mostly 2020 and 2021 university projects, which badly
misrepresents current ability. The site therefore has to carry the proof itself, through live
links and architecture narrative, rather than delegating credibility to a public repository
list.

## Brand Personality

**Precise. Civic. Unhurried.**

The through-line in the owner's work is systems that encode rules faithfully: chess
federation pairing rules, national electricity tariff tiers and tax exemptions, an agent
communication protocol. The voice follows from that. It states what was built, under what
constraints, and what the decisions cost. It does not sell, exclaim, or hedge.

Emotionally the site should read as competence without performance. A visitor should come
away thinking "this person is careful" rather than "this person is impressive."

Copy is plain and declarative. No marketing verbs, no restated headings, no section
introductions that repeat the section title.

## Anti-references

- **The generic terminal.** Green-on-black, monospace for everything, ASCII art, a glow
  behind the hero, neon accents. This is the first-order reflex for this category and it
  is what the site must not be. The terminal direction here is structural, not costumed:
  a warm near-black ground, one warm orange, amber prompt glyphs, and Archivo carrying
  the statements, with mono earned by data rather than worn as a costume.
- **The vibecoded SaaS look.** Gradient mesh, glassmorphism, pill buttons, floating
  product mockups, a "trusted by" logo strip. Reads as a template, which is fatal for a
  site whose whole job is to prove real work.
- **The editorial-typographic brand page.** Display serif in italic, small tracked
  uppercase labels above every section, ruled three-column layouts, monochrome, no
  imagery. This is the second-order default, the trap for people with taste, and it is
  equally out.
- **The badge wall.** A grid of framework logos or skill chips presented as capability.
  Reads as a checklist rather than judgement.
- **The metric hero.** Enormous number, small label, three supporting stats.
- **Identical card grids.** Icon, heading, two lines of text, repeated.

## Design Principles

1. **Proof over claim.** Every assertion is anchored to something a visitor can click,
   verify, or read. A dead or stale link is worse than no link, so the live-links strip is
   checked at build time and re-checked at request time, and degrades honestly rather
   than lying.

2. **Session, not gallery.** The work is presented the way the work actually is:
   tabular, precise, annotated. Case studies read as specification documents with a
   specification table first, not as screenshots with captions.

3. **Judgement over inventory.** Capability is expressed through what was chosen and why,
   named in context inside case studies. Never as a fixed stack list, because the owner's
   stack is deliberately in motion.

4. **Discretion is a feature.** CoaChess is an operating startup. Nothing non-public is
   published, and the case study is written to be strong without disclosure. A client
   reading it should conclude that their own work would be handled with the same care.

5. **Honest scope.** Only real projects appear. Unfinished work is either described
   accurately or omitted, never padded into the appearance of a portfolio.

## Standing Rules

Non-negotiable constraints set by the owner. These override any later design or copy
instinct and must survive into future sessions.

- **No people but the owner.** No collaborators, colleagues, clients, coaches, or team
  members are named or depicted anywhere on the site. No team section, no acknowledgements,
  no testimonials.
- **No metrics.** No user counts, revenue, headcount, growth figures, or engagement
  numbers, including figures that are already public elsewhere. The owner has declined
  these explicitly.
- **Nothing non-public about CoaChess.** No internal repository names, service names,
  infrastructure detail, schema, or roadmap. The case study draws only on what the company
  already publishes on its own domains, plus the owner's role and a high-level architecture
  description.
- **No fixed stack list.** Capability is described in prose and in per-project tables.
  No badge wall, no logo grid, no skills bar.
- **No scaffold projects.** Repositories that are unmodified starter templates are excluded
  from the site in every form.
- **No em dashes** in any interface or content copy. Commas, colons, semicolons, periods,
  or parentheses instead. Not `--` either.
- **Placeholders for missing assets.** Where an asset has not been supplied, ship a labelled
  placeholder that is obviously a placeholder. Never invent content, never substitute stock
  imagery for a real product screenshot.

## Accessibility & Inclusion

- WCAG 2.2 AA minimum, verified rather than assumed. The ground pairs, text on bg and
  the structural edge-strong on bg, are contrast-checked before any component is built
  on them.
- `prefers-reduced-motion` disables all entrance and scroll motion. No parallax at any
  setting.
- Full keyboard operability with visible focus states that work on the warm near-black
  ground.
- Semantic landmarks and a logical heading order. The specification tables use real table
  semantics with proper headers, not divs.
- All imagery carries alt text written in the site's voice, describing what the image shows
  rather than naming the file.
- Site language is English. Logical CSS properties are used throughout regardless, since the
  owner builds RTL-first products elsewhere and the cost is zero.
