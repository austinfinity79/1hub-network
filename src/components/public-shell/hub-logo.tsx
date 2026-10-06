/**
 * The HUB symbol of the new public header (Thảo, 06/10: "logo chữ HUB NETWORK
 * thành logo biểu tượng HUB"). Two interlocked rounded squares with the "N"
 * block, redrawn as SVG from the demo frames (DM01 / DM02 at 33 × 34 px); no
 * raster asset is supplied. `currentColor` follows the header tone.
 */
export function HubLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 33 34"
      width="33"
      height="34"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1.3"
        y="1.3"
        width="21.8"
        height="22.2"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <rect
        x="9"
        y="10.1"
        width="22.6"
        height="22.6"
        rx="2.6"
        fill="var(--logo-bg, #160102)"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M9.6 10.7h13v12.6h-13z M12.4 12.8v8.4h2.2v-5.2l3.6 5.2h2.1v-8.4h-2.1V18l-3.6-5.2z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}
