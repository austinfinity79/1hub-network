/** The four-point mark the L1 board puts on AI items; an inline SVG, not a font glyph. */
export function Spark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <path d="M4 0l.9 3.1L8 4l-3.1.9L4 8l-.9-3.1L0 4l3.1-.9z" />
    </svg>
  )
}
