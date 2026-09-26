'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import styles from './purpose.module.css'

/**
 * "Bỏ qua, làm sau" (DEC-WF01-S05-D3 as amended by DEC-WF01-RESUME-D1):
 * skips THIS step only. No intent is created; the server records that the
 * Purpose step is done (`{ action: "SKIP" }`), so a returning user resumes
 * at S06. Moves on only after the server confirms.
 */

/** Copy for a state the approved bitmap does not show; pending design copy review. */
const FAILED = 'Chưa lưu được. Vui lòng thử lại.'

export function SkipPurpose() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)

  async function skip() {
    if (inFlight.current) return
    inFlight.current = true
    setFailed(false)
    try {
      await apiRequest('/me/onboarding/intent', { method: 'PUT', body: { action: 'SKIP' } })
      router.push('/onboarding/profile')
    } catch {
      inFlight.current = false
      setFailed(true)
    }
  }

  return (
    <>
      {failed ? (
        <span role="alert" className={`type-meta-xs ${styles.skipError}`}>
          {FAILED}
        </span>
      ) : null}
      <button
        type="button"
        className={`type-meta-xs weight-medium ${styles.skip}`}
        onClick={() => void skip()}
      >
        Bỏ qua, làm sau
      </button>
    </>
  )
}
