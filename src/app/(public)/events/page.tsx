import type { Metadata } from 'next'

import { EventDirectory } from '@/components/events/event-directory'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { publicShellData } from '@/lib/public/shell-data'

import styles from '@/components/discovery/discovery.module.css'
import events from '@/components/events/events.module.css'

/**
 * S2-PROGRAMME-EVENT-CONTENT-01 — `/events` (DM07 "Sự kiện"), the public
 * event list: the PO's event sheet only (programme-event-source.ts), upcoming
 * and past. Public for every visitor; no registration, calendar or detail
 * entry exists in the source, so none is drawn.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sự kiện — HUB Network',
  description: 'Sự kiện của HUB Network và các HUB Chapter.',
}

export default async function EventsPage() {
  const shell = await publicShellData()
  return (
    <div className={styles.page} data-screen="PUBLIC-EVENTS" data-revision="DM07">
      {/* S2-EVENT-REDESIGN-01: the homepage's header and approved logo (dark
          tone, transparent) on a dark bar, as the founder page draws it. */}
      <div className={events.bar}>
        <PublicHeader viewer={shell.viewer} current="programmes" />
      </div>
      <EventDirectory />
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
