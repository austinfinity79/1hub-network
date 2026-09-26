'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { SessionDTO } from '@/lib/api/types'
import type { NetworkDTO } from '@/lib/network/network'
import type { OwnProfileDTO } from '@/lib/profile/profile'

import { completionSummary, orgRows, type CompletionView } from './home-model'
import styles from './account-home.module.css'

/**
 * WF02-S01 — Account Home body (/me), inside the T00 member shell.
 * Approved baseline: design-reference/final/WF02/WF02-S01__account-home__1440x900.png
 * Decisions DEC-WF02-H3/H9/H10/H13 and DEC-WF02-S01-D1..D6.
 *
 * Read-only. Everything shown comes from the canonical owner APIs:
 * /session (own email), /me/profile, /me/profile/completion (the one
 * completion service) and /me/network. Nothing is computed or inferred here.
 * The "Đang chờ bạn" block and the public-profile button are not rendered
 * (no canonical source; no public profile in P0).
 */

type ProfileState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'ready'
      email: string
      name: string
      avatarUrl: string | null
      completion: CompletionView
    }

type NetworkState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; network: NetworkDTO }

/** Copy the approved bitmap does not carry verbatim; pending PO copy review (DEC-WF02-S01-D2). */
const COPY = {
  lede: 'Ba nhánh: hồ sơ, quyền riêng tư, cài đặt.',
  loginMethod: 'đăng nhập bằng email',
  finish: 'Điền nốt',
  anytime: 'Bạn có thể cập nhật hồ sơ bất cứ lúc nào.',
  profileFailed: 'Không tải được thông tin hồ sơ.',
  networkFailed: 'Không tải được tổ chức của bạn.',
  networkEmpty: 'Bạn chưa thuộc tổ chức hay dự án nào.',
  retry: 'Thử lại',
} as const

const NAV_CARDS = [
  {
    title: 'Hồ sơ cá nhân',
    body: 'Tên, chức danh, chuyên môn, kinh nghiệm',
    action: 'Sửa hồ sơ',
    href: '/me/profile/edit',
  },
  {
    title: 'Quyền riêng tư & hiển thị',
    body: 'Ai thấy gì · lịch sử đồng ý',
    action: 'Mở',
    href: '/me/privacy',
  },
  {
    title: 'Cài đặt tài khoản',
    body: 'Phiên đăng nhập, yêu cầu xoá tài khoản',
    action: 'Mở',
    href: '/me/settings',
  },
] as const

type Completion = { percent: number; groups: CompletionView['groups'] }

function Arrow() {
  // Deterministic glyph, not a font arrow.
  return (
    <svg className={styles.arrow} viewBox="0 0 10 8" aria-hidden="true" focusable="false">
      <path d="M0 4h8.6M5.6 1l3 3-3 3" />
    </svg>
  )
}

export function AccountHome() {
  const [profile, setProfile] = useState<ProfileState>({ kind: 'loading' })
  const [network, setNetwork] = useState<NetworkState>({ kind: 'loading' })

  const loadProfile = useCallback(async () => {
    setProfile({ kind: 'loading' })
    try {
      const [session, own, completion] = await Promise.all([
        apiRequest<SessionDTO>('/session'),
        apiRequest<OwnProfileDTO>('/me/profile'),
        apiRequest<Completion>('/me/profile/completion'),
      ])
      if (!session.authenticated) throw new Error('signed out')
      const avatarStored = completion.groups.some((g) => g.code === 'AVATAR' && g.complete)
      setProfile({
        kind: 'ready',
        email: session.account.email,
        name: own.display_name ?? '',
        // Only a stored, valid avatar counts (the completion service decides).
        avatarUrl: avatarStored && own.avatar ? own.avatar.url : null,
        completion: { percent: completion.percent, groups: completion.groups },
      })
    } catch {
      setProfile({ kind: 'failed' })
    }
  }, [])

  const loadNetwork = useCallback(async () => {
    setNetwork({ kind: 'loading' })
    try {
      setNetwork({ kind: 'ready', network: await apiRequest<NetworkDTO>('/me/network') })
    } catch {
      setNetwork({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void loadProfile()
    void loadNetwork()
  }, [loadProfile, loadNetwork])

  return (
    <div className={styles.page}>
      <h1 className={`type-heading-2 ${styles.title}`}>Tài khoản của tôi</h1>
      <p className={`type-body-md ${styles.lede}`}>{COPY.lede}</p>

      <div className={styles.profileCard} aria-busy={profile.kind === 'loading'}>
        <Surface as="section">
          {profile.kind === 'failed' ? (
            <div className={styles.failed} role="alert" data-state="profile-failed">
              <p className="type-body-sm">{COPY.profileFailed}</p>
              <button
                type="button"
                className={`type-body-sm ${styles.retry}`}
                onClick={loadProfile}
              >
                {COPY.retry}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.identity}>
                <span className={styles.avatar}>
                  {profile.kind === 'ready' && profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, session-authorised media route
                    <img src={profile.avatarUrl} alt="" />
                  ) : null}
                </span>
                <div className={styles.who}>
                  <h2 className={`type-subtitle weight-medium ${styles.name}`}>
                    {profile.kind === 'ready' ? profile.name : ''}
                  </h2>
                  <p className={`type-meta-xs ${styles.email}`}>
                    {profile.kind === 'ready' ? `${profile.email} · ${COPY.loginMethod}` : ''}
                  </p>
                </div>
              </div>
              <div
                className={styles.bar}
                role="progressbar"
                aria-label="Mức hoàn thiện hồ sơ"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={profile.kind === 'ready' ? profile.completion.percent : undefined}
              >
                <span
                  className={styles.barFill}
                  style={{
                    width: `${profile.kind === 'ready' ? profile.completion.percent : 0}%`,
                  }}
                />
              </div>
              <div className={styles.summaryRow}>
                <p className={`type-body-sm weight-medium ${styles.summary}`} data-completion>
                  {profile.kind === 'ready' ? completionSummary(profile.completion) : ''}
                </p>
                {profile.kind === 'ready' && profile.completion.percent < 100 ? (
                  <Link
                    href="/me/profile/edit"
                    className={`type-body-sm weight-medium ${styles.link}`}
                  >
                    {COPY.finish} <Arrow />
                  </Link>
                ) : null}
              </div>
              <p className={`type-meta-xs ${styles.muted}`}>{COPY.anytime}</p>
            </>
          )}
        </Surface>
      </div>

      <nav className={styles.navGrid} aria-label="Tài khoản">
        {NAV_CARDS.map((card) => (
          <Surface key={card.href} as="article">
            <h2 className={`type-section-sm weight-medium ${styles.cardTitle}`}>{card.title}</h2>
            <p className={`type-body-sm ${styles.cardBody}`}>{card.body}</p>
            <Link href={card.href} className={`type-body-sm weight-medium ${styles.link}`}>
              {card.action} <Arrow />
            </Link>
          </Surface>
        ))}
      </nav>

      <div className={styles.lowerGrid}>
        <div className={styles.orgCard} aria-busy={network.kind === 'loading'}>
          <Surface as="section">
            <h2 className={`weight-semibold ${styles.eyebrow}`}>TỔ CHỨC CỦA TÔI</h2>
            {network.kind === 'failed' ? (
              <div className={styles.failed} role="alert" data-state="network-failed">
                <p className="type-body-sm">{COPY.networkFailed}</p>
                <button
                  type="button"
                  className={`type-body-sm ${styles.retry}`}
                  onClick={loadNetwork}
                >
                  {COPY.retry}
                </button>
              </div>
            ) : network.kind === 'ready' ? (
              orgRows(network.network).length === 0 ? (
                <p className={`type-body-sm ${styles.muted}`} data-state="network-empty">
                  {COPY.networkEmpty}
                </p>
              ) : (
                <ul className={styles.orgList}>
                  {orgRows(network.network).map((row) => (
                    <li key={row.key}>
                      <Link href={row.href} className={styles.orgRow}>
                        <span>
                          <span className={`type-body-md ${styles.orgName}`}>{row.name}</span>
                          <span className={`type-meta-xs ${styles.orgDetail}`}>{row.detail}</span>
                        </span>
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </Surface>
        </div>
      </div>
    </div>
  )
}
