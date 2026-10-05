'use client'

import { useId, useState } from 'react'

import { TAG_RULES, TagInput } from '@/components/ui/tag-input'
import type { OwnProfileDTO } from '@/lib/profile/profile'

import { Field, grid2, ProfileDialog } from './profile-dialog'
import styles from './profile-own.module.css'

/**
 * The FP1-OWN dialogs on the L12 pattern (DEC-L2R-D3): education, basic and
 * contact information, domains and specialisations. Each hands one PATCH body
 * to the page, which saves it and reads the profile again; the server
 * validates everything again.
 */

export type Option = { id: string; label: string }

const MESSAGES = {
  required: 'Trường này là bắt buộc.',
  month: 'Nhập theo dạng MM/YYYY.',
  start: 'Vui lòng nhập thời gian bắt đầu.',
  order: 'Thời gian kết thúc phải sau thời gian bắt đầu.',
  phone: 'Số điện thoại chưa hợp lệ.',
  domains: 'Vui lòng thêm ít nhất một lĩnh vực.',
  specializations: 'Vui lòng thêm ít nhất một chuyên môn.',
} as const

const toField = (month: string | null) => (month ? `${month.slice(5)}/${month.slice(0, 4)}` : '')

/** "MM/YYYY" → "YYYY-MM"; '' stays ''; anything else is null. */
function toMonth(text: string): string | null {
  const value = text.trim()
  if (!value) return ''
  const match = /^(0?[1-9]|1[0-2])\/((?:19|20)\d{2})$/.exec(value)
  return match ? `${match[2]}-${match[1]!.padStart(2, '0')}` : null
}

export type EducationRecord = {
  institution: string
  programme: string | null
  started_on: string | null
  ended_on: string | null
}

export function EducationDialog({
  record,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  record: OwnProfileDTO['education'][number] | null
  saving: boolean
  error?: string
  onSave: (record: EducationRecord) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const ids = useId()
  const [institution, setInstitution] = useState(record?.institution ?? '')
  const [programme, setProgramme] = useState(record?.programme ?? '')
  const [from, setFrom] = useState(toField(record?.started_on ?? null))
  const [to, setTo] = useState(toField(record?.ended_on ?? null))
  const [errors, setErrors] = useState<{ institution?: string; from?: string; to?: string }>({})

  function submit() {
    const started = toMonth(from)
    const ended = toMonth(to)
    const next: typeof errors = {}
    if (!institution.trim()) next.institution = MESSAGES.required
    if (started === null) next.from = MESSAGES.month
    if (ended === null) next.to = MESSAGES.month
    else if (ended && !started) next.from = MESSAGES.start
    else if (ended && started && ended < started) next.to = MESSAGES.order
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave({
      institution: institution.trim(),
      programme: programme.trim() || null,
      started_on: started || null,
      ended_on: ended || null,
    })
  }

  return (
    <ProfileDialog
      name="education"
      title={record ? 'Sửa học vấn' : 'Thêm học vấn'}
      saving={saving}
      error={error}
      onSubmit={submit}
      onClose={onClose}
      onDelete={onDelete}
    >
      <Field id={`${ids}-inst`} label="Trường" error={errors.institution}>
        <input
          id={`${ids}-inst`}
          className="ui-input"
          value={institution}
          aria-invalid={errors.institution ? true : undefined}
          onChange={(e) => setInstitution(e.target.value)}
        />
      </Field>
      <Field id={`${ids}-prog`} label="Ngành / chương trình">
        <input
          id={`${ids}-prog`}
          className="ui-input"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
        />
      </Field>
      <div className={grid2}>
        <Field id={`${ids}-from`} label="Từ" error={errors.from}>
          <input
            id={`${ids}-from`}
            className="ui-input"
            inputMode="numeric"
            placeholder="MM/YYYY"
            value={from}
            aria-invalid={errors.from ? true : undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field id={`${ids}-to`} label="Đến" error={errors.to}>
          <input
            id={`${ids}-to`}
            className="ui-input"
            inputMode="numeric"
            placeholder="MM/YYYY"
            value={to}
            aria-invalid={errors.to ? true : undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
    </ProfileDialog>
  )
}

export function BasicDialog({
  profile,
  countries,
  regions,
  saving,
  error,
  onSave,
  onClose,
}: {
  profile: OwnProfileDTO
  countries: Option[]
  regions: Option[]
  saving: boolean
  error?: string
  onSave: (body: Record<string, unknown>) => void
  onClose: () => void
}) {
  const ids = useId()
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [headline, setHeadline] = useState(profile.headline ?? '')
  const [countryId, setCountryId] = useState(profile.country?.id ?? '')
  const [regionId, setRegionId] = useState(profile.region?.id ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit() {
    const next: Record<string, string> = {}
    if (!fullName.trim()) next.full_name = MESSAGES.required
    if (!displayName.trim()) next.display_name = MESSAGES.required
    if (!countryId) next.country_id = MESSAGES.required
    if (!regionId) next.region_id = MESSAGES.required
    if (phone.trim() && !/^\+?[\d\s.-]{8,20}$/.test(phone.trim())) next.phone = MESSAGES.phone
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave({
      full_name: fullName,
      display_name: displayName,
      headline,
      country_id: countryId,
      region_id: regionId,
      phone: phone.trim() || null,
    })
  }

  const select = (
    id: string,
    value: string,
    list: Option[],
    placeholder: string,
    set: (value: string) => void,
    invalid?: string,
  ) => (
    <select
      id={id}
      className="ui-input"
      value={value}
      aria-invalid={invalid ? true : undefined}
      onChange={(e) => set(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {list.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  )

  return (
    <ProfileDialog
      name="basic"
      title="Thông tin cơ bản và liên hệ"
      saving={saving}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className={grid2}>
        <Field id={`${ids}-full`} label="Họ và tên" error={errors.full_name}>
          <input
            id={`${ids}-full`}
            className="ui-input"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field id={`${ids}-display`} label="Tên hiển thị" error={errors.display_name}>
          <input
            id={`${ids}-display`}
            className="ui-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
      </div>
      <Field id={`${ids}-headline`} label="Vai trò hiện tại">
        <input
          id={`${ids}-headline`}
          className="ui-input"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </Field>
      <div className={grid2}>
        <Field id={`${ids}-country`} label="Quốc gia/Khu vực" error={errors.country_id}>
          {select(
            `${ids}-country`,
            countryId,
            countries,
            'Chọn quốc gia',
            setCountryId,
            errors.country_id,
          )}
        </Field>
        <Field id={`${ids}-region`} label="Tỉnh/Thành phố" error={errors.region_id}>
          {select(
            `${ids}-region`,
            regionId,
            regions,
            'Chọn tỉnh/thành phố',
            setRegionId,
            errors.region_id,
          )}
        </Field>
      </div>
      <Field id={`${ids}-phone`} label="Số điện thoại · chỉ bạn thấy" error={errors.phone}>
        <input
          id={`${ids}-phone`}
          className="ui-input"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
    </ProfileDialog>
  )
}

/**
 * "Lĩnh vực và chuyên môn" (FB-09, FB-10): the same tag control as onboarding
 * stage 2, 1–5 tags each, free text allowed; "Kỹ năng" is gone.
 */
export function ExpertiseDialog({
  selected,
  domains,
  specializations,
  saving,
  error,
  onSave,
  onClose,
}: {
  selected: { domains: string[]; specializations: string[] }
  /** Catalogue labels the fields suggest. */
  domains: string[]
  specializations: string[]
  saving: boolean
  error?: string
  onSave: (body: Record<string, unknown>) => void
  onClose: () => void
}) {
  const ids = useId()
  const [pickedDomains, setPickedDomains] = useState(selected.domains)
  const [picked, setPicked] = useState(selected.specializations)
  const [errors, setErrors] = useState<{ domains?: string; specializations?: string }>({})

  function submit() {
    const next = {
      domains: pickedDomains.length === 0 ? MESSAGES.domains : undefined,
      specializations: picked.length === 0 ? MESSAGES.specializations : undefined,
    }
    setErrors(next)
    if (next.domains || next.specializations) return
    onSave({ domains: pickedDomains, specializations: picked })
  }

  return (
    <ProfileDialog
      name="expertise"
      title="Lĩnh vực và chuyên môn"
      saving={saving}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className={styles.pickGroup}>
        <label id={`${ids}-domains`} htmlFor={`${ids}-domain`} className={styles.pickLegend}>
          Lĩnh vực quan tâm · đã thêm {pickedDomains.length}/{TAG_RULES.count}
        </label>
        <TagInput
          id={`${ids}-domain`}
          name="domains"
          labelledBy={`${ids}-domains`}
          tags={pickedDomains}
          options={domains}
          placeholder="Gõ lĩnh vực, Enter để thêm"
          error={errors.domains}
          onChange={(next) => {
            setPickedDomains(next)
            setErrors((e) => ({ ...e, domains: undefined }))
          }}
        />
      </div>
      <div className={styles.pickGroup}>
        <label
          id={`${ids}-specializations`}
          htmlFor={`${ids}-specialization`}
          className={styles.pickLegend}
        >
          Chuyên môn · đã thêm {picked.length}/{TAG_RULES.count}
        </label>
        <TagInput
          id={`${ids}-specialization`}
          name="specializations"
          labelledBy={`${ids}-specializations`}
          tags={picked}
          options={specializations}
          placeholder="Gõ chuyên môn, Enter để thêm"
          error={errors.specializations}
          onChange={(next) => {
            setPicked(next)
            setErrors((e) => ({ ...e, specializations: undefined }))
          }}
        />
      </div>
    </ProfileDialog>
  )
}
