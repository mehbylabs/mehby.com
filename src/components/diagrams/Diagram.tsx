import { useId } from 'react'
import type { ReactNode } from 'react'

// The frame every architecture diagram is drawn in.
//
// PRODUCT.md's first design principle is proof over claim, and the site sells
// product engineering while shipping no pixels of any product. The case study
// covers do not exist, so the largest element on every work page was a dashed
// box labelled PLACEHOLDER: correct under the standing rule about missing
// assets, and still the wrong thing for a visitor who arrived asking what this
// person has built.
//
// Screenshots need the owner. Diagrams do not, and DESIGN.md already names
// "generated architecture diagrams" as one of the site's two forms of imagery.
// Each one draws only what the narrative beside it already says in prose, so
// nothing here discloses anything the case study does not, which is what keeps
// the CoaChess discretion rule intact.
//
// Drawn as inline SVG rather than shipped as files. Three reasons, all of them
// load bearing on this site: it is painted in the design tokens, so it cannot
// drift from the palette the contrast gate measures; it costs no request, on a
// page already asserted to stay under 250 KiB; and it reserves its box from
// its own viewBox, so there is nothing to shift when it loads, which is what
// the zero cumulative layout shift assertion needs.
//
// Accessibility. A diagram is an image and announces as one, with a name and a
// longer description, both written in the site's voice. The prose version is
// not a courtesy: it is the content, for every reader who cannot use the
// picture, and it is why `desc` is required rather than optional.

export type DiagramProps = {
  /** The accessible name. What this diagram is. */
  title: string
  /** The accessible description. What it shows, in a sentence or two. */
  desc: string
  /** Printed under the frame, in the site's note register. */
  caption: string
  children: ReactNode
}

/** The shared drawing surface. 16:9, and every child draws in these units. */
export const VIEW = { width: 640, height: 360 } as const

export function Diagram({ title, desc, caption, children }: DiagramProps) {
  // Ids have to be unique in a document that renders more than one of these,
  // and stable between the server render and hydration. useId is both.
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`

  return (
    <figure className="diagram" data-testid="diagram">
      <svg
        className="diagram-canvas"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        // Reserves the box before anything paints, the same contract the
        // placeholder honoured and for the same reason.
        width={VIEW.width}
        height={VIEW.height}
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{desc}</desc>
        {children}
      </svg>
      <figcaption className="diagram-caption log-line">
        <b>~/architecture</b> {caption}
      </figcaption>
    </figure>
  )
}

export type BoxProps = {
  x: number
  y: number
  width: number
  height: number
  /** One entry per line. Wrapping is manual: SVG has no line box. */
  lines: ReadonlyArray<string>
  /** Drawn in the accent, for the one element a diagram is making a point about. */
  accent?: boolean
  /** Dashed, for a boundary rather than a component. */
  dashed?: boolean
}

/** A labelled box. The only primitive these diagrams need. */
export function Box({
  x,
  y,
  width,
  height,
  lines,
  accent = false,
  dashed = false,
}: BoxProps) {
  const LINE = 15
  // Centred as a block: the first baseline sits half a block above the middle.
  const first = y + height / 2 - ((lines.length - 1) * LINE) / 2 + 5

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        className={`diagram-box${accent ? ' is-accent' : ''}${
          dashed ? ' is-dashed' : ''
        }`}
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x={x + width / 2}
          y={first + i * LINE}
          className={`diagram-label${accent ? ' is-accent' : ''}`}
          textAnchor="middle"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

/** A connector. Orthogonal only: these are architecture drawings, not sketches. */
export function Link({
  points,
  accent = false,
}: {
  points: ReadonlyArray<readonly [number, number]>
  accent?: boolean
}) {
  return (
    <polyline
      points={points.map(([x, y]) => `${x},${y}`).join(' ')}
      className={`diagram-link${accent ? ' is-accent' : ''}`}
    />
  )
}
