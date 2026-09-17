import { CoachessDiagram } from './CoachessDiagram'
import { HelmdeckDiagram } from './HelmdeckDiagram'
import { VoltTunisiaDiagram } from './VoltTunisiaDiagram'
import type { ComponentType } from 'react'

// Keyed by slug, resolved at render. A case study with no diagram falls back
// to the labelled placeholder, which is still the correct answer for an asset
// nobody has drawn: PRODUCT.md's standing rule is that a gap is declared, not
// filled with something invented.
export const DIAGRAMS: Record<string, ComponentType | undefined> = {
  coachess: CoachessDiagram,
  helmdeck: HelmdeckDiagram,
  'volt-tunisia': VoltTunisiaDiagram,
}
