import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StartupFrame } from '@/components/startup/startup-frame'
import { UpdatesPanel } from '@/components/startup/updates-panel'
import { startupPageData } from '@/lib/startup/page-data'
import { readUpdates } from '@/lib/startup/updates'

/**
 * THAO-06 — `/products/[slug]/updates`, tab Cập nhật (DEC-THAO-SP-D3, D10):
 * the venture's manual posts, newest first; the composer and the edit / delete
 * controls for the owner and editors only. 404 as Tổng quan.
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Cập nhật — Sản phẩm · HUB Network' }

export default async function StartupUpdatesPage({ params }: Params) {
  const data = await startupPageData((await params).slug)
  if (!data) notFound()
  const updates = await readUpdates(data.access)
  return (
    <StartupFrame
      shell={data.shell}
      startup={data.startup}
      tab="updates"
      following={data.following}
    >
      <UpdatesPanel slug={data.startup.slug} initial={updates} />
    </StartupFrame>
  )
}
