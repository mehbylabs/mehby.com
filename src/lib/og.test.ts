import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { inflateSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { getCaseStudies } from '#/lib/content'

// scripts/og.mjs, asserted by decoding the PNGs it writes.
//
// The temptation with a build script that emits binaries is to assert that the
// files exist and stop, which passes just as happily when every image is a
// blank white rectangle. So these tests inflate the pixel data and read it: the
// ground has to be the warm near-black, the headline has to be orange, and two
// case studies have to differ from each other. A share image is seen only
// outside the site, in a place nobody on this project will look, so nothing
// about it can be left to "it probably rendered".

const SCRIPT = 'scripts/og.mjs'
// The terminal tokens the cards are built from, as sRGB: the warm near-black
// ground and the orange headline. Written as bytes rather than hex to compare
// against the decoded pixels directly.
const BG = [0x0d, 0x09, 0x06]
const ORANGE = [0xf0, 0x5d, 0x00]

function run(args: Array<string>) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn('bun', [SCRIPT, ...args])
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (c: string) => (stdout += c))
      child.stderr.on('data', (c: string) => (stderr += c))
      child.on('close', (status) => resolve({ status, stdout, stderr }))
    },
  )
}

/**
 * A minimal PNG reader: signature, IHDR, and the inflated, unfiltered pixels.
 *
 * Written out rather than pulled in as a dependency because the input is not
 * arbitrary. resvg emits 8 bit RGBA, non-interlaced, one IDAT stream, and the
 * assertions below check exactly that before trusting anything after it. A
 * decoder that silently coped with a different shape would be free to be wrong.
 */
function readPng(file: string) {
  const buf = readFileSync(file)

  expect(buf.subarray(0, 8).toString('hex'), `${file} is not a PNG`).toBe(
    '89504e470d0a1a0a',
  )

  let offset = 8
  const idat: Array<Buffer> = []
  let header: {
    width: number
    height: number
    depth: number
    colorType: number
    interlace: number
  } | null = null

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1')
    const data = buf.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR')
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    if (type === 'IDAT') idat.push(data)
    if (type === 'IEND') break
    offset += 12 + length
  }

  expect(header, `${file} has no IHDR`).not.toBeNull()
  const { width, height, depth, colorType, interlace } = header!
  expect(depth, 'expected 8 bit samples').toBe(8)
  expect(colorType, 'expected RGBA').toBe(6)
  expect(interlace, 'expected a non-interlaced image').toBe(0)

  const bpp = 4
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(stride * height)

  // Undo the per-scanline filters. Five of them, defined by the PNG spec; all
  // five appear in real output, so none can be skipped.
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      pixels[y * stride + x] = value & 0xff
    }
  }

  const at = (x: number, y: number) => [
    pixels[y * stride + x * bpp],
    pixels[y * stride + x * bpp + 1],
    pixels[y * stride + x * bpp + 2],
    pixels[y * stride + x * bpp + 3],
  ]

  const count = (rgb: Array<number>) => {
    let total = 0
    for (let i = 0; i < pixels.length; i += bpp)
      if (
        pixels[i] === rgb[0] &&
        pixels[i + 1] === rgb[1] &&
        pixels[i + 2] === rgb[2]
      )
        total += 1
    return total
  }

  return { width, height, at, count, bytes: buf }
}

function fixtureContent(slugs: Array<string>) {
  const dir = mkdtempSync(join(tmpdir(), 'og-content-'))
  slugs.forEach((slug, index) =>
    writeFileSync(
      join(dir, `${slug}.mdx`),
      `---\ntitle: ${slug}\nsummary: A fixture case study.\nrole: Engineer\nperiod: 2026\norder: ${index + 1}\nsurfaces: []\n---\n\nBody.\n`,
    ),
  )
  return dir
}

const outDir = () => mkdtempSync(join(tmpdir(), 'og-out-'))

test('it writes one share image per case study, plus a default', async () => {
  const out = outDir()
  const content = fixtureContent(['alpha', 'beta'])

  const result = await run(['--out', out, '--content', content])

  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  expect(readdirSync(out).sort()).toEqual([
    'alpha.png',
    'beta.png',
    'default.png',
  ])
}, 60000)

test('every image is a real PNG at exactly 1200 by 630', async () => {
  const out = outDir()
  await run(['--out', out, '--content', fixtureContent(['alpha'])])

  const files = readdirSync(out)
  // Without this the loop below iterates nothing and the test passes against a
  // script that wrote no images at all, which is exactly how it first passed.
  expect(files.length, 'no share images were written').toBe(2)

  for (const file of files) {
    const png = readPng(join(out, file))
    expect(png.width, `${file} is the wrong width`).toBe(1200)
    expect(png.height, `${file} is the wrong height`).toBe(630)
  }
}, 60000)

test('the ground is the near-black and the headline is orange', async () => {
  const out = outDir()
  await run(['--out', out, '--content', fixtureContent(['alpha'])])
  const png = readPng(join(out, 'default.png'))

  // A corner, which no glyph reaches. This is the assertion that fails when
  // somebody drops the background and ships white cards.
  expect(
    png.at(4, 4).slice(0, 3),
    'the corner is not the near-black ground',
  ).toEqual(BG)
  expect(png.at(1195, 625).slice(0, 3)).toEqual(BG)
  expect(png.at(4, 4)[3], 'the image is not opaque').toBe(255)

  // Glyph interiors are pure orange; only the antialiased edges are blends. A
  // count in the thousands is text on the card, and zero is an empty ground,
  // which is what a missing font or an unrendered title looks like.
  expect(
    png.count(ORANGE),
    'there is no orange type on the card, so nothing was drawn',
  ).toBeGreaterThan(5000)
}, 60000)

test('each card carries its own case study, so no two are the same image', async () => {
  const out = outDir()
  await run(['--out', out, '--content', fixtureContent(['alpha', 'beta'])])

  const alpha = readPng(join(out, 'alpha.png'))
  const beta = readPng(join(out, 'beta.png'))
  const fallback = readPng(join(out, 'default.png'))

  // Byte equality is the right comparison here: identical files mean the title
  // was never substituted in, which is the failure that leaves every case study
  // sharing one card that names the wrong project.
  expect(
    alpha.bytes.equals(beta.bytes),
    'two case studies produced byte-identical cards, so the title is not on them',
  ).toBe(false)
  expect(alpha.bytes.equals(fallback.bytes)).toBe(false)
}, 60000)

test('a missing font stops the run rather than rendering a blank card', async () => {
  const out = outDir()

  const result = await run([
    '--out',
    out,
    '--content',
    fixtureContent(['alpha']),
    '--font',
    'public/fonts/does-not-exist.woff2',
  ])

  // One line, naming the file. Not "not zero" and not "mentions the path
  // somewhere": letting the font error fall through to satori also exits
  // non-zero and also happens to print the path, but it prints it above five
  // thousand characters of minified bundle and a stack trace into satori's
  // internals. Measured, by mutating the exit into a fallthrough. A build gate
  // that fails illegibly gets diagnosed as "the build is broken" rather than
  // "the font moved", so the shape of the message is part of the behaviour.
  const lines = result.stderr.trim().split('\n')
  expect(
    lines.length,
    `expected one legible line, got:\n${result.stderr.slice(0, 400)}`,
  ).toBe(1)
  expect(lines[0]).toContain('does-not-exist.woff2')
  expect(result.status).toBe(1)

  // And nothing half written. A card with no type on it is worse than no card:
  // the meta tag still points at it and the preview still renders, blank.
  expect(readdirSync(out)).toEqual([])
}, 60000)

test('the shipped content produces a card for every case study the site serves', async () => {
  const out = outDir()

  await run(['--out', out])

  const expected = [
    'default.png',
    ...getCaseStudies().map((study) => `${study.slug}.png`),
  ].sort()
  expect(readdirSync(out).sort()).toEqual(expected)
}, 90000)

test('the build generates the cards before vite copies public', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

  expect(pkg.scripts['generate:og']).toContain('og.mjs')

  const build: string = pkg.scripts.build
  const og = build.search(/generate:og|og\.mjs/)
  const vite = build.indexOf('vite build')

  expect(og, `build does not generate share images: ${build}`).toBeGreaterThan(
    -1,
  )
  // Ordering is the whole point. public/og is gitignored, so a build that runs
  // vite first copies a directory that does not exist yet and every og:image
  // meta tag ships pointing at a 404.
  expect(vite).toBeGreaterThan(og)
})

test('the generated cards are not committed', () => {
  const ignore = readFileSync('.gitignore', 'utf8')

  // Derived from the frontmatter, the font and the script, all of which are
  // committed. A checked-in copy is a cache with no way to tell it has gone
  // stale: a reviewer cannot see that a PNG shows last week's title.
  expect(ignore).toMatch(/^public\/og\/?$/m)
  expect(existsSync('public/og/.gitkeep')).toBe(false)
})
