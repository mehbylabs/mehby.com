import { Box, Diagram, Link } from './Diagram'

// Draws the one sentence the case study calls "the whole problem": five
// surfaces, keeping separate rhythms, sharing one identity and one data model.
//
// The live classroom is the only box in the accent, because it is the only one
// the narrative singles out: the real time layer is owned rather than embedded,
// which is what makes synchronised annotation and replay possible at all.
//
// Nothing here is non-public. Every label is a surface the company already
// publishes on its own domains, or a phrase from the case study beside it.

const SURFACES = [
  { lines: ['landing'], accent: false },
  { lines: ['player app'], accent: false },
  { lines: ['academy app'], accent: false },
  { lines: ['live', 'classroom'], accent: true },
  { lines: ['back office'], accent: false },
]

// Five boxes and four gaps have to fit the 640 unit canvas with a margin each
// side: 5 * 108 + 4 * 15 is 600, inside 20 units of margin left and right.
// Worth stating, because the arithmetic being wrong does not throw, it just
// puts the fifth surface through the right hand edge.
const WIDTH = 108
const GAP = 15
const TOP = 52
const HEIGHT = 58
const START = 20

export function CoachessDiagram() {
  const busY = 168
  const serviceY = 262

  return (
    <Diagram
      title="The CoaChess platform, five surfaces over one data model"
      desc="Five product surfaces sit in a row: the landing site, the player app, the academy app, the live classroom, and an internal back office. Each connects down to a shared band holding one identity and one data model, which in turn sits on a typed front end and a Python service layer. The live classroom is marked apart because its real time video, annotation and recording are run directly rather than embedded."
      caption="Five surfaces, separate rhythms, one identity and one data model underneath."
    >
      {SURFACES.map((surface, i) => {
        const x = START + i * (WIDTH + GAP)
        const centre = x + WIDTH / 2
        return (
          <g key={surface.lines.join(' ')}>
            <Box
              x={x}
              y={TOP}
              width={WIDTH}
              height={HEIGHT}
              lines={surface.lines}
              accent={surface.accent}
            />
            {/* Down, across to the centre line, and into the shared band. */}
            <Link
              accent={surface.accent}
              points={[
                [centre, TOP + HEIGHT],
                [centre, busY - 22],
                [centre, busY],
              ]}
            />
          </g>
        )
      })}

      <Box
        x={START}
        y={busY}
        width={600}
        height={54}
        lines={['one identity, one data model']}
      />

      <Link
        points={[
          [320, busY + 54],
          [320, serviceY],
        ]}
      />

      <Box
        x={170}
        y={serviceY}
        width={300}
        height={54}
        lines={['typed front end, Python service layer']}
      />
    </Diagram>
  )
}
