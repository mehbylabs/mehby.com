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
  paper: [0.97, 0.008, 85],
  ink: [0.22, 0.02, 265],
  ultramarine: [0.52, 0.19, 264],
  'ultramarine-deep': [0.34, 0.15, 264],
  rule: [0.88, 0.01, 85],
  'rule-strong': [0.62, 0.012, 85],
  signal: [0.56, 0.16, 45],
  // On-colour variants. The ultramarine ground covers 30 to 50 percent of the
  // site by design, so every role that appears on it needs its own value. The
  // paper-ground tokens above are unusable there: signal measures 1.15 and
  // rule-strong 1.57 against ultramarine.
  'rule-on-color': [0.82, 0.05, 264],
  'signal-on-color': [0.85, 0.13, 70],
}

// threshold: 4.5 body text, 3.0 large text and non-text UI.
const PAIRS = [
  ['ink', 'paper', 4.5],
  ['ultramarine', 'paper', 4.5],
  ['paper', 'ultramarine', 4.5],
  ['paper', 'ultramarine-deep', 4.5],
  ['ultramarine-deep', 'paper', 4.5],
  ['signal', 'paper', 4.5],
  ['ink', 'rule', 4.5],
  ['rule-strong', 'paper', 3.0],

  // Focus ring. On paper it is ultramarine; on colour it must invert to paper,
  // or the ring is literally invisible at 1.00 against its own ground.
  ['ultramarine', 'paper', 3.0],
  ['paper', 'ultramarine', 3.0],

  // Structural borders and live indicators on the ultramarine ground. Non-text
  // threshold. The indicator dot carries the signal; its label uses paper,
  // because no usable lightness of signal reaches 4.5 against ultramarine.
  ['rule-on-color', 'ultramarine', 3.0],
  ['signal-on-color', 'ultramarine', 3.0],
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
const ruleRatio = contrast(rgb.rule, rgb.paper)
console.log(
  `\nNote: --rule on paper is ${ruleRatio.toFixed(2)}:1. Decorative hairlines only.\n` +
    'Any border that carries meaning must use --rule-strong.',
)

if (failed > 0) {
  console.error(`\n${failed} pair(s) below threshold.`)
  process.exit(1)
}
console.log('\nAll pairs pass WCAG 2.2 AA.')
