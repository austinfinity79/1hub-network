'use client'

import buttons from '@/components/programme-demo/demo-buttons.module.css'
import { DemoPage } from '@/components/programme-demo/demo-page'
import styles from '@/components/programme-demo/journey.module.css'

/**
 * WF04-PROD-04 — a programme page whose server read failed (contract §16, API
 * error with retry). Never shows the raw error; "Thử lại" renders it again.
 */
export default function ProgrammeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <DemoPage title="Chưa tải được dữ liệu">
      <div className={styles.missing} role="alert" data-state="setup-read-failed">
        <p className="type-body-sm">Chưa tải được chương trình. Vui lòng thử lại.</p>
        <button
          type="button"
          className={`weight-medium ${buttons.secondary}`}
          onClick={reset}
          data-action="reread"
        >
          Thử lại
        </button>
      </div>
    </DemoPage>
  )
}
