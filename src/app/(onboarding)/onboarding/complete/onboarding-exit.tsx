'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { readReturnPath, rememberReturnPath } from '@/lib/auth/return-path'

/**
 * ACC-10's exit. The account home by default (DEC-WF01-S08-D6); when the
 * member signed in from an action that asked to come back (BD-02 return-to
 * rule, carried in this tab by the auth callback), the exit continues there
 * instead. The carried path is read after mount: sessionStorage only exists in
 * the browser.
 */
export function OnboardingExit() {
  const [back, setBack] = useState<string | null>(null)
  useEffect(() => {
    setBack(readReturnPath(window.sessionStorage))
  }, [])
  if (!back)
    return (
      <Link href="/me" data-nav="exit-me">
        Vào Tài khoản của tôi
      </Link>
    )
  return (
    <Link
      href={back}
      data-nav="exit-return"
      onClick={() => rememberReturnPath(window.sessionStorage, null)}
    >
      Tiếp tục
    </Link>
  )
}
