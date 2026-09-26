'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Field, Notice, Surface, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from './profile.module.css'

/**
 * WF01-S06 — onboarding profile form (DEC-WF01-S06-D1..D5).
 *
 * Six fields, as on the approved bitmap: avatar, name, headline, region, bio,
 * "Chuyên môn". Continue needs name, headline, region and one expertise item
 * (D2); avatar and bio are optional. The expertise picker spans DOMAIN and
 * SKILL (D1), at most 5 in total (D4), and saves each id to its own relation.
 * Every rule is re-checked by the server; this is UX only.
 */

export type ExpertiseOption = { id: string; label: string; type: 'DOMAIN' | 'SKILL' }

type Initial = {
  display_name: string
  headline: string
  region_id: string
  bio: string
  avatar_url: string | null
  expertise: string[]
}

type FieldKey = 'display_name' | 'headline' | 'region_id' | 'expertise'

const MAX_EXPERTISE = 5
/** Chips shown before "+ N nhóm khác", as on the approved bitmap. */
const VISIBLE_CHIPS = 7

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  display_name: 'Vui lòng nhập họ và tên.',
  headline: 'Vui lòng nhập chức danh hiện tại.',
  region_id: 'Vui lòng chọn tỉnh / thành phố.',
  expertise: 'Vui lòng chọn ít nhất 1 chuyên môn.',
  inactive: 'Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.',
  invalid: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  failed: 'Chưa lưu được thông tin. Vui lòng thử lại.',
  avatarType: 'Chỉ nhận ảnh PNG, JPEG hoặc WebP.',
  avatarSize: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.',
  avatarFailed: 'Chưa tải được ảnh. Vui lòng thử lại.',
  regionPlaceholder: 'Chọn tỉnh / thành phố',
} as const

export function ProfileForm({
  initial,
  regions,
  expertise,
}: {
  initial: Initial
  regions: { id: string; label: string }[]
  expertise: ExpertiseOption[]
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.display_name)
  const [headline, setHeadline] = useState(initial.headline)
  const [regionId, setRegionId] = useState(initial.region_id)
  const [bio, setBio] = useState(initial.bio)
  const [selected, setSelected] = useState<string[]>(initial.expertise)
  const [expanded, setExpanded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string>()
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Selected items first, in the order the server gave, so none hides behind "+ N".
  const [order] = useState(() => [
    ...expertise.filter((o) => initial.expertise.includes(o.id)),
    ...expertise.filter((o) => !initial.expertise.includes(o.id)),
  ])
  const shown = expanded ? order : order.slice(0, VISIBLE_CHIPS)
  const hidden = order.length - shown.length
  const full = selected.length >= MAX_EXPERTISE
  const regionLabel = regions.find((r) => r.id === regionId)?.label

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < MAX_EXPERTISE
          ? [...current, id]
          : current,
    )
    setErrors((e) => ({ ...e, expertise: undefined }))
  }

  async function onAvatar(file: File | undefined) {
    if (!file || uploading) return
    setUploading(true)
    setAvatarError(undefined)
    const body = new FormData()
    body.append('file', file)
    try {
      const result = await apiRequest<{ asset_id: string; url: string }>('/me/profile/avatar', {
        method: 'POST',
        body,
      })
      setAvatarUrl(result.url)
    } catch (caught) {
      const reason = (caught as { fields?: Record<string, string> } | null)?.fields?.file
      setAvatarError(
        reason === 'unsupported_type'
          ? MESSAGES.avatarType
          : reason === 'too_large'
            ? MESSAGES.avatarSize
            : MESSAGES.avatarFailed,
      )
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const missing: Partial<Record<FieldKey, string>> = {}
    if (!name.trim()) missing.display_name = MESSAGES.display_name
    if (!headline.trim()) missing.headline = MESSAGES.headline
    if (!regionId) missing.region_id = MESSAGES.region_id
    if (selected.length === 0) missing.expertise = MESSAGES.expertise
    setErrors(missing)
    setFormError(undefined)
    if (Object.keys(missing).length > 0) return

    inFlight.current = true
    setSaving(true)
    const typeOf = new Map(expertise.map((o) => [o.id, o.type]))
    try {
      await apiRequest('/me/profile', {
        method: 'PATCH',
        body: {
          display_name: name,
          headline,
          region_id: regionId,
          bio,
          domain_ids: selected.filter((id) => typeOf.get(id) === 'DOMAIN'),
          skill_ids: selected.filter((id) => typeOf.get(id) === 'SKILL'),
        },
      })
      router.push('/onboarding/privacy')
      // Stay busy while navigating, so the mutation cannot repeat.
    } catch (caught) {
      inFlight.current = false
      setSaving(false)
      const code = (caught as { code?: string } | null)?.code
      setFormError(
        code === 'VOCABULARY_ITEM_INACTIVE'
          ? MESSAGES.inactive
          : code === 'PROFILE_VALIDATION_FAILED'
            ? MESSAGES.invalid
            : MESSAGES.failed,
      )
    }
  }

  return (
    <div className={styles.card}>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby="profile-title">
          <h1 id="profile-title" className={`type-heading-2 ${styles.title}`}>
            Bạn là ai
          </h1>
          <p className={`type-body-md ${styles.lede}`}>
            Sáu trường. Ảnh và giới thiệu để trống được — nhưng hồ sơ không ảnh thì ít người bấm
            vào.
          </p>

          <div className={styles.avatarRow}>
            <div className={styles.avatar} data-avatar>
              {avatarUrl ? (
                // Served by the session-checked media route; never a public URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Ảnh đại diện hiện tại" />
              ) : null}
            </div>
            <div className={styles.avatarText}>
              <p className={`type-body-md weight-medium ${styles.avatarTitle}`}>Ảnh đại diện</p>
              <p className={`type-meta-xs ${styles.muted}`}>
                Ảnh chụp thật, thấy rõ mặt. Không nhận ảnh logo công ty hay ảnh nhóm —<br />
                hồ sơ này là hồ sơ người.
              </p>
            </div>
            <input
              ref={fileInput}
              className={styles.srOnly}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onAvatar(e.target.files?.[0])}
            />
            <div className={styles.upload}>
              <Button
                variant="secondary"
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                Tải ảnh
              </Button>
            </div>
          </div>
          {avatarError ? (
            <div className={styles.avatarError}>
              <Notice tone="error">{avatarError}</Notice>
            </div>
          ) : null}

          <div className={styles.fields}>
            <Field label="Họ và tên" error={errors.display_name}>
              {(p) => (
                <TextInput
                  {...p}
                  name="display_name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Chức danh hiện tại" error={errors.headline}>
              {(p) => (
                <TextInput
                  {...p}
                  name="headline"
                  autoComplete="organization-title"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              )}
            </Field>
            <Field label="Tỉnh / thành phố" error={errors.region_id}>
              {(p) => (
                <div className={`ui-input ${styles.select}`} data-invalid={p.invalid || undefined}>
                  <span aria-hidden="true" className={regionLabel ? undefined : styles.placeholder}>
                    {regionLabel ?? MESSAGES.regionPlaceholder}
                    <svg viewBox="0 0 6 4" className={styles.caret} focusable="false">
                      <path d="M0 0h6L3 4z" />
                    </svg>
                  </span>
                  <select
                    id={p.id}
                    name="region_id"
                    aria-invalid={p.invalid || undefined}
                    aria-describedby={p.describedBy}
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                  >
                    <option value="" disabled>
                      {MESSAGES.regionPlaceholder}
                    </option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
            <Field label="Giới thiệu ngắn">
              {(p) => (
                <textarea
                  id={p.id}
                  aria-describedby={p.describedBy}
                  className={`ui-input ${styles.textarea}`}
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              )}
            </Field>

            <fieldset
              className={styles.expertise}
              aria-describedby={errors.expertise ? 'expertise-error' : 'expertise-help'}
            >
              <legend className="ui-label">Chuyên môn · chọn tối đa 5</legend>
              <div className={styles.chips}>
                {shown.map((option) => {
                  const checked = selected.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={`type-meta-xs weight-medium ${styles.chip}`}
                      data-type={option.type}
                    >
                      <input
                        type="checkbox"
                        className={styles.srOnly}
                        value={option.id}
                        checked={checked}
                        disabled={!checked && full}
                        onChange={() => toggle(option.id)}
                      />
                      {checked ? (
                        <svg viewBox="0 0 10 10" className={styles.check} aria-hidden="true">
                          <path d="M1.5 5.2l2.3 2.3 4.7-5" />
                        </svg>
                      ) : null}
                      {option.label}
                    </label>
                  )
                })}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className={`type-meta-xs weight-medium ${styles.chip} ${styles.more}`}
                    onClick={() => setExpanded(true)}
                  >
                    + {hidden} nhóm khác
                  </button>
                ) : null}
              </div>
              {errors.expertise ? (
                <p id="expertise-error" role="alert" className={`ui-field-message ${styles.error}`}>
                  {errors.expertise}
                </p>
              ) : (
                <p id="expertise-help" className={`type-meta-xs ${styles.muted} ${styles.help}`}>
                  Danh mục do HUB quản lý, không gõ tự do — nhờ vậy bộ lọc ở Thư viện mới cho ra kết
                  quả đúng.
                </p>
              )}
            </fieldset>
          </div>

          {formError ? (
            <div className={styles.formError}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <hr className={styles.divider} />

          <div className={styles.footer}>
            <Link href="/onboarding/purpose" className="ui-button" data-variant="secondary">
              <span>Quay lại</span>
            </Link>
            <p className={`type-meta-xs ${styles.muted} ${styles.progress}`}>Bước 2 trong 3</p>
            <Button type="submit" loading={saving}>
              Tiếp tục
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
