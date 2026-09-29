import { createVenture, type VentureDTO, type VentureType } from './venture'

/**
 * Venture fixtures for suites whose subject is not the venture record itself.
 * A venture is created through the real service with the fields DEC-L2R-D4
 * requires; ids are the deterministic seed's and the reference rows of
 * migration 011.
 */
export const VENTURE_REF = {
  domain: '20000000-0000-0000-0000-000000000011',
  stage: '23000000-0000-0000-0000-000000000001',
} as const

export const VENTURE_CORE = {
  summary: 'Mô tả một dòng',
  domain_ids: [VENTURE_REF.domain],
  stage_id: VENTURE_REF.stage,
} as const

export function seedVenture(
  accountId: string,
  body: { type: VentureType; name: string } & Record<string, unknown>,
): Promise<VentureDTO> {
  return createVenture(accountId, { ...VENTURE_CORE, ...body }, 'req-venture-fixture')
}
