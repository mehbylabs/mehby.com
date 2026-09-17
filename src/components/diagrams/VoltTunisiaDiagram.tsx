import { Diagram } from './Diagram'

// The four tier progressive tariff, which the case study calls the hard part
// of the domain: the cost of a charge depends on the household's total
// consumption for the month rather than on a flat rate per kilowatt hour.
//
// The fourth tier is drawn open, with no right hand edge, because that is the
// edge case the narrative names: the top tier is unlimited, and treating it as
// a very large number instead of an unbounded one is exactly the kind of
// subtly wrong encoding the whole project exists not to do.
//
// The step heights are illustrative and the axes carry no figures, which is
// deliberate twice over: PRODUCT.md bans metrics on this site, and printing a
// specific millime rate would be a claim that goes stale the first time the
// national tariff moves.

const BASE = 300
const LEFT = 64
const STEP = 118

const TIERS = [
  { label: 'tier 1', height: 44 },
  { label: 'tier 2', height: 88 },
  { label: 'tier 3', height: 140 },
  { label: 'tier 4', height: 204 },
]

export function VoltTunisiaDiagram() {
  return (
    <Diagram
      title="Tunisia's progressive electricity tariff, four tiers"
      desc="A step chart of four rising tiers. Each tier is taller than the one before it, so the rate per kilowatt hour increases as the household's monthly consumption grows. The first three tiers have a fixed upper bound. The fourth is drawn without a right hand edge because it is unlimited, which is the edge case the product encodes rather than approximating it with a large number. The vertical axis is the rate per kilowatt hour and the horizontal axis is consumption over the month."
      caption="The cost of a charge follows the month's total consumption, not a flat rate. The top tier is unbounded, and is encoded as such."
    >
      {/* Axes. Drawn in the decorative rule, because they are scaffolding for
          reading the steps rather than structure a visitor has to perceive. */}
      <line x1={LEFT} y1={40} x2={LEFT} y2={BASE} className="diagram-axis" />
      <line x1={LEFT} y1={BASE} x2={608} y2={BASE} className="diagram-axis" />

      <text x={LEFT - 10} y={46} className="diagram-note" textAnchor="end">
        rate
      </text>
      <text x={608} y={BASE + 26} className="diagram-note" textAnchor="end">
        consumption over the month
      </text>

      {TIERS.map((tier, i) => {
        const x = LEFT + i * STEP
        const y = BASE - tier.height
        const last = i === TIERS.length - 1
        // The open tier is drawn as three sides. A rect would close it, and
        // the closure is the thing being denied.
        return (
          <g key={tier.label}>
            {last ? (
              <polyline
                points={`${x},${BASE} ${x},${y} ${x + STEP + 24},${y}`}
                className="diagram-step is-accent"
              />
            ) : (
              <polyline
                points={`${x},${BASE} ${x},${y} ${x + STEP},${y} ${x + STEP},${BASE}`}
                className="diagram-step"
              />
            )}
            <text
              x={x + STEP / 2}
              y={y - 12}
              className={`diagram-label${last ? ' is-accent' : ''}`}
              textAnchor="middle"
            >
              {tier.label}
            </text>
          </g>
        )
      })}

      <text
        x={608}
        y={BASE - 224}
        className="diagram-note is-accent"
        textAnchor="end"
      >
        unlimited
      </text>
    </Diagram>
  )
}
