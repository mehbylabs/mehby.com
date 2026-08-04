# Deploying mehby.com

Vercel, via Nitro's `vercel` preset. Everything below has been run except the parts that need
a Vercel account or control of the domain; those are marked **unverified from here** so you
know which steps have been rehearsed and which have not.

---

## 1. Prerequisites

**Bun.** `bun install`. Vercel detects `bun.lock` and uses Bun to install by itself.

**Two environment variables**, both read on the server only, neither prefixed `VITE_` and
neither ever to be. `.env.example` has the same list with longer notes.

| Variable         | Required  | What breaks without it                                  |
| ---------------- | --------- | ------------------------------------------------------- |
| `RESEND_API_KEY` | yes       | every contact form submission is refused                |
| `CONTACT_FROM`   | in effect | every contact form submission fails Resend's validation |

Set them in **Vercel → Project → Settings → Environment Variables**, for Production, Preview
and Development. Not in a `.env` file in the repository; `.env` and `.env.*` are gitignored.

Locally, `cp .env.example .env` and fill them in.

### `CONTACT_FROM` is optional and you still have to set it

Unset, `src/lib/contact.ts` falls back to `Portfolio <onboarding@resend.dev>`, Resend's
sandbox sender. That address delivers only to the address that owns the Resend account.
Every send to anywhere else comes back as a validation error, the form reports the failure
honestly, and the enquiry is lost.

So it is not "works with a default". It is "every real enquiry fails, after a deploy that
built cleanly and passed every test". Verify a domain in Resend, then set:

```
CONTACT_FROM=Portfolio <hello@mehby.com>
```

Neither variable is read at build time. A deploy missing both builds, prerenders all seven
pages and serves them correctly, with one broken form. Nothing will tell you.

---

## 2. Deploy

The build emits Vercel's Build Output API layout, so Vercel needs almost no configuration:
if `.vercel/output` exists after the build, Vercel uses it and ignores framework detection.

1. Push to a private GitHub repository.
2. Vercel → Add New → Project → import it.
3. Settings:

   | Setting          | Value           |
   | ---------------- | --------------- |
   | Framework Preset | Other           |
   | Build Command    | `bun run build` |
   | Install Command  | `bun install`   |
   | Output Directory | leave empty     |
   | Node.js Version  | 22.x            |

4. Add `RESEND_API_KEY` and `CONTACT_FROM` before the first deploy, or the first deploy ships
   a broken form.
5. Deploy.

`bun run build`, not `bun --bun run build`. The difference used to decide which serverless
runtime the deployed function asked for, because Nitro resolved it from whichever process ran
the build:

```
bun run build         ->  "runtime": "nodejs22.x"
bun --bun run build   ->  "runtime": "bun1.x"
```

That is pinned now, in `vite.config.ts`, and `tests/e2e/prerender.spec.ts` asserts what was
emitted. Use `bun run build` anyway; there is no reason to reintroduce the ambiguity.

### What the build produces

```
.vercel/output/config.json                  routing: filesystem, then the catch-all
.vercel/output/static/                      7 prerendered pages, assets, fonts,
                                            sitemap.xml, robots.txt, og cards
.vercel/output/functions/__server.func/     the SSR handler, nodejs22.x
```

`config.json` puts `{ "handle": "filesystem" }` above `/(.*) -> /__server`, so every
prerendered page is served as a file by the CDN and only a genuine miss reaches the function.

**Unverified from here:** the CDN behaviour itself. That Vercel serves `static/writing/index.html`
for a request to `/writing`, and that it negotiates gzip or brotli on the way out, are
properties of Vercel's edge and cannot be exercised without deploying. What is verified is
that the files are in the static directory and that the routing table matches them before the
catch-all. If the filesystem handler ever missed, the request would fall through to the SSR
function and render the same page, so the failure mode is slower rather than broken.

### After the first deploy, check by hand

```bash
curl -sI https://mehby.com/ | head -1                    # 200
curl -s  https://mehby.com/robots.txt                    # names the sitemap
curl -s  https://mehby.com/sitemap.xml | grep -c '<loc>' # 7
curl -sI https://mehby.com/writing/ | grep -i location   # 307 -> /writing
curl -s -H 'Accept-Encoding: br' -D- -o /dev/null https://mehby.com/ | grep -i content-encoding
```

The last one is the compression claim above. If it comes back empty, the pages are going out
uncompressed and the 16.8 KB document is costing 5x what it should.

---

## 3. DNS for mehby.com

The domain has **no records at all**, so this is first-time configuration and nothing can
break by being changed.

1. Vercel → Project → Settings → Domains → add `mehby.com`.
2. Add `www.mehby.com` too, and set one to redirect to the other. Vercel offers this in the
   same screen. Pick the apex as canonical: every canonical link, the sitemap, the RSS feed
   and `robots.txt` in this repository say `https://mehby.com`, with no `www`.
3. Vercel then shows you the exact records to create. **Use those values, not values from
   this file or from a blog post.** Vercel has changed its published apex address before, and
   a stale A record is a domain that resolves to nothing while every dashboard looks green.
   The shape will be either:
   - an `A` record on the apex plus a `CNAME` on `www`, or
   - delegating the whole zone to Vercel's nameservers at the registrar.

   Nameserver delegation is less to get wrong and means Vercel manages the records. Take it
   unless you need to keep other records in the zone.

4. Create the records at the registrar. Propagation is usually minutes and can be up to 48
   hours.
5. Vercel issues the certificate automatically once the records resolve. It cannot do this
   before, so a "certificate pending" state immediately after step 4 is expected, not a fault.

Verify:

```bash
dig +short mehby.com
dig +short www.mehby.com
curl -sI https://mehby.com/ | head -1
```

**Unverified from here:** all of section 3. The domain is not under this machine's control.

### Email

Setting `CONTACT_FROM` to an address at `mehby.com` requires verifying the domain in Resend,
which adds its own DNS records (DKIM, and usually SPF and DMARC). Those are separate from the
records above and do not conflict with them. If you delegate nameservers to Vercel in step 3,
add Resend's records in Vercel's DNS screen rather than at the registrar.

---

## 4. The build makes four outbound network requests

This is the item most likely to look like an outage. Read it before it happens.

`bun run build` runs `scripts/verify-links.mjs` before Vite. It reads every URL in
`content/work/*.mdx` frontmatter and fetches each one. Today that is exactly four:

```
https://coachess.net
https://app.coachess.net
https://live.coachess.net
https://github.com/mehbylabs/helmdeck
```

**If any of them cannot be shown to be live, the build fails and the deploy does not ship.**
Transport failures and 5xx are retried twice with a short backoff; a 4xx is not retried,
because the host answered. "No reply at all" also fails the build, and that is the deliberate
part: a product that is genuinely down answers with a connection reset or a DNS failure, which
is the same signature as a flaky link, so a gate that forgives one forgives the other.

The reasoning is in `scripts/verify-links.mjs` at length. In short: PRODUCT.md puts the entire
burden of credibility on this short strip of live addresses, because the owner's recent source
is private and no metrics may be published. A dead proof link is the site making a false claim
about a product being live, to the one audience it is trying to convince, in the one place it
asked them to check.

### So a CoaChess outage at 2am fails the next Vercel deploy

That is correct behaviour and it is still going to be confusing. The build log names the URL
and the outcome:

```
https://coachess.net    -    UNREACHABLE    ECONNREFUSED

1 proof link could not be shown to be live. The site must not claim it is.
```

If the product is genuinely down: wait, then redeploy. Nothing is broken in the repository.

### `VERIFY_LINKS_OFFLINE=1` will not help you on Vercel

There is an escape hatch, and it is **deliberately refused when `CI` is set**. Vercel sets
`CI`. So:

```
$ VERIFY_LINKS_OFFLINE=1 bun run verify:links          # laptop, no CI
SKIPPED: VERIFY_LINKS_OFFLINE is set, so no proof link was checked.

$ CI=1 VERIFY_LINKS_OFFLINE=1 bun run verify:links     # Vercel
VERIFY_LINKS_OFFLINE is set and is being ignored on CI.
...checks all four anyway
```

Setting it as a Vercel environment variable does nothing except print that line. That is the
point of having a refusable flag rather than a plain opt-out: the risk is not a developer
using it on a train, it is it leaking into the deploy environment where nobody notices the
gate stopped running.

**There is no supported way to deploy past a dead proof link.** That is a design decision, not
an oversight. The supported response is the next section.

---

## 5. When a proof link legitimately dies

A product is retired, a repository goes private, a domain lapses. The link is not coming back
and the build is now correctly refusing to ship a claim that is no longer true.

**Do not** add the URL to an allowlist, and do not reach for `VERIFY_LINKS_OFFLINE`. Change
what the site claims.

Edit the frontmatter in `content/work/<slug>.mdx`:

- **A surface is gone, the project is not.** Remove that entry from `surfaces:`. The
  specification table omits rows it has no data for, so the row disappears cleanly rather than
  printing an empty cell, and the home page's proof strip is built from the same frontmatter,
  so it updates itself.
- **Every surface is gone.** Leave `surfaces: []`. `/work/helmdeck` and `/work/volt-tunisia`
  already ship this way. The case study stays; the live-address claim goes.
- **The repository went private.** Delete the `source:` line.
- **The whole project is retired.** Deleting the `.mdx` file removes the case study, its
  prerendered page, its sitemap entry and its OG card, all of which are derived from the file
  list. Check nothing else links to it: `rg -n '<slug>' src content`.

Then `bun run build && bun run test:e2e`. Two tests are watching this specifically:

- `prerender.spec.ts`, "no built page links off-origin to an address the gate never sees",
  fails if a URL is published anywhere on the site and is not in frontmatter, so you cannot
  fix the gate by moving the URL somewhere the gate does not look.
- `verify-links.mjs` exits 1 if frontmatter yields zero URLs at all, so emptying every
  `surfaces:` block does not produce a gate that reports "0 checked, all fine".

`spec-table.spec.ts` restates each study's rows as literals, so removing a row is a
deliberate two-line change rather than something that happens silently.

---

## 6. `public/og/` is gitignored and rebuilt every time

The four OpenGraph cards are not in the repository. `bun run build` runs
`bun scripts/og.mjs`, which regenerates them from case study frontmatter,
`public/fonts/archivo.woff2` and the script itself, into `public/og/` before Vite copies the
public directory.

They are generated rather than committed because a PNG is a derived artefact no reviewer can
read: a binary diff cannot show that a card still names last week's title.

**Any pipeline that does not run the full `bun run build` ships broken `og:image` URLs.** Every
page's `<meta property="og:image">` points at `https://mehby.com/og/*.png`; if the generate
step did not run, the tags are all still there and all 404, and the only symptom is that links
pasted into Slack or LinkedIn unfurl as bare text. Nothing in a browser looks wrong.

Concretely, do not:

- split the build into `vite build` alone,
- add a Vercel "Ignored Build Step" that skips the build on content-only commits,
- cache `public/og` across builds and skip regeneration.

`metadata.spec.ts` catches it: for every page it asserts the advertised card exists on disk
and that its first eight bytes are a PNG signature.

---

## 7. Known outstanding

Things that are true after this work and are not fixed. None blocks a deploy.

**`failOnError` does not work.** `vite.config.ts` sets `prerender.failOnError: true` and it is
inert. Measured against `@tanstack/start-plugin-core` as installed: `prerender.js` throws
inside a `queue.add()` callback whose returned promise nobody awaits, and `queue.start()`
resolves through `onSettled` whether tasks errored or not. So a route that throws during
prerender is logged, dropped from the output, left in the sitemap, and the build exits 0.
Verified by making `/work/volt-tunisia` throw: three pages emitted instead of four, sitemap
still advertising the fourth, exit code 0. **The real gate is `bun run test:e2e`**, which reads
the emitted HTML off disk and fails rather than skips when there is none. `bun run build`
alone is not sufficient to know the site prerendered.

**`pages.json` is published.** The sitemap generator writes `pages.json` next to `sitemap.xml`,
and under the vercel preset the static directory is served, so `https://mehby.com/pages.json`
will resolve. It contains the prerender page list, which is the sitemap plus the `/writing/`
alias. Nothing sensitive, no way to disable it without a post-build hook, left alone.

**No `SpecTable` on a coloured ground exists to measure.** Two assertions the deleted
`/dev/primitives` harness supported are weaker now, and both are written up in
`tests/e2e/spec-table.spec.ts`: the divider token inverting _as a property of that component_
(the shared `--field-rule-strong` is still measured on both grounds via `/about`'s timeline),
and the hover tint differing between grounds (replaced by a check that the tint is mixed from
`currentColor`, which catches any literal except one that happens to equal ink).

**No case study ships without a stack**, so `SpecTable` omitting its Stack row is not exercised
on any page. Surfaces and Source cover the same code path.

**Cover images and a headshot do not exist.** Four labelled placeholders ship in their place,
which is PRODUCT.md's standing rule rather than a gap in the code.

**Lighthouse has not been re-run since the preset changed.** The 97-to-100 performance and 100
accessibility figures were measured against the node-server build. The byte budget in
`performance.spec.ts` was re-derived from the new output (238.9 KiB, gzip, against a 250 KiB
budget) and every accessibility test still passes, but the Lighthouse score itself should be
re-taken against the deployed site.

**Nothing has been deployed.** No Vercel project exists, no DNS record exists, no certificate
has been issued, and `https://mehby.com` has never returned anything.
