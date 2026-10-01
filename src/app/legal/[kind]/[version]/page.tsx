import { notFound } from 'next/navigation'

import { PageContainer } from '@/components/shell/page-container'
import { Surface } from '@/components/ui'
import { readLegalContent } from '@/lib/legal/content'

import styles from './legal.module.css'

/**
 * The `content_url` of a legal document (05 §4.5), e.g. /legal/terms/<version>.
 * Public. Renders the release-provided text for the document row whose
 * content_uri matches; 404 when the row or its content is missing.
 */
export const dynamic = 'force-dynamic'

// The two documents stay separate; the reader links both so the one combined
// acceptance link (DEC-LEGAL-V1-D5) reaches either. Version-less routes always
// resolve to the current version (DEC-LEGAL-D2).
const DOCUMENTS = [
  { kind: 'terms', label: 'Điều khoản sử dụng' },
  { kind: 'privacy', label: 'Chính sách quyền riêng tư' },
] as const

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; version: string }>
}) {
  const { kind, version } = await params
  const content = await readLegalContent(`/legal/${kind}/${version}`)
  if (!content) notFound()

  // The release file may carry its own title and metadata line (verbatim from
  // the source); otherwise the document row's title and version are shown.
  const title = content.blocks.find((b) => b.kind === 'title')?.text ?? content.title
  const meta = content.blocks.find((b) => b.kind === 'meta')?.text ?? `Phiên bản ${content.version}`

  return (
    <PageContainer>
      <div className={styles.page}>
        <nav className={styles.switcher} aria-label="Văn bản pháp lý" data-legal-switcher>
          {DOCUMENTS.map((doc) => (
            <a
              key={doc.kind}
              href={`/legal/${doc.kind}`}
              className={`type-body-sm ${styles.switch}`}
              aria-current={doc.kind === kind ? 'page' : undefined}
            >
              {doc.label}
            </a>
          ))}
        </nav>
        <Surface as="article">
          <h1 className="type-heading-2">{title}</h1>
          <p className={`type-meta-xs ${styles.meta}`}>
            {meta}
            {content.current ? null : ' · không còn hiệu lực'}
          </p>
          {content.blocks.map((block, i) => {
            if (block.kind === 'title' || block.kind === 'meta') return null
            if (block.kind === 'heading') {
              return (
                <h2 key={i} id={block.id} className={`type-subtitle ${styles.heading}`}>
                  <a href={`#${block.id}`} className={styles.anchor}>
                    {block.text}
                  </a>
                </h2>
              )
            }
            return (
              <p key={i} className={`type-body-md ${styles.paragraph}`}>
                {block.text}
              </p>
            )
          })}
        </Surface>
      </div>
    </PageContainer>
  )
}
