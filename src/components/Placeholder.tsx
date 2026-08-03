// A block that stands in for an asset nobody has supplied yet.
//
// PRODUCT.md, Standing Rules: "Where an asset has not been supplied, ship a
// labelled placeholder that is obviously a placeholder. Never invent content,
// never substitute stock imagery for a real product screenshot." Three case
// study covers are referenced by content/work/*.mdx and none of the files
// exist, so this is what occupies their space until they do.
//
// Two things it must do that a styled empty div does not:
//
// 1. Say what is missing, twice. Once in visible text, so a reviewer cannot
//    read it as an intentionally empty panel, and once as an accessible name,
//    because role="img" with no name announces as "image" and tells a screen
//    reader user that something is there rather than that something is absent.
//
// 2. Reserve the exact space the asset will take. DESIGN.md: "Every image
//    reserves explicit dimensions so nothing shifts on load." A placeholder
//    that reserves nothing hands the reflow to the day the real asset lands,
//    which is the day nobody is looking at the layout.
//
// It reads as provisional because it is drawn with a dashed edge-strong rule,
// the structural border token: a dashed outline is the terminal's own marker
// for "this is not real yet". The caption is Martian Mono, the same register
// every note on this site uses.

export type PlaceholderProps = {
  /** What belongs here, in the site's voice. Printed, and announced. */
  label: string
  /** Width divided by height. Required: a default is the wrong shape, silently. */
  ratio: number
  className?: string
}

export function Placeholder({
  label,
  ratio,
  className = '',
}: PlaceholderProps) {
  return (
    <div
      className={`placeholder ${className}`.trim()}
      data-testid="placeholder"
      role="img"
      aria-label={`Placeholder: ${label}. Asset not supplied.`}
      // Inline because it is data, not style: the ratio belongs to the asset
      // and differs per call, so it cannot live in a class.
      style={{ aspectRatio: String(ratio) }}
    >
      <span className="placeholder-caption" data-testid="placeholder-caption">
        PLACEHOLDER: {label}
      </span>
    </div>
  )
}
