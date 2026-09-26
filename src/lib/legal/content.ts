import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { query } from '@/lib/db/client'
import { devRoutesEnabled } from '@/lib/dev-routes'

/**
 * Legal document content behind `content_url` (05 §4.5).
 *
 * The document row (type, version, title, content_uri) is data; the TEXT is
 * release content, read from `${LEGAL_CONTENT_DIR}/<TYPE>.<version>.md`.
 * Nothing here writes legal prose. Without LEGAL_CONTENT_DIR a production
 * server has no content and answers 404 — release blocker
 * PRODUCTION_LEGAL_CONTENT_REQUIRED. Dev/test servers (ENABLE_DEV_ROUTES) fall
 * back to the clearly marked non-production fixtures in content/legal-fixtures.
 */
function contentDir(): string | null {
  const configured = process.env.LEGAL_CONTENT_DIR
  if (configured) return path.resolve(process.cwd(), configured)
  return devRoutesEnabled() ? path.resolve(process.cwd(), 'content/legal-fixtures') : null
}

export type LegalContent = {
  title: string
  version: string
  effective_at: Date
  current: boolean
  paragraphs: string[]
}

export async function readLegalContent(contentUri: string): Promise<LegalContent | null> {
  const [doc] = await query<{
    type: string
    version: string
    title: string
    effective_at: Date
    current: boolean
  }>(
    `SELECT document_type::text AS type, version, title, effective_at,
            (effective_at <= now() AND retired_at IS NULL) AS current
       FROM legal_documents WHERE content_uri = $1`,
    [contentUri],
  )
  const dir = contentDir()
  if (!doc || !dir || !/^[\w.-]+$/.test(doc.version)) return null
  const text = await readFile(path.join(dir, `${doc.type}.${doc.version}.md`), 'utf8').catch(
    () => null,
  )
  if (text === null) return null
  return {
    title: doc.title,
    version: doc.version,
    effective_at: doc.effective_at,
    current: doc.current,
    paragraphs: text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
  }
}
