import { withApi } from '@/lib/api/handler'
import { getCurrentDocuments } from '@/lib/legal/legal'

/**
 * GET /api/v1/legal/current — 05 §4.5. Public (YAML `security: []`).
 * The currently required documents, read from `legal_documents`; versions are
 * release configuration, never client constants (DEC-WF01-S07-D8).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async () => ({ documents: await getCurrentDocuments() }))
