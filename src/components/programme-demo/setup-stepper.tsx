import { SETUP_STEPS, type SetupStep } from '@/lib/programme-demo/routes'

import styles from './setup-stepper.module.css'

/** The frozen WF04 setup order (Master Spec §4 steps 3–8). */
export const SETUP_STEP_LABEL: Record<SetupStep, string> = {
  basic: 'Thông tin cơ bản',
  journey: 'Hành trình',
  events: 'Sự kiện',
  registration: 'Đăng ký',
  team: 'Đội vận hành',
  review: 'Rà soát',
}

/** WF04 — where the current screen sits in the setup; information only, no links. */
export function SetupStepper({ current }: { current: SetupStep }) {
  return (
    <ol
      className={`type-meta-xs ${styles.steps}`}
      aria-label="Các bước thiết lập"
      data-setup-stepper
    >
      {SETUP_STEPS.map((step, i) => {
        const on = step === current
        return (
          <li
            key={step}
            className={`${styles.step} ${on ? `${styles.current} weight-medium` : ''}`}
            aria-current={on ? 'step' : undefined}
            data-step={step}
          >
            <span className={`type-meta-xs weight-semibold ${styles.number}`}>{i + 1}</span>
            {SETUP_STEP_LABEL[step]}
          </li>
        )
      })}
    </ol>
  )
}
