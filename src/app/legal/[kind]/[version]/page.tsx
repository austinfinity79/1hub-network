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

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; version: string }>
}) {
  const { kind, version } = await params
  const content = await readLegalContent(`/legal/${kind}/${version}`)
  if (!content) notFound()

  return (
    <PageContainer>
      <div className={styles.page}>
        <Surface as="article">
          <h1 className="type-heading-2">{content.title}</h1>
          <p className={`type-meta-xs ${styles.meta}`}>
            Phiên bản {content.version}
            {content.current ? null : ' · không còn hiệu lực'}
          </p>
          {content.paragraphs.map((text, i) => (
            <p key={i} className={`type-body-md ${styles.paragraph}`}>
              {text}
            </p>
          ))}
        </Surface>
      </div>
    </PageContainer>
  )
}
