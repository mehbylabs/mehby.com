#!/usr/bin/env node
// Verifies every colour pair used in the design system against WCAG 2.2.
// Tokens here are the source of truth alongside DESIGN.md. Exits non-zero on failure.

const gamma = (t) =>
  t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t

function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, gamma(v))))
}

const luminance = ([r, g, b]) => {
  const c = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

const contrast = (A, B) => {
  const a = luminance(A)
  const b = luminance(B)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const hex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

const TOKENS = {
  // Direction: terminal, engineered. Warm near-black ground, one loud orange,
  // amber prompts, and green and red reserved for live status. Mono carries
  // the terminal voice, Archivo carries the statements. Deliberately not the
  // generic green-on-black cliche: the ground is warm, not pure black.
  bg: [0.145, 0.01, 70],
  panel: [0.185, 0.012, 70],
  'panel-lift': [0.225, 0.014, 70],
  text: [0.93, 0.012, 75],
  muted: [0.64, 0.02, 72],
  // Orange is a fill and a display accent. Button labels are always bg, which
  // measures 5.90, because text on orange is only 2.73.
  orange: [0.66, 0.2, 45],
  amber: [0.85, 0.13, 85],
  green: [0.75, 0.16, 150],
  red: [0.6, 0.2, 25],
  // edge is decorative only, 1.75 on bg. Structural borders use edge-strong.
  edge: [0.35, 0.015, 70],
  'edge-strong': [0.52, 0.02, 70],
}

// threshold: 4.5 body text, 3.0 large text and non-text UI.
const PAIRS = [
  ['text', 'bg', 4.5],
  ['muted', 'bg', 4.5],
  ['text', 'panel', 4.5],
  ['muted', 'panel', 4.5],
  ['amber', 'bg', 4.5],
  ['green', 'bg', 4.5],
  ['red', 'bg', 4.5],

  // Orange button fill, dark label.
  ['bg', 'orange', 4.5],

  // Focus ring, visible on every ground.
  ['orange', 'bg', 3.0],
  ['orange', 'panel', 3.0],

  // Structural borders a user must perceive.
  ['edge-strong', 'bg', 3.0],
  ['edge-strong', 'panel', 3.0],
]

const rgb = {}
console.log('Token'.padEnd(18) + 'OKLCH'.padEnd(28) + 'Hex')
for (const [name, v] of Object.entries(TOKENS)) {
  rgb[name] = oklchToSrgb(...v)
  console.log(
    name.padEnd(18) + `oklch(${v.join(' ')})`.padEnd(28) + hex(rgb[name]),
  )
}

console.log(
  '\n' + 'Pair'.padEnd(38) + 'Ratio'.padEnd(8) + 'Min'.padEnd(6) + 'Result',
)
let failed = 0
for (const [fg, bg, min] of PAIRS) {
  const ratio = contrast(rgb[fg], rgb[bg])
  const ok = ratio >= min
  if (!ok) failed++
  console.log(
    `${fg} on ${bg}`.padEnd(38) +
      ratio.toFixed(2).padEnd(8) +
      String(min).padEnd(6) +
      (ok ? 'PASS' : 'FAIL'),
  )
}

// --rule is decorative only. Asserted here so nobody promotes it to a meaningful border.
const edgeRatio = contrast(rgb.edge, rgb.bg)
console.log(
  `
Note: --edge on bg is ${edgeRatio.toFixed(2)}:1. Decorative outlines only.
` +
    'Any border a user must perceive uses --edge-strong.',
)

if (failed > 0) {
  console.error(`\n${failed} pair(s) below threshold.`)
  process.exit(1)
}
console.log('\nAll pairs pass WCAG 2.2 AA.')
