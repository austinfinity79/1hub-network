import styles from './page-skeleton.module.css'

/**
 * PAGE-TRANSITION-SKELETON-01 — the one skeleton of the primary public routes:
 * the directories' route `loading.tsx` (DiscoveryLoading) and the client
 * navigation overlay (RouteSkeleton) for home, About, startup and founder
 * pages; shown at once on navigation, replaced as soon as the page arrives. No artificial delay, no spinner, no
 * client JavaScript. Each kind draws the destination's own frame — the header
 * bar in its tone and the first screen's blocks at their real geometry — so
 * the page does not jump when the content replaces it.
 */

export type SkeletonKind = 'home' | 'about' | 'directory' | 'startup' | 'founder'

function Bone({ className = '' }: { className?: string }) {
  return <span className={`${styles.bone} ${className}`} aria-hidden="true" />
}

function HeaderBones({ tone }: { tone: 'dark' | 'light' }) {
  return (
    <div className={`${styles.header} ${tone === 'light' ? styles.headerLight : ''}`}>
      <Bone className={styles.logo} />
      <span className={styles.nav}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className={styles.navItem} />
        ))}
      </span>
      <span className={styles.navEnd}>
        <Bone className={styles.navItem} />
        <Bone className={styles.navCta} />
      </span>
    </div>
  )
}

function Lines({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={styles.lines}>
      {Array.from({ length: n }, (_, i) => (
        <Bone key={i} className={`${styles.line} ${className}`} />
      ))}
    </span>
  )
}

function Home() {
  return (
    <>
      <section className={`${styles.dark} ${styles.homeHero}`}>
        <HeaderBones tone="dark" />
        <div className={styles.homeCanvas}>
          <span className={styles.homeCopy}>
            <Bone className={styles.eyebrow} />
            <Lines n={3} className={styles.titleLine} />
            <Lines n={2} />
          </span>
          <Bone className={styles.homeArt} />
          <span className={styles.homeFoot}>
            <Bone className={styles.search} />
            <span className={styles.pills}>
              <Bone className={styles.pill} />
              <Bone className={styles.pill} />
              <Bone className={styles.pillWide} />
            </span>
          </span>
        </div>
      </section>
      <div className={styles.ticker}>
        <Bone className={styles.tickerLine} />
      </div>
    </>
  )
}

function About() {
  return (
    <section className={`${styles.dark} ${styles.aboutHero}`}>
      <HeaderBones tone="dark" />
      <div className={styles.aboutBody}>
        <Bone className={styles.eyebrow} />
        <Lines n={2} className={styles.bigLine} />
        <Lines n={3} />
        <span className={styles.stats}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className={styles.stat} />
          ))}
        </span>
      </div>
    </section>
  )
}

function Directory({ eyebrow }: { eyebrow?: string }) {
  return (
    <>
      <section className={`${styles.dark} ${styles.dirHero}`}>
        <HeaderBones tone="dark" />
        <div className={styles.dirHeroBody}>
          {eyebrow ? (
            <p className={styles.dirEyebrow}>{eyebrow}</p>
          ) : (
            <Bone className={styles.eyebrowCenter} />
          )}
          <Bone className={styles.dirTitle} />
          <Bone className={styles.dirSearch} />
          <span className={styles.pills}>
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className={styles.chip} />
            ))}
          </span>
        </div>
      </section>
      <div className={styles.dirBody}>
        <span className={styles.dirRail}>
          <Lines n={6} />
        </span>
        <span className={styles.grid}>
          {[0, 1, 2].map((i) => (
            <Bone key={i} className={styles.card} />
          ))}
        </span>
      </div>
    </>
  )
}

function Startup() {
  return (
    <>
      <HeaderBones tone="light" />
      <div className={styles.startup}>
        <Bone className={styles.back} />
        <span className={styles.startupHead}>
          <span className={styles.startupId}>
            <Bone className={styles.startupLogo} />
            <Bone className={styles.startupName} />
          </span>
          <Lines n={2} />
        </span>
        <span className={styles.tabs}>
          <Bone className={styles.tab} />
          <Bone className={styles.tab} />
          <Bone className={styles.tab} />
        </span>
        <span className={styles.split}>
          <span className={styles.stack}>
            <Bone className={styles.block} />
            <Bone className={styles.block} />
          </span>
          <span className={styles.stack}>
            <Bone className={styles.railBlock} />
            <Bone className={styles.railBlock} />
          </span>
        </span>
      </div>
    </>
  )
}

function Founder() {
  return (
    <>
      <div className={styles.dark}>
        <HeaderBones tone="dark" />
      </div>
      <div className={styles.founder}>
        <span className={styles.stack}>
          <span className={styles.founderHero}>
            <span className={styles.founderCover} />
            <Bone className={styles.founderAvatar} />
            <span className={styles.founderText}>
              <Bone className={styles.startupName} />
              <Lines n={2} />
            </span>
          </span>
          <Bone className={styles.block} />
        </span>
        <span className={styles.stack}>
          <Bone className={styles.railBlock} />
        </span>
      </div>
    </>
  )
}

const KINDS: Record<SkeletonKind, (props: { eyebrow?: string }) => React.JSX.Element> = {
  home: Home,
  about: About,
  directory: Directory,
  startup: Startup,
  founder: Founder,
}

/** `eyebrow`: the directory's own label (known before any data), drawn as text. */
export function PageSkeleton({ kind, eyebrow }: { kind: SkeletonKind; eyebrow?: string }) {
  const Body = KINDS[kind]
  return (
    <div className={styles.page} data-skeleton={kind} aria-busy="true">
      <p className={styles.srOnly} role="status">
        Đang tải…
      </p>
      <Body eyebrow={eyebrow} />
    </div>
  )
}
