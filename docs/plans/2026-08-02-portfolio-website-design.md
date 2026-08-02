# Portfolio website design: mehby.com

Date: 2026-08-02
Status: approved, implementation pending
Owner: Mohamed Elhedi Ben Yedder

## Problem

The owner is a full stack product engineer and the CTO and co-founder of CoaChess, seeking
freelance client work. His credibility problem is specific and measurable rather than vague.

An audit of 65 GitHub repositories across his personal account and three organisations found
that every substantial recent project is private. What remains public is largely 2020 and
2021 university coursework in Java and Spring, machine learning notebooks, and forks. A
prospective client who checks GitHub forms an impression that is roughly five years out of
date.

He also declines to publish usage metrics, and CoaChess is an operating startup whose
internals cannot be disclosed. So the two conventional sources of portfolio credibility,
public source code and business numbers, are both unavailable.

The site therefore has to carry proof by itself.

## What the site is

A five route brand register site whose purpose is to convert a two minute skim into a
qualified enquiry.

```
/                  single scroll pitch
/work/[slug]       three case studies
/writing           MDX index
/writing/[slug]    posts
/about             bio and timeline
/contact           form and direct email
```

## Decisions and rationale

### Positioning

Full stack product engineer, with CTO and co-founder of CoaChess as the credential in the
hero. Chosen over "AI engineer", "frontend engineer", and "MVP builder" because it is both
accurate and the widest net that his evidence actually supports.

### Three pillars, not one

The owner explicitly asked that the site not be dominated by CoaChess. Investigation showed
this was achievable but tighter than the folder count suggested. Of twelve side projects,
five are unmodified starter templates whose READMEs still read "Welcome to your new TanStack
Start app". Two are real.

| Pillar | Project     | Demonstrates                                                                                                                                  |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | VoltTunisia | Consumer product with hard domain logic: four tier electricity tariffs, EV VAT exemption, Arabic first RTL, spec driven with end to end tests |
| 2      | Helmdeck    | Developer tooling and AI infrastructure: agent client protocol, local first, Apache 2.0 monorepo                                              |
| 3      | CoaChess    | Multi year platform engineering, three product surfaces, self hosted real time video with recording                                           |

The scaffold projects are excluded entirely. Listing them would invite a click that reveals
a template, which would retroactively discredit everything else on the page.

### Stack: Next.js

Chosen over TanStack Start and Astro. The first rationale offered was wrong and was
corrected: the owner's daily driver is TanStack Start, not Next.js. The argument that
survives is that this is a static content site whose job is search visibility and instant
loads, and Next.js supplies MDX, static generation, share image generation, sitemap and RSS
as conventions rather than as plumbing to hand write.

The owner subsequently confirmed his own view that Next.js suits landing and SEO surfaces
while TanStack Start suits application surfaces, which is the same conclusion.

### Design direction: Specification

Documented in full in `DESIGN.md`. In summary: warm paper ground, committed ultramarine
carrying 30 to 50 percent of surface area, Archivo and Martian Mono, strict drawn grid,
light theme.

The direction was chosen by first naming and rejecting the two reflex answers for this
category. The dark terminal developer portfolio is the first order default. The editorial
serif brand page is the second order default, the one careful taste lands on. The
Specification lane instead derives from the actual through line in the owner's work: chess
federation pairing rules, national tariff tiers and tax exemptions, an agent protocol. He
builds systems that encode rules faithfully, so the site is shaped like a specification.

### Constraints that shape the content

Four owner constraints, recorded as standing rules in `PRODUCT.md`:

1. No metrics, including figures already public on coachess.net.
2. No people named or depicted except the owner.
3. Nothing non-public about CoaChess. No internal repository or service names, no
   infrastructure detail.
4. Missing assets ship as labelled placeholders, never as invented substitutes.

Constraint 3 is the sharpest. It means the CoaChess case study is written from what the
company already publishes on its own domains, plus the owner's role and a high level
architecture description. Handled well this is an asset rather than a limitation: a client
reading a discreet case study concludes their own work would be treated the same way.

## Case study approach

Without metrics or public source, case studies run on architecture and judgement. The
template is: problem, constraints, architecture, the decisions and what they cost, outcome,
and a specification table of metadata.

Verbs are precise about contribution. Work the owner led is described as led or architected.
Nothing implies sole authorship of team output, because a client who later discovers such a
gap discounts everything else on the site.

CoaChess history is handled in two sentences. The platform began as a Spring microservice
estate and was consolidated into a TypeScript and Python architecture. This earns credit for
migration judgement without advertising Java, which would attract the wrong inbound given
the owner's current React, TypeScript, Python and FastAPI focus.

Capability is never presented as a fixed stack list. The owner's stack is deliberately in
motion, and a badge wall would misrepresent it as a checklist.

## Proof strategy

Three live URLs, verified at build time: the CoaChess marketing site, the learning
application, and the live classroom. Earlier candidates were dropped, either because the
owner scoped them out or because they no longer resolve. Three current links are stronger
than five where two are stale, and the build check means the site cannot silently start
lying when a deployment moves.

## Risks

**The writing is the real work.** Three case studies is roughly 2,500 words that only the
owner can validate. Drafts can be generated from the code, but factual correction is not
delegable.

**Without metrics or testimonials the site persuades engineers more than non technical
buyers.** Accepted knowingly. Mitigation is that architecture narrative and three live
products are themselves legible to a semi technical founder.

**Helmdeck is currently unpublished.** It is Apache 2.0 with full architecture documentation
and no git remote. Publishing it is the single highest leverage action available, because it
is the only case study that can link to real source and it replaces the stale first
impression on the owner's GitHub profile. It requires a secret scan before push.

## Outstanding, supplied by owner

Headshot. Helmdeck and VoltTunisia screenshots. Contact email. LinkedIn history for pre 2022
roles and education, which could not be retrieved programmatically because LinkedIn returns
HTTP 999 to every unauthenticated client. Decision on whether to redeploy the VoltTunisia
demo, currently returning 404.

All ship as labelled placeholders until supplied. None block the first three phases of
implementation.
