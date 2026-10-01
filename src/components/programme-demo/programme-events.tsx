'use client'

import { formatEventWhen } from '@/lib/programme-demo/event-time'
import { programmeEvents } from '@/lib/programme-demo/programme-events'
import { demoRoutes } from '@/lib/programme-demo/routes'
import type { ProgrammeDetailDTO } from '@/lib/programme/types'
import type { ProgrammeScreen } from '@/lib/programme/view'

import styles from './journey.module.css'
import { SetupScreen } from './setup-screen'
import { EventStatusPill } from './status-pill'

/**
 * WF04-S04 — events of the current Programme / Challenge (DEC-WF04-S04-D1..D3;
 * WF04-PROD-04, PO decision 2). READ ONLY: the canonical events whose
 * `programme_id` is this programme, as the API returns them. WF04 creates,
 * edits and removes no event; the Event lifecycle stays WF03's. Back → the
 * journey; "Tiếp theo" opens WF04-S05 (DEC-WF04-S05-D3).
 */

const COPY = {
  back: '← Hành trình',
  events: 'Sự kiện',
  eventsHint: 'Sự kiện thuộc chương trình này. Giờ Việt Nam (UTC+7).',
  none: 'Chưa có sự kiện nào.',
  noTime: 'Chưa có thời gian',
} as const

export function ProgrammeEvents({ id, initial }: { id: string; initial: ProgrammeDetailDTO }) {
  return (
    <SetupScreen
      initial={initial}
      step="events"
      screen="WF04-S04"
      back={{ href: demoRoutes.setup(id, 'journey'), label: COPY.back, nav: 'events-back' }}
      next={demoRoutes.setup(id, 'registration')}
    >
      {({ detail }) => <EventsBody detail={detail} />}
    </SetupScreen>
  )
}

function EventsBody({ detail }: { detail: ProgrammeScreen }) {
  const events = programmeEvents(detail)
  return (
    <section className={styles.card} aria-labelledby="programme-events" data-programme-events>
      <header className={styles.cardHead}>
        <div>
          <h2 id="programme-events" className={`weight-semibold ${styles.cardTitle}`}>
            {COPY.events}
          </h2>
          <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.eventsHint}</p>
        </div>
      </header>
      {events.length === 0 ? (
        <p className={`type-body-sm ${styles.empty}`} data-state="events-empty">
          {COPY.none}
        </p>
      ) : (
        <ul className={styles.list} aria-label={COPY.events}>
          {events.map((event) => (
            <li
              key={event.id}
              className={styles.item}
              data-event-id={event.id}
              data-status={event.status}
            >
              <div className={styles.main}>
                <p className={`type-body-sm weight-semibold ${styles.name}`}>{event.name}</p>
                <p className={`type-meta-xs ${styles.meta}`}>
                  {[
                    formatEventWhen(event.starts_at, event.ends_at) ?? COPY.noTime,
                    event.location_text,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <EventStatusPill status={event.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
