import type { Metadata } from 'next'

import { AuthSplitLayout } from '@/components/shell/auth-split-layout'
import { PASSWORD_RESET_EXPIRES_IN_SECONDS } from '@/lib/auth/config'

import { ResetPasswordCard } from './reset-password-card'

/**
 * WF01-S11 — /auth/reset-password#token=<opaque> (S1-UAT-01, US-01.04 steps
 * 4-5, DEC-S1A-D5). "Đặt mật khẩu mới" + "Nhập lại", then "Đã đổi mật khẩu" →
 * Đăng nhập. Same AUTH1/AUTH2 shell and card; no new design.
 *
 * The token is in the FRAGMENT, which the browser never sends to a server, and
 * the page is static, so no request log, proxy or server-rendered HTML ever
 * holds it. The card reads it once, strips it from the address bar, and posts it.
 */
export const metadata: Metadata = { referrer: 'no-referrer' }

export const dynamic = 'force-static'

export default function Page() {
  return (
    <AuthSplitLayout>
      <ResetPasswordCard expiresInMinutes={PASSWORD_RESET_EXPIRES_IN_SECONDS / 60} />
    </AuthSplitLayout>
  )
}
