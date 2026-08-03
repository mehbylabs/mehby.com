#!/usr/bin/env bun
// Generates the share images: one default card, and one per case study.
// Run by `bun run generate:og`, which the build chain calls before vite build.
//
// This is the piece a Next.js build would have handed over for free. There is
// no equivalent of next/og here, so the pipeline is explicit: satori lays the
// card out as SVG, resvg rasterises it, and the PNG lands in public/ before
// vite copies that directory into the client output.
//
// The images are gitignored, not committed. They are a pure function of three
// committed inputs, the frontmatter, the font and this file, so a checked-in
// copy would be a cache with no way of announcing that it had gone stale: no
// reviewer can look at a binary diff and see that a card still shows last
// week's title. The cost of that choice is that a build which skips this step
// ships og:image tags pointing at nothing, so the step is chained ahead of
// vite build and src/lib/og.test.ts pins the ordering.
//
// Run under bun rather than node so the case study titles come from
// src/lib/content.ts, the same loader the pages render from.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { decompress } from 'wawoff2'
import { CASE_STUDY_DIR, getCaseStudies } from '../src/lib/content.ts'

const WIDTH = 1200
const HEIGHT = 630
// The terminal tokens, as sRGB. Written as hex rather than the OKLCH the
// stylesheet uses because satori has no colour space machinery; these are the
// values scripts/contrast.mjs converts those tokens to:
//   --bg      oklch(0.145 0.01 70)  #0d0906
//   --orange  oklch(0.66 0.2 45)    #f05d00
//   --amber   oklch(0.85 0.13 85)   #f5c761
//   --muted   oklch(0.64 0.02 72)   #948a7f
const BG = '#0d0906'
const ORANGE = '#f05d00'
const AMBER = '#f5c761'
const MUTED = '#948a7f'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const outDir = arg('--out', 'public/og')
const contentDir = arg('--content', CASE_STUDY_DIR)
const fontPath = arg('--font', 'public/fonts/archivo.woff2')
const fontMonoPath = arg('--font-mono', 'public/fonts/martian-mono.woff2')

// ---------------------------------------------------------------------------
// The font, and the two things that had to be worked around to get it in.
//
// 1. satori will not read woff2. Its bundled opentype fork rejects the wOF2
//    signature outright, so the file the browser downloads has to be
//    decompressed back to a bare TTF first. wawoff2 does that in process.
//    Deriving the TTF from the exact file the site serves, rather than
//    committing a second static cut of Archivo beside it, is deliberate: two
//    copies of a typeface is two things to keep in step, and the share image
//    silently drifting to a different font is precisely the kind of failure
//    nobody on the project ever sees.
//
// 2. satori cannot load a variable font at all, in this version. Its bundled
//    @shuding/opentype.js calls fvar.parse(data, offset, font.names) at
//    dist/opentype.module.js:11607, and nothing in that build ever assigns
//    font.names, so every font carrying an fvar table throws
//    "undefined is not an object (evaluating 'names[p.parseUShort()]')".
//    Measured, not assumed: it throws for public/fonts/archivo.woff2 and for
//    every archivo file in @fontsource-variable, because they all have fvar.
//
//    So the fvar table is hidden from the parser by upper-casing the last
//    character of its tag in the table directory, in an in-memory copy. Four
//    bytes, no offsets moved, no checksums touched, and 'fvaR' sorts into the
//    same slot as 'fvar' so the directory stays ordered. What satori then sees
//    is a static font at the file's default instance.
//
//    The consequence, and it is a real one: the default instance of this file
//    is wght 600, wdth 100. The Expanded cut the site sets its display type in
//    lives at wdth 125, and satori has no way to reach it. It ignores
//    fontStretch and fontVariationSettings alike, verified by rendering the
//    same string with and without both and getting byte-identical SVG. The
//    share images are therefore Archivo SemiBold at normal width: the right
//    typeface, not the site's display cut. Getting the Expanded cut would mean
//    instantiating the variable font at wdth 125 before satori sees it, which
//    means interpolating gvar deltas, which is a font toolchain and not a
//    build script.
// ---------------------------------------------------------------------------

/** Renames a table's tag in the sfnt directory so the parser never sees it. */
function hideTable(ttf, tag) {
  const patched = Buffer.from(ttf)
  const tables = patched.readUInt16BE(4)
  for (let i = 0; i < tables; i += 1) {
    const entry = 12 + i * 16
    if (patched.subarray(entry, entry + 4).toString('latin1') === tag) {
      patched.write(
        tag.slice(0, 3) + tag.slice(3).toUpperCase(),
        entry,
        'latin1',
      )
      return patched
    }
  }
  return patched
}

/** Loads one face for satori: decompressed to TTF, with fvar hidden. */
async function loadFont(path) {
  return hideTable(Buffer.from(await decompress(readFileSync(path))), 'fvar')
}

let archivo
let martianMono
try {
  archivo = await loadFont(fontPath)
  martianMono = await loadFont(fontMonoPath)
} catch (cause) {
  // Loud, and before anything is written. satori falls back to no font at all
  // rather than to a system face, so the alternative to failing here is a set
  // of cards with a correct ground and no type on them.
  console.error(`Cannot read the share image font: ${cause.message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// The card. Plain objects rather than JSX, because this file is a build script
// and adding a JSX pipeline to it would buy nothing.
//
// Three lines, in the same order the site introduces itself: where this came
// from, what it is, and the one line of specification underneath. No logo,
// because the site has no logo; no screenshot, because PRODUCT.md forbids
// inventing one where the real asset does not exist.
//
// The layout is the terminal register: warm near-black ground, the title in
// the one loud orange (display, never body text on bg), and the meta lines in
// Martian Mono, with amber carrying the accent line. Every pair is one
// scripts/contrast.mjs already gates.
// ---------------------------------------------------------------------------

const text = (content, style) => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: content },
})

const card = ({ kicker, title, footer }) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      padding: '72px 80px',
      backgroundColor: BG,
      color: MUTED,
      fontFamily: 'Archivo',
    },
    children: [
      text(kicker, { fontFamily: 'Martian Mono', fontSize: 26 }),
      text(title, {
        // Long titles are rare and short ones are the norm, so the size steps
        // down rather than wrapping into the line above it.
        color: ORANGE,
        fontSize: title.length > 28 ? 78 : 104,
        lineHeight: 1.05,
        letterSpacing: '-0.02em',
      }),
      text(footer, { fontFamily: 'Martian Mono', fontSize: 30, color: AMBER }),
    ],
  },
})

async function write(name, content) {
  const svg = await satori(card(content), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Archivo', data: archivo, weight: 600, style: 'normal' },
      {
        name: 'Martian Mono',
        data: martianMono,
        weight: 500,
        style: 'normal',
      },
    ],
  })

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    // The ground is painted by the card itself, so this only guarantees the
    // PNG is opaque. A transparent share image renders black in some clients
    // and white in others, which is a card nobody designed.
    background: BG,
  })
    .render()
    .asPng()

  writeFileSync(`${outDir}/${name}.png`, png)
  console.log(`${outDir}/${name}.png`.padEnd(40) + `${png.length} bytes`)
}

const studies = getCaseStudies(contentDir)

mkdirSync(outDir, { recursive: true })

await write('default', {
  kicker: 'mehby.com',
  title: 'Mohamed Elhedi Ben Yedder',
  footer: 'Full stack product engineer, available for freelance work',
})

for (const study of studies) {
  await write(study.slug, {
    kicker: 'mehby.com, case study',
    title: study.title,
    footer: `${study.role}, ${study.period}`,
  })
}

console.log(`\n${studies.length + 1} share images written to ${outDir}.`)
