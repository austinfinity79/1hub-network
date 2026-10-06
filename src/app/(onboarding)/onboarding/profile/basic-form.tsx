'use client'

import { useId, useRef, useState, type FormEvent } from 'react'

import { Inert } from '@/components/onboarding/inert'
import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import {
  isVietnam,
  LOCATION_TEXT_MAX,
  locationBody,
  locationErrors,
  OTHER,
  OTHER_LABEL,
  withCountry,
  type LocationOption,
  type LocationValue,
} from '@/lib/profile/location'

import { HeaderAction, Optional, Required, Select, saveMessage, useLeave } from '../parts'
import { Spark } from '../spark'
import stage from '../stage.module.css'
import styles from './basic.module.css'

/**
 * ACC-06 — onboarding stage 1, "Thông tin cơ bản" (BA workbook rows 56, 68;
 * DEC-L1R-D4).
 *
 * Required, as the board marks them: full name, display name, country and
 * province. Location follows US-01.07 (S1-UAT-03, DEC-S1O; lib/profile/location):
 * eleven countries with "Khác" (typed name), Việt Nam's province list with
 * "Khác" (typed name), a typed place (≤ 60) for any other country; a new
 * country clears the province. The display name defaults to the full name. E-mail is the
 * account's and cannot be changed here; the phone number is private.
 * "Tiếp tục" saves and opens stage 2; "Lưu và hoàn tất sau" saves what is
 * filled and leaves. Every rule is re-checked by the server; this is UX only.
 *
 * The AI block is drawn as on the board and has nothing to press: no provider
 * is configured (D-A1), so nothing is uploaded, sent or suggested.
 */

type Option = { id: string; label: string }

type Initial = {
  full_name: string
  display_name: string
  headline: string
  bio: string
  location: LocationValue
  phone: string
  avatar_url: string | null
}

type FieldKey = 'full_name' | 'display_name' | 'country_id' | 'region_id' | 'phone'

/** Copy for states the board does not show. */
const MESSAGES = {
  full_name: 'Vui lòng nhập họ và tên.',
  display_name: 'Vui lòng nhập tên hiển thị.',
  phone: 'Số điện thoại chưa đúng định dạng.',
  avatarType: 'Chỉ nhận ảnh PNG, JPEG hoặc WebP.',
  avatarSize: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.',
  avatarFailed: 'Chưa tải được ảnh. Vui lòng thử lại.',
} as const

const AI_SOURCES = ['Tải CV lên', 'Dán nội dung hồ sơ', 'Thêm liên kết LinkedIn/Portfolio'] as const

export function BasicForm({
  initial,
  email,
  countries,
  regions,
  next = '/onboarding/capability',
}: {
  initial: Initial
  email: string
  countries: LocationOption[]
  regions: Option[]
  /** Where "Tiếp tục" goes: stage 2, or back to stage 4 after "Sửa" (US-01.12). */
  next?: string
}) {
  const leave = useLeave()
  const ids = useId()
  const [fullName, setFullName] = useState(initial.full_name)
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [headline, setHeadline] = useState(initial.headline)
  const [bio, setBio] = useState(initial.bio)
  const [location, setLocation] = useState<LocationValue>(initial.location)
  const [phone, setPhone] = useState(initial.phone)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string>()
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState<'next' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const id = (name: string) => `${ids}-${name}`
  const clear = (key: FieldKey) => setErrors((e) => ({ ...e, [key]: undefined }))

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

  async function save(mode: 'next' | 'later') {
    if (inFlight.current) return
    setFormError(undefined)
    // "Mặc định lấy từ họ và tên": an empty display name takes the full name.
    const shown = displayName.trim() || fullName.trim()
    if (mode === 'next') {
      const missing: Partial<Record<FieldKey, string>> = {}
      if (!fullName.trim()) missing.full_name = MESSAGES.full_name
      if (!shown) missing.display_name = MESSAGES.display_name
      const place = locationErrors(location, countries)
      if (place.country) missing.country_id = place.country
      if (place.region) missing.region_id = place.region
      setErrors(missing)
      if (Object.keys(missing).length > 0) return
    } else {
      setErrors({})
    }

    inFlight.current = true
    setSaving(mode)
    try {
      await apiRequest('/me/profile', {
        method: 'PATCH',
        body: {
          full_name: fullName,
          display_name: shown,
          headline,
          bio,
          ...locationBody(location, countries),
          phone: phone.trim() || null,
        },
      })
      if (!displayName.trim()) setDisplayName(shown)
      leave(mode === 'next' ? next : '/')
      // Stay busy while navigating, so the mutation cannot repeat.
    } catch (caught) {
      inFlight.current = false
      setSaving(undefined)
      const fields = (caught as { fields?: Record<string, string> } | null)?.fields
      if (fields?.phone) setErrors({ phone: MESSAGES.phone })
      else if (fields?.country || fields?.country_id) {
        setErrors({
          country_id: locationErrors(location, countries).country ?? saveMessage(caught),
        })
      } else if (fields?.locality || fields?.region_id) {
        setErrors({ region_id: locationErrors(location, countries).region ?? saveMessage(caught) })
      } else setFormError(saveMessage(caught))
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save('next')
  }

  const busy = saving !== undefined

  return (
    <div className={styles.card} data-screen="ACC-06">
      <HeaderAction>
        <button type="button" disabled={busy} onClick={() => void save('later')}>
          Lưu và hoàn tất sau
        </button>
      </HeaderAction>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby={id('title')}>
          <h1 id={id('title')} className={stage.title}>
            Thông tin cơ bản
          </h1>

          <section className={styles.ai} data-anchor="ai" aria-labelledby={id('ai')}>
            <div className={styles.aiHead}>
              <span className={styles.aiBadge} aria-hidden="true">
                <Spark className={styles.spark} />
                AI
              </span>
              <h2 id={id('ai')} className={styles.aiTitle}>
                Tạo hồ sơ nhanh với AI
              </h2>
            </div>
            <p className={styles.aiBody}>
              Tải CV hoặc dán nội dung hồ sơ hiện có. AI sẽ trích xuất và đề xuất thông tin để bạn
              rà soát.
            </p>
            <ul className={styles.aiTabs}>
              {AI_SOURCES.map((label, i) => (
                <li key={label}>
                  <Inert
                    reason="NO_P0_SCREEN"
                    label={label}
                    className={`${styles.aiTab} ${i === 0 ? styles.aiTabCurrent : ''}`}
                  >
                    {label}
                  </Inert>
                </li>
              ))}
            </ul>
            <Inert
              reason="NO_P0_SCREEN"
              label="Kéo thả CV vào đây hoặc chọn tệp từ máy"
              className={styles.drop}
            >
              <span className={styles.dropTitle}>Kéo thả CV vào đây hoặc chọn tệp từ máy</span>
              <span className={styles.dropHint}>PDF, DOCX · TỐI ĐA 10 MB</span>
            </Inert>
            <div className={styles.aiFoot}>
              <p className={styles.privacy}>
                <span className={styles.privacyLabel}>QUYỀN RIÊNG TƯ</span>
                Tệp và nội dung cung cấp chỉ được sử dụng để đề xuất thông tin cho hồ sơ này.
              </p>
              <Inert
                reason="NO_P0_SCREEN"
                label="Gợi ý thông tin bằng AI"
                className={styles.suggest}
              >
                <Spark className={styles.spark} />
                Gợi ý thông tin bằng AI
              </Inert>
            </div>
          </section>

          <p className={styles.manual} data-anchor="manual">
            HOẶC NHẬP THỦ CÔNG
          </p>

          <div className={`${stage.section} ${styles.first}`} data-anchor="display">
            <p className={stage.eyebrow}>Thông tin hiển thị</p>
            <div className={styles.avatarRow}>
              <div className={styles.avatar} data-avatar>
                {avatarUrl ? (
                  // Served by the session-checked media route; never a public URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Ảnh hồ sơ hiện tại" />
                ) : null}
              </div>
              <div className={styles.avatarText}>
                <p className={styles.avatarTitle}>
                  Ảnh hồ sơ
                  <Optional />
                </p>
                <p className={styles.avatarHint}>Sử dụng ảnh chân dung rõ mặt, chất lượng tốt</p>
              </div>
              <input
                ref={fileInput}
                className={stage.srOnly}
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
                  Tải ảnh lên
                </Button>
              </div>
            </div>
            {avatarError ? (
              <div className={stage.formError}>
                <Notice tone="error">{avatarError}</Notice>
              </div>
            ) : null}

            <div className={stage.grid2}>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('full_name')}>
                  Họ và tên
                  <Required />
                </label>
                <div className={stage.control}>
                  <input
                    id={id('full_name')}
                    className="ui-input"
                    name="full_name"
                    autoComplete="name"
                    placeholder="Nhập họ và tên đầy đủ"
                    required
                    aria-invalid={errors.full_name ? true : undefined}
                    aria-describedby={errors.full_name ? id('full_name-error') : undefined}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value)
                      clear('full_name')
                    }}
                  />
                </div>
                {errors.full_name ? (
                  <p id={id('full_name-error')} role="alert" className={stage.error}>
                    {errors.full_name}
                  </p>
                ) : null}
              </div>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('display_name')}>
                  Tên hiển thị
                  <Required />
                </label>
                <div className={stage.control}>
                  <input
                    id={id('display_name')}
                    className="ui-input"
                    name="display_name"
                    autoComplete="nickname"
                    placeholder="Mặc định lấy từ họ và tên"
                    aria-invalid={errors.display_name ? true : undefined}
                    aria-describedby={
                      errors.display_name ? id('display_name-error') : id('display_name-help')
                    }
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      clear('display_name')
                    }}
                  />
                </div>
                {errors.display_name ? (
                  <p id={id('display_name-error')} role="alert" className={stage.error}>
                    {errors.display_name}
                  </p>
                ) : (
                  <p id={id('display_name-help')} className={stage.helper}>
                    Bạn có thể chỉnh sửa tên hiển thị.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={stage.section} data-anchor="about">
            <p className={stage.eyebrow}>Giới thiệu</p>
            <div className={stage.field}>
              <label className={stage.label} htmlFor={id('headline')}>
                Vai trò hiện tại
                <Optional />
              </label>
              <div className={stage.control}>
                <input
                  id={id('headline')}
                  className="ui-input"
                  name="headline"
                  autoComplete="organization-title"
                  placeholder="Ví dụ: Nhà sáng lập, Chuyên viên phát triển kinh doanh"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>
            </div>
            <div className={stage.field}>
              <label className={stage.label} htmlFor={id('bio')}>
                Giới thiệu ngắn
                <Optional />
              </label>
              <div className={stage.control}>
                <textarea
                  id={id('bio')}
                  className="ui-input"
                  name="bio"
                  placeholder="Chia sẻ ngắn gọn về kinh nghiệm, thế mạnh hoặc lĩnh vực bạn quan tâm"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={stage.section} data-anchor="location">
            <p className={stage.eyebrow}>Vị trí</p>
            <div className={stage.grid2}>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('country_id')}>
                  Quốc gia/Khu vực
                  <Required />
                </label>
                <div className={stage.control}>
                  <Select
                    id={id('country_id')}
                    name="country_id"
                    value={location.country}
                    options={[...countries, { id: OTHER, label: OTHER_LABEL }]}
                    placeholder="Chọn quốc gia hoặc khu vực"
                    required
                    invalid={Boolean(errors.country_id)}
                    describedBy={errors.country_id ? id('country_id-error') : undefined}
                    onChange={(value) => {
                      setLocation((current) => withCountry(current, value))
                      clear('country_id')
                      clear('region_id')
                    }}
                  />
                </div>
                {location.country === OTHER ? (
                  <div className={`${stage.control} ${styles.typed}`}>
                    <input
                      id={id('country_text')}
                      className="ui-input"
                      name="country_text"
                      aria-label="Tên quốc gia"
                      placeholder="Nhập tên quốc gia"
                      maxLength={LOCATION_TEXT_MAX}
                      required
                      aria-invalid={Boolean(errors.country_id) || undefined}
                      aria-describedby={errors.country_id ? id('country_id-error') : undefined}
                      value={location.countryText}
                      onChange={(e) => {
                        const countryText = e.target.value
                        setLocation((current) => ({ ...current, countryText }))
                        clear('country_id')
                      }}
                    />
                  </div>
                ) : null}
                {errors.country_id ? (
                  <p id={id('country_id-error')} role="alert" className={stage.error}>
                    {errors.country_id}
                  </p>
                ) : null}
              </div>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('region_id')}>
                  Tỉnh/Thành phố
                  <Required />
                </label>
                <div className={stage.control}>
                  {!location.country || isVietnam(location, countries) ? (
                    <Select
                      id={id('region_id')}
                      name="region_id"
                      value={location.region}
                      options={[...regions, { id: OTHER, label: OTHER_LABEL }]}
                      placeholder="Chọn tỉnh/thành phố"
                      required
                      // The list belongs to the chosen country.
                      disabled={!location.country}
                      invalid={Boolean(errors.region_id)}
                      describedBy={errors.region_id ? id('region_id-error') : id('region_id-help')}
                      onChange={(value) => {
                        setLocation((current) => ({ ...current, region: value, regionText: '' }))
                        clear('region_id')
                      }}
                    />
                  ) : (
                    // Any other country: the place is typed (FB-07, ≤ 60).
                    <input
                      id={id('region_id')}
                      className="ui-input"
                      name="locality"
                      placeholder="Nhập tên tỉnh/thành phố"
                      maxLength={LOCATION_TEXT_MAX}
                      required
                      aria-invalid={Boolean(errors.region_id) || undefined}
                      aria-describedby={
                        errors.region_id ? id('region_id-error') : id('region_id-help')
                      }
                      value={location.regionText}
                      onChange={(e) => {
                        const regionText = e.target.value
                        setLocation((current) => ({ ...current, regionText }))
                        clear('region_id')
                      }}
                    />
                  )}
                </div>
                {isVietnam(location, countries) && location.region === OTHER ? (
                  <div className={`${stage.control} ${styles.typed}`}>
                    <input
                      id={id('locality')}
                      className="ui-input"
                      name="locality"
                      aria-label="Tên địa phương"
                      placeholder="Nhập tên địa phương"
                      maxLength={LOCATION_TEXT_MAX}
                      required
                      aria-invalid={Boolean(errors.region_id) || undefined}
                      aria-describedby={errors.region_id ? id('region_id-error') : undefined}
                      value={location.regionText}
                      onChange={(e) => {
                        const regionText = e.target.value
                        setLocation((current) => ({ ...current, regionText }))
                        clear('region_id')
                      }}
                    />
                  </div>
                ) : null}
                {errors.region_id ? (
                  <p id={id('region_id-error')} role="alert" className={stage.error}>
                    {errors.region_id}
                  </p>
                ) : (
                  <p id={id('region_id-help')} className={stage.helper}>
                    {location.country && !isVietnam(location, countries)
                      ? `Nhập tên địa phương, tối đa ${LOCATION_TEXT_MAX} ký tự.`
                      : 'Danh sách thay đổi theo quốc gia đã chọn.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={stage.section} data-anchor="contact">
            <p className={stage.eyebrow}>Liên hệ</p>
            <div className={stage.grid2}>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('email')}>
                  Email
                  <Required />
                </label>
                <div className={`${stage.control} ${stage.badged}`}>
                  <input
                    id={id('email')}
                    className="ui-input"
                    type="email"
                    name="email"
                    readOnly
                    aria-describedby={id('email-help')}
                    value={email}
                  />
                  <span className={stage.badge}>Từ tài khoản</span>
                </div>
                <p id={id('email-help')} className={stage.helper}>
                  Lấy từ tài khoản; không chỉnh sửa tại đây.
                </p>
              </div>
              <div className={stage.field}>
                <label className={stage.label} htmlFor={id('phone')}>
                  Số điện thoại
                  <Optional />
                </label>
                <div className={`${stage.control} ${stage.badged}`}>
                  <input
                    id={id('phone')}
                    className="ui-input"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Nhập số điện thoại"
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? id('phone-error') : undefined}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      clear('phone')
                    }}
                  />
                  <span className={stage.badge}>Riêng tư</span>
                </div>
                {errors.phone ? (
                  <p id={id('phone-error')} role="alert" className={stage.error}>
                    {errors.phone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {formError ? (
            <div className={stage.formError}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <hr className={`${stage.rule} ${styles.end}`} data-anchor="rule" />

          <div className={styles.footer} data-anchor="footer">
            <span className={stage.spacer} />
            <button
              type="button"
              className={stage.later}
              disabled={busy}
              onClick={() => void save('later')}
            >
              Lưu và hoàn tất sau
            </button>
            <Button type="submit" loading={saving === 'next'} disabled={busy}>
              Tiếp tục
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
