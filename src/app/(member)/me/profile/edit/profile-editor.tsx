'use client'

import { useRef, useState, type FormEvent } from 'react'

import { EditorHeader } from '@/components/shell/editor-header'
import { Button, Notice, TextInput } from '@/components/ui'
import { TagInput } from '@/components/ui/tag-input'
import { apiRequest } from '@/lib/api/client'
import { LOCATION_TEXT_MAX, OTHER, OTHER_LABEL } from '@/lib/profile/location'

import styles from './profile-edit.module.css'

/**
 * WF02-S02 — profile editor body (DEC-WF02-H1/H2, DEC-WF02-S02-D1..D7).
 *
 * Canonical IndividualProfile data only. Approved regions: headline, bio,
 * "Lĩnh vực quan tâm" (S1-UAT-05: the FB-09 tag control, 1–5 domains, free
 * text allowed; FB-10 removed skills from what was "Nhóm chuyên môn") and links. H1 addendum: experience (or "chưa có kinh nghiệm"), development
 * goal and current need. The activity-hide panel is Future and not rendered;
 * the right column holds name, avatar and region instead (D5). "Lưu" sends
 * one PATCH with only the changed fields; the server validates everything,
 * computes completion and is the only source of saved state.
 */

type Experience = { title: string; organization_name: string }

type State = {
  display_name: string
  headline: string
  /** A REGION id, OTHER ("Khác", typed), or ''. */
  region_id: string
  /** The typed place: Việt Nam's "Khác", or any other country (US-01.07). */
  region_text: string
  bio: string
  /** Domain tags, by label. */
  domains: string[]
  experience: Experience[]
  no_experience_yet: boolean
  development_goal: string
  current_need: string
  links: string[]
}

type Initial = State & { avatar_url: string | null }

const MAX_LINKS = 5

/** Copy for states the approved bitmap does not show; pending PO copy review (DEC-WF02-S02-D6). */
const COPY = {
  visible: 'Hiển thị trong mạng lưới',
  hidden: 'Đang ẩn khỏi mạng lưới',
  savedAt: 'đã lưu lúc',
  save: 'Lưu',
  domainPlaceholder: 'Gõ lĩnh vực, Enter để thêm',
  domainRequired: 'Vui lòng thêm ít nhất một lĩnh vực.',
  addLink: '+ Thêm liên kết',
  addExperience: '+ Thêm kinh nghiệm',
  removeExperience: 'Xoá',
  noExperience: 'Tôi chưa có kinh nghiệm làm việc',
  required: 'Trường này là bắt buộc.',
  titleRequired: 'Vui lòng nhập vị trí.',
  invalidUrl: 'Liên kết phải bắt đầu bằng http:// hoặc https://.',
  inactive: 'Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.',
  invalid: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  avatarType: 'Chỉ nhận ảnh PNG, JPEG hoặc WebP.',
  avatarSize: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.',
  avatarFailed: 'Chưa tải được ảnh. Vui lòng thử lại.',
  changeAvatar: 'Đổi ảnh',
  regionPlaceholder: 'Chọn tỉnh / thành phố',
  regionTyped: 'Nhập tên tỉnh / thành phố',
  localityPlaceholder: 'Nhập tên địa phương',
  noteTitle: 'LIÊN HỆ NẰM Ở CÀI ĐẶT, KHÔNG Ở ĐÂY',
  noteBody:
    'Email đăng nhập thuộc tài khoản, không phải một ô trong hồ sơ, và không hiển thị cho người khác.',
} as const

/** A bare host such as "linkedin.com/in/x" is sent as https (the server stores http(s) only). */
function normaliseUrl(value: string): string {
  const text = value.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
}

function toBody(state: State, regionTyped: boolean) {
  const typed = regionTyped || state.region_id === OTHER
  return {
    display_name: state.display_name,
    headline: state.headline,
    // US-01.07: a listed province by id, a typed place by name (≤ 60).
    ...(typed && state.region_text.trim()
      ? { locality: state.region_text.trim() }
      : { region_id: typed ? null : state.region_id || null }),
    bio: state.bio,
    // FB-09 tags as text; skills are no longer sent (FB-10), so stored ones stay untouched.
    domains: state.domains,
    experience: state.no_experience_yet
      ? []
      : state.experience
          .filter((e) => e.title.trim() || e.organization_name.trim())
          .map((e) => ({ title: e.title, organization_name: e.organization_name || null })),
    no_experience_yet: state.no_experience_yet,
    development_goal: state.development_goal,
    current_need: state.current_need,
    links: state.links.filter((l) => l.trim()).map((url) => ({ url: normaliseUrl(url) })),
  }
}

type FieldErrors = Partial<Record<string, string>>

export function ProfileEditor({
  initial,
  regions,
  regionTyped,
  domainOptions,
  discoverable,
}: {
  initial: Initial
  regions: { id: string; label: string }[]
  /** The profile's country is not Việt Nam: the place is typed (US-01.07). */
  regionTyped: boolean
  /** Catalogue labels the domain field suggests. */
  domainOptions: string[]
  discoverable: boolean
}) {
  const { avatar_url: initialAvatar, ...initialState } = initial
  const [state, setState] = useState<State>(initialState)
  const [saved, setSaved] = useState<State>(initialState)
  const [savedAt, setSavedAt] = useState<string>()
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string>()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
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
          ? COPY.avatarType
          : reason === 'too_large'
            ? COPY.avatarSize
            : COPY.avatarFailed,
      )
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const local: FieldErrors = {}
    if (!state.display_name.trim()) local.display_name = COPY.required
    const typedPlace = regionTyped || state.region_id === OTHER
    if (typedPlace ? !state.region_text.trim() : !state.region_id) local.region_id = COPY.required
    if (state.domains.length === 0 && saved.domains.length > 0) local.domains = COPY.domainRequired
    if (Object.keys(local).length > 0) {
      setErrors(local)
      return
    }
    // Only what changed since the last successful save (PATCH stays partial).
    const next = toBody(state, regionTyped)
    const prev = toBody(saved, regionTyped)
    const body = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(prev[key as keyof typeof prev]),
      ),
    )
    inFlight.current = true
    setSaving(true)
    setFormError(undefined)
    try {
      await apiRequest('/me/profile', { method: 'PATCH', body })
      setSaved(state)
      setSavedAt(
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      )
    } catch (caught) {
      const error = caught as { code?: string; fields?: Record<string, string> } | null
      const fields = error?.fields ?? {}
      const mapped: FieldErrors = {}
      for (const [key, reason] of Object.entries(fields)) {
        mapped[key] =
          reason === 'required'
            ? COPY.required
            : reason === 'title_required'
              ? COPY.titleRequired
              : reason === 'invalid_url'
                ? COPY.invalidUrl
                : COPY.invalid
      }
      setErrors(mapped)
      setFormError(error?.code === 'VOCABULARY_ITEM_INACTIVE' ? COPY.inactive : COPY.failed)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const hint = (id: string, text: string) => (
    <p id={id} className={`type-meta-xs ${styles.hint}`}>
      {text}
    </p>
  )
  const fieldError = (key: string) =>
    errors[key] ? (
      <p className={`type-meta-xs ${styles.error}`} role="alert">
        {errors[key]}
      </p>
    ) : null

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate data-editor>
      <EditorHeader
        title={saved.display_name}
        status={`${discoverable ? COPY.visible : COPY.hidden}${savedAt ? ` · ${COPY.savedAt} ${savedAt}` : ''}`}
        actions={
          <Button type="submit" loading={saving}>
            {COPY.save}
          </Button>
        }
      />

      <div className={styles.columns}>
        <div className={styles.form}>
          {formError ? (
            <div className={styles.formError}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <section className={styles.field}>
            <label htmlFor="pe-headline" className={`type-body-sm weight-semibold ${styles.label}`}>
              Chức danh
            </label>
            <TextInput
              id="pe-headline"
              value={state.headline}
              invalid={Boolean(errors.headline)}
              onChange={(e) => set('headline', e.target.value)}
            />
            {fieldError('headline')}
          </section>

          <section className={styles.field}>
            <label htmlFor="pe-bio" className={`type-body-sm weight-semibold ${styles.label}`}>
              Giới thiệu
            </label>
            {hint('pe-bio-hint', '≤ 60 từ. Viết như nói với người ngồi cạnh.')}
            <TextInput
              id="pe-bio"
              value={state.bio}
              describedBy="pe-bio-hint"
              invalid={Boolean(errors.bio)}
              onChange={(e) => set('bio', e.target.value)}
            />
            {fieldError('bio')}
          </section>

          <section className={styles.field}>
            <label
              id="pe-domains-label"
              htmlFor="pe-domains"
              className={`type-body-sm weight-semibold ${styles.label}`}
            >
              Lĩnh vực quan tâm
            </label>
            {hint('pe-domains-hint', 'Gợi ý từ danh mục HUB; gõ giá trị khác rồi Enter để thêm.')}
            <TagInput
              id="pe-domains"
              name="domains"
              labelledBy="pe-domains-label"
              tags={state.domains}
              options={domainOptions}
              placeholder={COPY.domainPlaceholder}
              error={errors.domains}
              boxClassName={styles.tagBox}
              onChange={(next) => set('domains', next)}
            />
          </section>

          <section className={styles.field}>
            <p id="pe-links-label" className={`type-body-sm weight-semibold ${styles.label}`}>
              Liên kết ngoài
            </p>
            {hint('pe-links-hint', 'LinkedIn, GitHub, trang cá nhân.')}
            {(state.links.length > 0 ? state.links : ['']).map((link, i) => (
              <TextInput
                key={i}
                id={`pe-link-${i}`}
                value={link}
                aria-labelledby="pe-links-label"
                describedBy="pe-links-hint"
                invalid={Boolean(errors.links)}
                inputMode="url"
                onChange={(e) => {
                  const links = state.links.length > 0 ? [...state.links] : ['']
                  links[i] = e.target.value
                  set('links', links)
                }}
              />
            ))}
            {state.links.length > 0 &&
            state.links.length < MAX_LINKS &&
            state.links[state.links.length - 1]!.trim() ? (
              <button
                type="button"
                className={`type-body-sm weight-medium ${styles.textButton}`}
                onClick={() => set('links', [...state.links, ''])}
              >
                {COPY.addLink}
              </button>
            ) : null}
            {fieldError('links')}
          </section>

          {/* DEC-WF02-H1 addendum: groups 8-10 (INTENTIONAL-CONTRACT). */}
          <section className={styles.field} data-h1="experience">
            <p id="pe-exp-label" className={`type-body-sm weight-semibold ${styles.label}`}>
              Kinh nghiệm
            </p>
            {hint('pe-exp-hint', 'Vị trí đã hoặc đang làm, và tổ chức.')}
            {state.no_experience_yet
              ? null
              : state.experience.map((e, i) => (
                  <div key={i} className={styles.experienceRow} data-experience-row>
                    <TextInput
                      id={`pe-exp-title-${i}`}
                      value={e.title}
                      placeholder="Vị trí"
                      aria-label={`Vị trí ${i + 1}`}
                      onChange={(ev) => {
                        const list = [...state.experience]
                        list[i] = { ...e, title: ev.target.value }
                        set('experience', list)
                      }}
                    />
                    <TextInput
                      id={`pe-exp-org-${i}`}
                      value={e.organization_name}
                      placeholder="Tổ chức"
                      aria-label={`Tổ chức ${i + 1}`}
                      onChange={(ev) => {
                        const list = [...state.experience]
                        list[i] = { ...e, organization_name: ev.target.value }
                        set('experience', list)
                      }}
                    />
                    <button
                      type="button"
                      className={`type-body-sm ${styles.textButton}`}
                      onClick={() =>
                        set(
                          'experience',
                          state.experience.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {COPY.removeExperience}
                    </button>
                  </div>
                ))}
            {state.no_experience_yet ? null : (
              <button
                type="button"
                className={`type-body-sm weight-medium ${styles.textButton}`}
                onClick={() =>
                  set('experience', [...state.experience, { title: '', organization_name: '' }])
                }
              >
                {COPY.addExperience}
              </button>
            )}
            <label className={`type-body-sm ${styles.check}`}>
              <input
                type="checkbox"
                checked={state.no_experience_yet}
                onChange={(e) => set('no_experience_yet', e.target.checked)}
              />
              {COPY.noExperience}
            </label>
            {fieldError('experience') ?? fieldError('no_experience_yet')}
          </section>

          <section className={styles.field} data-h1="development_goal">
            <label htmlFor="pe-goal" className={`type-body-sm weight-semibold ${styles.label}`}>
              Mục tiêu phát triển
            </label>
            {hint('pe-goal-hint', 'Điều bạn muốn đạt được trong thời gian tới.')}
            <TextInput
              id="pe-goal"
              value={state.development_goal}
              describedBy="pe-goal-hint"
              invalid={Boolean(errors.development_goal)}
              onChange={(e) => set('development_goal', e.target.value)}
            />
            {fieldError('development_goal')}
          </section>

          <section className={styles.field} data-h1="current_need">
            <label htmlFor="pe-need" className={`type-body-sm weight-semibold ${styles.label}`}>
              Nhu cầu hiện tại
            </label>
            {hint('pe-need-hint', 'Điều bạn đang cần từ mạng lưới lúc này.')}
            <TextInput
              id="pe-need"
              value={state.current_need}
              describedBy="pe-need-hint"
              invalid={Boolean(errors.current_need)}
              onChange={(e) => set('current_need', e.target.value)}
            />
            {fieldError('current_need')}
          </section>
        </div>

        <aside className={styles.side}>
          {/* DEC-WF02-S02-D5: basic info in the freed activity-panel slot (INTENTIONAL-CONTRACT). */}
          <section className={styles.basic} data-basic>
            <p className={`weight-semibold ${styles.eyebrow}`}>THÔNG TIN CƠ BẢN</p>
            <div className={styles.avatarRow}>
              <span className={styles.avatar}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, session-authorised media route
                  <img src={avatarUrl} alt="Ảnh đại diện hiện tại" />
                ) : null}
              </span>
              <Button
                variant="secondary"
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {COPY.changeAvatar}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={styles.fileInput}
                aria-label="Ảnh đại diện"
                onChange={(e) => onAvatar(e.target.files?.[0])}
              />
            </div>
            {avatarError ? (
              <p className={`type-meta-xs ${styles.error}`} role="alert">
                {avatarError}
              </p>
            ) : null}
            <label htmlFor="pe-name" className={`type-body-sm weight-semibold ${styles.label}`}>
              Họ và tên
            </label>
            <TextInput
              id="pe-name"
              value={state.display_name}
              invalid={Boolean(errors.display_name)}
              onChange={(e) => set('display_name', e.target.value)}
            />
            {fieldError('display_name')}
            <label htmlFor="pe-region" className={`type-body-sm weight-semibold ${styles.label}`}>
              Tỉnh / thành phố
            </label>
            {regionTyped ? (
              <TextInput
                id="pe-region"
                value={state.region_text}
                maxLength={LOCATION_TEXT_MAX}
                placeholder={COPY.regionTyped}
                invalid={Boolean(errors.region_id)}
                onChange={(e) => set('region_text', e.target.value)}
              />
            ) : (
              <select
                id="pe-region"
                className={`type-body-md ${styles.select}`}
                value={state.region_id}
                aria-invalid={Boolean(errors.region_id)}
                onChange={(e) => {
                  set('region_id', e.target.value)
                  set('region_text', '')
                }}
              >
                <option value="">{COPY.regionPlaceholder}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
                <option value={OTHER}>{OTHER_LABEL}</option>
              </select>
            )}
            {!regionTyped && state.region_id === OTHER ? (
              <TextInput
                id="pe-locality"
                aria-label="Tên địa phương"
                value={state.region_text}
                maxLength={LOCATION_TEXT_MAX}
                placeholder={COPY.localityPlaceholder}
                invalid={Boolean(errors.region_id)}
                onChange={(e) => set('region_text', e.target.value)}
              />
            ) : null}
            {fieldError('region_id')}
          </section>

          <section className={styles.note}>
            <p className={`weight-semibold ${styles.noteTitle}`}>{COPY.noteTitle}</p>
            <p className={`type-body-sm ${styles.noteBody}`}>{COPY.noteBody}</p>
          </section>
        </aside>
      </div>
    </form>
  )
}
