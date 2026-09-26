import { listEnvelope, parseListQuery } from '@/lib/api/envelope'
import { notFound } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import {
  isVocabularyType,
  listVocabularyItems,
  type VocabularyStatus,
} from '@/lib/vocabulary/vocabulary'

/**
 * GET /api/v1/vocabularies/{type} — 05 §7. Public (YAML `security: []`).
 * `type` is REGION | DOMAIN | SKILL; `?q=&status=ACTIVE&cursor=&limit=`.
 * Status defaults to ACTIVE, the only selectable state; ARCHIVED may be listed
 * for display of historical relations.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const type = new URL(request.url).pathname.split('/').pop()
  if (!isVocabularyType(type)) throw notFound()

  const params = new URL(request.url).searchParams
  const { cursor, limit } = parseListQuery(params)
  const status: VocabularyStatus = params.get('status') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
  const { items, nextCursor } = await listVocabularyItems(type, {
    q: params.get('q') ?? undefined,
    status,
    cursor,
    limit,
  })
  return listEnvelope(items, { nextCursor, limit })
})
