import { Box, Diagram, Link } from './Diagram'

// Draws the decision the case study is actually about: a protocol at the
// boundary rather than an adapter per agent, and a protocol layer isolated in
// its own package so the rest of the application never learns which agent it
// is talking to.
//
// The agents are unlabelled on purpose. Naming vendors would date the drawing
// and would also be the claim the architecture exists to avoid making: the
// application does not know which one it is, so neither does the picture.

const AGENT_Y = [46, 140, 234]

export function HelmdeckDiagram() {
  const boundaryX = 236
  const appX = 400

  return (
    <Diagram
      title="Helmdeck, one protocol boundary instead of an adapter per agent"
      desc="Three coding agents on the left each connect to a single dashed boundary marked Agent Client Protocol, drawn as one isolated package. To its right sit the parts of the application: the web workspace, a domain package with no user interface, and a shared design system. Every agent reaches the application through the one boundary, so nothing to the right of it knows which agent is connected."
      caption="One tested boundary, not one adapter per agent. Nothing right of the line knows which agent it is talking to."
    >
      {AGENT_Y.map((y, i) => (
        <g key={y}>
          <Box x={20} y={y} width={150} height={62} lines={['agent']} />
          <Link
            points={[
              [170, y + 31],
              [boundaryX, y + 31],
            ]}
          />
          {i === 2 ? (
            <text
              x={95}
              y={y + 84}
              className="diagram-note"
              textAnchor="middle"
            >
              any ACP agent
            </text>
          ) : null}
        </g>
      ))}

      {/* The boundary. Dashed, because it is a seam rather than a component,
          and in the accent because it is the whole argument of the drawing. */}
      <Box
        x={boundaryX}
        y={46}
        width={96}
        height={250}
        lines={['Agent', 'Client', 'Protocol']}
        accent
        dashed
      />

      <Link
        accent
        points={[
          [boundaryX + 96, 171],
          [appX, 171],
        ]}
      />

      <Box x={appX} y={46} width={220} height={62} lines={['web workspace']} />
      <Box
        x={appX}
        y={140}
        width={220}
        height={62}
        lines={['domain package', 'no user interface']}
      />
      <Box x={appX} y={234} width={220} height={62} lines={['design system']} />

      {/* The spine the three application parts hang off. */}
      <Link
        points={[
          [appX - 24, 171],
          [appX - 24, 77],
          [appX, 77],
        ]}
      />
      <Link
        points={[
          [appX - 24, 171],
          [appX - 24, 265],
          [appX, 265],
        ]}
      />
    </Diagram>
  )
}
