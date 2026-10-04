import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { CategoriesEditor } from './categories-editor'

/** ADMIN-PROD-06 — /ops/admin/categories (05 §28, A11): label / order / archive-activate. */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('vocabulary:manage')) notFound()
  return <CategoriesEditor />
}
