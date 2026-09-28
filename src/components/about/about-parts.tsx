import Image from 'next/image'

import { SCALE_RING, type PhotoAsset } from './about-data'
import { dust, ring } from './about-geometry'
import styles from './about.module.css'

/**
 * A photo slot. With `photo` it shows the real image (cover, inside the same
 * frame; the tone stays behind it while it loads). Without one it keeps the
 * pack's labelled placeholder (gradient + "▭ ẢNH · …" caption).
 */
export function Photo({
  caption,
  tone,
  rounded = true,
  photo,
  sizes,
  priority = false,
}: {
  caption: string
  tone: 'warm' | 'deep' | 'dark' | 'pale' | 'mauve'
  rounded?: boolean
  photo?: PhotoAsset | null
  /** Rendered width hint for the responsive srcset. */
  sizes?: string
  /** Above the fold only (the hero); every other photo lazy-loads. */
  priority?: boolean
}) {
  if (photo) {
    return (
      <div
        className={`${styles.photo} ${styles[`photo_${tone}`]} ${rounded ? styles.photoRounded : ''}`}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes ?? '100vw'}
          priority={priority}
          className={styles.photoImg}
          style={photo.focus ? { objectPosition: photo.focus } : undefined}
        />
      </div>
    )
  }
  return (
    <div
      className={`${styles.photo} ${styles[`photo_${tone}`]} ${rounded ? styles.photoRounded : ''}`}
      role="img"
      aria-label={`Ảnh minh hoạ — ${caption.replace(/^ẢNH · /, '').toLowerCase()}`}
    >
      <span className={styles.photoCaption} aria-hidden="true">
        <span className={styles.photoGlyph} />
        {caption}
      </span>
    </div>
  )
}

/** Section 04 ring: HUB Tổng at the centre, the 13 member slots around it. */
export function ScaleRing({ className }: { className?: string }) {
  const C = { x: 300, y: 300 }
  const nodes = ring(C.x, C.y, 171, SCALE_RING.length, -90 - 360 / SCALE_RING.length)
  const specks = dust(C.x, C.y, 208, 250, 90, 4)
  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      role="img"
      aria-label="HUB Tổng kết nối 13 HUB thành viên"
    >
      <g className={styles.ringDust}>
        {specks.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
      <circle cx={C.x} cy={C.y} r={171} className={styles.ringTrack} />
      <circle cx={C.x} cy={C.y} r={107} className={styles.ringTrack} />
      {nodes.map((n, i) => (
        <line key={`l${i}`} x1={C.x} y1={C.y} x2={n.x} y2={n.y} className={styles.ringSpoke} />
      ))}
      <circle cx={C.x} cy={C.y} r={56} className={styles.ringCore} />
      <text x={C.x} y={C.y + 4} className={styles.ringCoreTitle} textAnchor="middle">
        HUB Tổng
      </text>
      <text x={C.x} y={C.y + 20} className={styles.ringCoreSub} textAnchor="middle">
        HUB NETWORK
      </text>
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <circle
            cx={n.x}
            cy={n.y}
            r={17}
            className={SCALE_RING[i] === '?' ? styles.ringNodeOpen : styles.ringNode}
          />
          <text x={n.x} y={n.y + 4} className={styles.ringNodeText} textAnchor="middle">
            {SCALE_RING[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}
