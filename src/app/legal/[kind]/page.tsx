import { notFound, redirect } from 'next/navigation'

import { getCurrentDocuments } from '@/lib/legal/legal'

/**
 * /legal/<kind> without a version, e.g. /legal/terms (DEC-LEGAL-D2). Public.
 * Redirects to the content_url of the current document of that kind, so the
 * address never names a version the server does not hold; 404 when no current
 * document matches.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  const documents = await getCurrentDocuments()
  const doc = documents.find((d) => d.content_url.startsWith(`/legal/${kind}/`))
  if (!doc) notFound()
  redirect(doc.content_url)
}
