import { ApiError, notFound } from '@/lib/api/errors'
import { query, type Executor } from '@/lib/db/client'
import { writeAudit } from '@/lib/audit/audit'

/**
 * Required legal acceptance (Data Freeze D4; API 05 §4.5; DEC-WF01-S07-D1/D8).
 *
 * Two canonical types, each its own versioned document and its own
 * ConsentRecord, never one boolean. The current document of a type is the one
 * with the latest `effective_at <= now()` that is not retired; versions are
 * data (release configuration), never code.
 */

export const LEGAL_TYPES = ['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'] as const
export type LegalType = (typeof LEGAL_TYPES)[number]

export type LegalDocumentDTO = {
  type: LegalType
  version: string
  title: string
  required: true
  content_url: string
}

/** 05 §11.2. `status` is derived; raw metadata never leaves the server. */
export type ConsentRecordDTO = {
  id: string
  type: LegalType
  policy_version: string
  status: 'ACCEPTED' | 'REVOKED'
  accepted_at: string
  revoked_at: string | null
}

export function isLegalType(value: unknown): value is LegalType {
  return typeof value === 'string' && (LEGAL_TYPES as readonly string[]).includes(value)
}

type DocRow = { id: string; type: LegalType; version: string; title: string; content_uri: string }

async function currentRows(exec: Executor): Promise<DocRow[]> {
  return exec<DocRow>(
    `SELECT DISTINCT ON (document_type)
            id::text, document_type::text AS type, version, title, content_uri
       FROM legal_documents
      WHERE effective_at <= now() AND retired_at IS NULL
      ORDER BY document_type, effective_at DESC, created_at DESC`,
  )
}

export async function getCurrentDocuments(exec: Executor = query): Promise<LegalDocumentDTO[]> {
  const rows = await currentRows(exec)
  return LEGAL_TYPES.flatMap((type) => {
    const row = rows.find((r) => r.type === type)
    return row
      ? [
          {
            type,
            version: row.version,
            title: row.title,
            required: true as const,
            content_url: row.content_uri,
          },
        ]
      : []
  })
}

type ConsentRow = {
  id: string
  type: LegalType
  policy_version: string
  accepted_at: Date
  withdrawn_at: Date | null
}

const toDTO = (row: ConsentRow): ConsentRecordDTO => ({
  id: row.id,
  type: row.type,
  policy_version: row.policy_version,
  status: row.withdrawn_at ? 'REVOKED' : 'ACCEPTED',
  accepted_at: row.accepted_at.toISOString(),
  revoked_at: row.withdrawn_at?.toISOString() ?? null,
})

const CONSENT_SELECT = `SELECT c.id::text, c.consent_type::text AS type, d.version AS policy_version,
                               c.accepted_at, c.withdrawn_at
                          FROM consent_records c JOIN legal_documents d ON d.id = c.legal_document_id`

/** GET /me/consents: the account's full history, newest first; history is never deleted. */
export async function listConsents(accountId: string): Promise<ConsentRecordDTO[]> {
  const rows = await query<ConsentRow>(
    `${CONSENT_SELECT} WHERE c.account_id = $1 ORDER BY c.accepted_at DESC, c.id`,
    [accountId],
  )
  return rows.map(toDTO)
}

/**
 * Whether each CURRENT required document has a live acceptance. S07 is
 * satisfied, and S08 may complete onboarding, only when both are.
 */
export async function getLegalState(
  accountId: string,
  exec: Executor = query,
): Promise<{
  documents: LegalDocumentDTO[]
  accepted: Record<LegalType, boolean>
  satisfied: boolean
}> {
  const current = await currentRows(exec)
  const documents = await getCurrentDocuments(exec)
  // Matched by document id: a version string alone may repeat across types.
  const rows = await exec<{ type: LegalType }>(
    `SELECT DISTINCT consent_type::text AS type FROM consent_records
      WHERE account_id = $1 AND withdrawn_at IS NULL AND legal_document_id = ANY($2::uuid[])`,
    [accountId, current.map((d) => d.id)],
  )
  const accepted = Object.fromEntries(
    LEGAL_TYPES.map((type) => {
      const current = documents.find((d) => d.type === type)
      return [type, Boolean(current && rows.some((r) => r.type === type))]
    }),
  ) as Record<LegalType, boolean>
  return {
    documents,
    accepted,
    satisfied: documents.length === LEGAL_TYPES.length && LEGAL_TYPES.every((t) => accepted[t]),
  }
}

/**
 * POST /me/consents/accept for one type. The server resolves the current
 * document; a version that is not current is refused with 409
 * LEGAL_DOCUMENT_VERSION_STALE (DEC-WF01-S07-D8). An existing acceptance of
 * the same document is returned, never duplicated (UNIQUE account/type/doc).
 * The timestamp is the server's. A new acceptance writes CONSENT_ACCEPTED.
 */
export async function acceptConsent(
  exec: Executor,
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<{ status: 200 | 201; body: ConsentRecordDTO }> {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const type = input.consent_type
  const current = isLegalType(type)
    ? (await currentRows(exec)).find((row) => row.type === type)
    : undefined
  if (!current) throw notFound()
  if (input.policy_version !== current.version) {
    throw new ApiError(
      'LEGAL_DOCUMENT_VERSION_STALE',
      409,
      'The legal document version is no longer current.',
      { policy_version: 'stale' },
    )
  }

  const [created] = await exec<{ id: string }>(
    `INSERT INTO consent_records (account_id, consent_type, legal_document_id)
     VALUES ($1, $2::consent_type, $3)
     ON CONFLICT (account_id, consent_type, legal_document_id) DO NOTHING
     RETURNING id::text`,
    [accountId, type, current.id],
  )
  if (created) {
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'CONSENT_ACCEPTED',
      resourceType: 'consent_record',
      resourceId: created.id,
      after: { consent_type: type, policy_version: current.version },
      requestId,
    })
  }
  const [row] = await exec<ConsentRow>(
    `${CONSENT_SELECT} WHERE c.account_id = $1 AND c.legal_document_id = $2`,
    [accountId, current.id],
  )
  return { status: created ? 201 : 200, body: toDTO(row!) }
}
