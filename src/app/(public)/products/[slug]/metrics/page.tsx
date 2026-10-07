import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MetricsPanel } from '@/components/startup/metrics-panel'
import { StartupFrame } from '@/components/startup/startup-frame'
import { currentQuarter, readMetrics } from '@/lib/startup/metrics'
import { startupPageData } from '@/lib/startup/page-data'

/**
 * THAO-06 — `/products/[slug]/metrics`, tab Chỉ số (DEC-THAO-SP-D2, D10). The
 * server reads the metrics this viewer may see (PUBLIC; PRIVATE too for the
 * owner and editors) and decides whether the editor shows. 404 as Tổng quan.
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Chỉ số — Sản phẩm · HUB Network' }

export default async function StartupMetricsPage({ params }: Params) {
  const data = await startupPageData((await params).slug)
  if (!data) notFound()
  const metrics = await readMetrics(data.access)
  const now = currentQuarter()
  return (
    <StartupFrame
      shell={data.shell}
      startup={data.startup}
      tab="metrics"
      following={data.following}
    >
      <MetricsPanel
        slug={data.startup.slug}
        initial={metrics}
        thisYear={now.year}
        thisQuarter={now.quarter}
      />
    </StartupFrame>
  )
}
