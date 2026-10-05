'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'

import {
  ExperienceDialog,
  type ExperienceRecord,
} from '@/app/(onboarding)/onboarding/capability/experience-dialog'
import { Inert } from '@/components/onboarding/inert'
import { Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { CompletionGroup } from '@/lib/profile/completion'
import type { OwnProfileDTO } from '@/lib/profile/profile'
import type { VentureSummaryDTO } from '@/lib/venture/venture'

import { BasicDialog, EducationDialog, ExpertiseDialog, type Option } from './profile-dialogs'
import { durationText, initials, monthText, suggestions, type Suggestion } from './profile-model'
import styles from './profile-own.module.css'

/**
 * FP1-OWN body (DEC-L2R-D1..D3, D11).
 *
 * Drawn from the owner's own DTOs only. Pencils and "+" edit in place: the
 * L12 dialog for experience, dialogs on its pattern for education, basic and
 * contact information, domains and specialisations (FB-09 tags; "Kỹ năng"
 * removed by FB-10); introduction, avatar,
 * links, goal and need stay on the editor (`/me/profile/edit`). Each save is
 * one PATCH /me/profile and the page is then read again from the server.
 *
 * Not drawn, having no source (D-P1): member badges, "Hồ sơ đã duyệt",
 * activity counts, "Ai đang xem hồ sơ", "Dự án trên HUB", "Tiến trình phát
 * triển", certificates, the public URL, "Xem như Guest", "Mở với", "Tài
 * nguyên"; the years and the "Chính / Phụ" marks of a specialisation. An
 * experience record shows its "Loại hình" and "Địa điểm" (S1-UAT-05). No other member can
 * open this page (FP1 is not built), so the banner says only what is true.
 */

type Dialog =
  | { kind: 'experience'; index: number | null }
  | { kind: 'education'; index: number | null }
  | { kind: 'basic' }
  | { kind: 'expertise' }

const COPY = {
  mine: 'Đây là hồ sơ của bạn.',
  lockNote: 'chỉ bạn thấy.',
  lockLead: 'Phần có',
  settings: 'Cài đặt hồ sơ',
  contact: 'Thông tin liên hệ',
  addItem: '+ Thêm mục vào hồ sơ',
  suggest: 'Gợi ý cho bạn',
  onlyYou: 'Chỉ bạn thấy',
  complete: (percent: number, missing: number) =>
    missing > 0
      ? `Hồ sơ hoàn thiện ${percent}% · còn thiếu ${missing} mục`
      : `Hồ sơ hoàn thiện ${percent}%`,
  about: 'Giới thiệu',
  aboutEmpty: 'Chưa có giới thiệu.',
  experience: 'Kinh nghiệm',
  experienceEmpty: 'Chưa có kinh nghiệm.',
  current: 'Đang làm',
  now: 'nay',
  education: 'Học vấn',
  educationEmpty: 'Chưa có học vấn.',
  expertise: 'Chuyên môn',
  domains: 'Lĩnh vực quan tâm',
  expertiseEmpty: 'Chưa chọn chuyên môn.',
  expertiseNote: 'Gợi ý lấy từ danh mục của HUB; giá trị bạn tự gõ được HUB gom về danh mục sau.',
  ventures: 'DỰ ÁN & STARTUP',
  venturesEmpty: 'Bạn chưa thuộc đội nào.',
  create: '+ Tạo dự án / startup',
  all: 'Xem tất cả →',
  add: 'Thêm',
  edit: 'Sửa',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  coverPhoto: 'Ảnh bìa',
} as const

const TYPE_LABELS: Record<string, string> = { PROJECT: 'Dự án', STARTUP: 'Startup' }

function Pencil() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 11.6V13h1.4l6.9-6.9-1.4-1.4L3 11.6Zm9.9-6.4a.8.8 0 0 0 0-1.1l-1-1a.8.8 0 0 0-1.1 0l-.9.9 2.1 2.1.9-.9Z" />
    </svg>
  )
}

function Lock() {
  return (
    <svg className={styles.lock} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M3.5 5V3.8a2.5 2.5 0 0 1 5 0V5h.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V5.5A.5.5 0 0 1 3 5h.5Zm1 0h3V3.8a1.5 1.5 0 0 0-3 0V5Z" />
    </svg>
  )
}

function SectionHead({
  title,
  id,
  onAdd,
  onEdit,
  editHref,
  editing,
}: {
  title: string
  id: string
  onAdd?: () => void
  onEdit?: () => void
  editHref?: string
  editing?: boolean
}) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.tools}>
        {onAdd ? (
          <button
            type="button"
            className={styles.round}
            aria-label={`Thêm ${title.toLowerCase()}`}
            onClick={onAdd}
          >
            <span aria-hidden="true">+</span>
          </button>
        ) : null}
        {editHref ? (
          <Link href={editHref} className={styles.round} aria-label={`Sửa ${title.toLowerCase()}`}>
            <Pencil />
          </Link>
        ) : onEdit ? (
          <button
            type="button"
            className={styles.round}
            aria-label={`Sửa ${title.toLowerCase()}`}
            aria-pressed={editing}
            onClick={onEdit}
          >
            <Pencil />
          </button>
        ) : null}
      </div>
    </div>
  )
}

const experienceBody = (list: OwnProfileDTO['experience']) =>
  list.map((e) => ({
    title: e.title,
    organization_name: e.organization_name,
    started_on: e.started_on,
    ended_on: e.ended_on,
    description: e.description,
    employment_type: e.employment_type,
    location: e.location,
  }))

const educationBody = (list: OwnProfileDTO['education']) =>
  list.map((e) => ({
    institution: e.institution,
    programme: e.programme,
    started_on: e.started_on,
    ended_on: e.ended_on,
  }))

export function ProfileOwn({
  profile,
  completion,
  ventures,
  positions,
  durations,
  options,
}: {
  profile: OwnProfileDTO
  completion: { percent: number; missing: CompletionGroup[] }
  ventures: VentureSummaryDTO[]
  positions: string[]
  /** Months of each experience record, computed on the server; null without a start. */
  durations: (number | null)[]
  /** Countries and regions to pick; catalogue labels the tag fields suggest. */
  options: { countries: Option[]; regions: Option[]; domains: string[]; specializations: string[] }
}) {
  const router = useRouter()
  const ids = useId()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [editing, setEditing] = useState<'experience' | 'education' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [sectionError, setSectionError] = useState<string>()
  const inFlight = useRef(false)

  /** One PATCH; true when the server stored it. The page is then read again. */
  async function save(body: Record<string, unknown>): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setSaving(true)
    setError(undefined)
    setSectionError(undefined)
    try {
      await apiRequest('/me/profile', { method: 'PATCH', body })
      router.refresh()
      return true
    } catch (caught) {
      const failure = caught as { fields?: Record<string, string> } | null
      const reason = Object.values(failure?.fields ?? {})[0]
      const message =
        reason === 'invalid_period'
          ? 'Thời gian kết thúc phải sau thời gian bắt đầu.'
          : reason === 'invalid_month'
            ? 'Nhập theo dạng MM/YYYY.'
            : reason === 'institution_required'
              ? 'Trường này là bắt buộc.'
              : reason === 'too_many'
                ? 'Đã đạt số mục tối đa.'
                : reason === 'invalid'
                  ? 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
                  : COPY.failed
      setError(message)
      setSectionError(message)
      return false
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const closeDialog = () => {
    setDialog(null)
    setError(undefined)
  }

  function openSuggestion(item: Suggestion) {
    if (item.target === 'experience') setDialog({ kind: 'experience', index: null })
    else if (item.target === 'basic') setDialog({ kind: 'basic' })
    else if (item.target === 'expertise') setDialog({ kind: 'expertise' })
  }

  const place = [profile.region?.label, ...positions].filter(Boolean) as string[]
  const chips = [...profile.specializations, ...profile.domains].slice(0, 3)
  const tips = suggestions(completion.missing)

  // Experience: the dialog edits one record; the stage saves the whole list.
  const experience = experienceBody(profile.experience)
  const editingRecord =
    dialog?.kind === 'experience' && dialog.index !== null ? profile.experience[dialog.index] : null
  const education = educationBody(profile.education)

  return (
    <div className={styles.page} data-screen="FP1-OWN">
      <div className={styles.banner} data-anchor="banner">
        <div className={styles.bannerInner}>
          <p className={styles.bannerText}>
            <strong>{COPY.mine}</strong>
            <span>
              {COPY.lockLead} <Lock /> {COPY.lockNote}
            </span>
          </p>
          <Link href="/me/settings" className={styles.bannerButton} data-nav="profile-settings">
            {COPY.settings}
          </Link>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.identity} data-anchor="identity" aria-label={COPY.mine}>
            <div className={styles.cover}>
              <Inert reason="FUTURE" label={COPY.coverPhoto} className={styles.coverPencil}>
                <Pencil />
              </Inert>
            </div>
            <div className={styles.identityBody}>
              <span className={styles.avatar}>
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, session-authorised media route
                  <img src={profile.avatar.url} alt="" />
                ) : null}
              </span>
              <button
                type="button"
                className={`${styles.round} ${styles.identityPencil}`}
                aria-label="Sửa thông tin cơ bản"
                onClick={() => setDialog({ kind: 'basic' })}
              >
                <Pencil />
              </button>
              <h1 className={styles.name}>{profile.display_name}</h1>
              {profile.headline ? <p className={styles.headline}>{profile.headline}</p> : null}
              <p className={styles.place}>
                {place.map((part) => (
                  <span key={part}>{part}</span>
                ))}
                <button
                  type="button"
                  className={styles.contact}
                  onClick={() => setDialog({ kind: 'basic' })}
                >
                  {COPY.contact}
                </button>
              </p>
              {chips.length > 0 ? (
                <ul className={styles.chips} aria-label={COPY.expertise}>
                  {chips.map((chip) => (
                    <li key={chip.id}>{chip.label}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.identityActions}>
                <Link href="/me/profile/edit" className={styles.primary} data-nav="profile-edit">
                  {COPY.addItem}
                </Link>
              </div>
            </div>
          </section>

          {tips.length > 0 ? (
            <section className={styles.card} data-anchor="suggest" aria-labelledby={`${ids}-sug`}>
              <div className={`${styles.sectionHead} ${styles.plainHead}`}>
                <h2 id={`${ids}-sug`} className={styles.sectionTitle}>
                  {COPY.suggest}{' '}
                  <span className={styles.private}>
                    <Lock /> {COPY.onlyYou}
                  </span>
                </h2>
              </div>
              <div
                className={styles.bar}
                role="progressbar"
                aria-valuenow={completion.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={COPY.complete(completion.percent, completion.missing.length)}
              >
                <span style={{ width: `${completion.percent}%` }} />
              </div>
              <p className={styles.barText}>
                {COPY.complete(completion.percent, completion.missing.length)}
              </p>
              <ul className={styles.tips}>
                {tips.map((tip) => (
                  <li key={tip.group} className={styles.tip} data-suggestion={tip.group}>
                    <p className={styles.tipTitle}>{tip.title}</p>
                    {tip.target === 'editor' ? (
                      <Link href="/me/profile/edit" className={styles.tipAction}>
                        {tip.action}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={styles.tipAction}
                        onClick={() => openSuggestion(tip)}
                      >
                        {tip.action}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.card} data-anchor="about" aria-labelledby={`${ids}-about`}>
            <SectionHead id={`${ids}-about`} title={COPY.about} editHref="/me/profile/edit" />
            <p className={profile.bio ? styles.about : styles.empty}>
              {profile.bio ?? COPY.aboutEmpty}
            </p>
          </section>

          <section className={styles.card} data-anchor="experience" aria-labelledby={`${ids}-exp`}>
            <SectionHead
              id={`${ids}-exp`}
              title={COPY.experience}
              onAdd={() => setDialog({ kind: 'experience', index: null })}
              onEdit={() => setEditing((e) => (e === 'experience' ? null : 'experience'))}
              editing={editing === 'experience'}
            />
            {sectionError && dialog === null ? (
              <div className={styles.sectionError}>
                <Notice tone="error">{sectionError}</Notice>
              </div>
            ) : null}
            {profile.experience.length === 0 ? (
              <p className={styles.empty}>{COPY.experienceEmpty}</p>
            ) : (
              <ul className={styles.records}>
                {profile.experience.map((record, i) => {
                  const months = durations[i]
                  const period = record.started_on
                    ? [
                        `${monthText(record.started_on)} – ${record.ended_on ? monthText(record.ended_on) : COPY.now}`,
                        months !== null && months !== undefined ? durationText(months) : '',
                        record.location ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : null
                  return (
                    <li key={record.id} className={styles.record} data-record="experience">
                      <span className={styles.recordTile} aria-hidden="true">
                        {initials(record.organization_name ?? record.title)}
                      </span>
                      <div className={styles.recordText}>
                        <p className={styles.recordTitle}>
                          {record.title}
                          {record.started_on && !record.ended_on ? (
                            <span className={styles.currentChip}>{COPY.current}</span>
                          ) : null}
                        </p>
                        {record.organization_name || record.employment_type ? (
                          <p className={styles.recordSub}>
                            {[record.organization_name, record.employment_type]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        {period ? (
                          <p className={styles.recordMeta}>{period}</p>
                        ) : record.location ? (
                          <p className={styles.recordMeta}>{record.location}</p>
                        ) : null}
                        {record.description ? (
                          <ul className={styles.bullets}>
                            {record.description
                              .split('\n')
                              .map((line) => line.replace(/^[\s·•-]+/, '').trim())
                              .filter(Boolean)
                              .map((line, n) => (
                                <li key={n}>{line}</li>
                              ))}
                          </ul>
                        ) : null}
                      </div>
                      {editing === 'experience' ? (
                        <button
                          type="button"
                          className={styles.recordEdit}
                          aria-label={`${COPY.edit} ${record.title}`}
                          onClick={() => setDialog({ kind: 'experience', index: i })}
                        >
                          <Pencil />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={styles.card} data-anchor="education" aria-labelledby={`${ids}-edu`}>
            <SectionHead
              id={`${ids}-edu`}
              title={COPY.education}
              onAdd={() => setDialog({ kind: 'education', index: null })}
              onEdit={() => setEditing((e) => (e === 'education' ? null : 'education'))}
              editing={editing === 'education'}
            />
            {profile.education.length === 0 ? (
              <p className={styles.empty}>{COPY.educationEmpty}</p>
            ) : (
              <ul className={styles.records}>
                {profile.education.map((record, i) => (
                  <li key={record.id} className={styles.record} data-record="education">
                    <span className={styles.recordTile} aria-hidden="true">
                      {initials(record.institution)}
                    </span>
                    <div className={styles.recordText}>
                      <p className={styles.recordTitle}>{record.institution}</p>
                      {record.programme ? (
                        <p className={styles.recordSub}>{record.programme}</p>
                      ) : null}
                      {record.started_on ? (
                        <p className={styles.recordMeta}>
                          {record.started_on.slice(0, 4)} –{' '}
                          {record.ended_on ? record.ended_on.slice(0, 4) : COPY.now}
                        </p>
                      ) : null}
                    </div>
                    {editing === 'education' ? (
                      <button
                        type="button"
                        className={styles.recordEdit}
                        aria-label={`${COPY.edit} ${record.institution}`}
                        onClick={() => setDialog({ kind: 'education', index: i })}
                      >
                        <Pencil />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card} data-anchor="expertise" aria-labelledby={`${ids}-sp`}>
            <SectionHead
              id={`${ids}-sp`}
              title={COPY.expertise}
              onAdd={() => setDialog({ kind: 'expertise' })}
              onEdit={() => setDialog({ kind: 'expertise' })}
            />
            {profile.specializations.length === 0 ? (
              <p className={styles.empty}>{COPY.expertiseEmpty}</p>
            ) : (
              <ul className={styles.rows}>
                {profile.specializations.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            )}
            {profile.domains.length > 0 ? (
              <>
                <p className={styles.subhead}>{COPY.domains}</p>
                <ul className={styles.chips} data-anchor="domains">
                  {profile.domains.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className={styles.note}>{COPY.expertiseNote}</p>
          </section>
        </div>

        <aside className={styles.side} aria-label={COPY.ventures}>
          <section className={styles.sideCard} data-anchor="ventures">
            <p className={styles.sideEyebrow}>{COPY.ventures}</p>
            {ventures.length === 0 ? (
              <p className={styles.empty}>{COPY.venturesEmpty}</p>
            ) : (
              <ul className={styles.ventures}>
                {ventures.slice(0, 3).map((venture) => (
                  <li key={venture.id}>
                    <Link href={`/projects/${venture.id}/edit`} className={styles.venture}>
                      <span className={styles.ventureTile} data-type={venture.type}>
                        {initials(venture.name)}
                      </span>
                      <span className={styles.ventureText}>
                        <span className={styles.ventureName}>
                          {venture.name}
                          <span className={styles.ventureType}>
                            {TYPE_LABELS[venture.type] ?? venture.type}
                          </span>
                        </span>
                        <span className={styles.ventureFacts}>
                          {[venture.stage?.label, venture.domains[0]?.label, venture.role_label]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/projects/new" className={styles.sideCreate} data-nav="create-project">
              {COPY.create}
            </Link>
            <Link href="/projects" className={styles.sideAll} data-nav="projects">
              {COPY.all}
            </Link>
          </section>
        </aside>
      </div>

      {dialog?.kind === 'experience' ? (
        <ExperienceDialog
          record={
            editingRecord
              ? ({
                  title: editingRecord.title,
                  organization_name: editingRecord.organization_name ?? '',
                  started_on: editingRecord.started_on ?? '',
                  ended_on: editingRecord.ended_on ?? '',
                  description: editingRecord.description ?? '',
                  employment_type: editingRecord.employment_type ?? '',
                  location: editingRecord.location ?? '',
                } satisfies ExperienceRecord)
              : null
          }
          saving={saving}
          error={error}
          onClose={closeDialog}
          onSave={(next) => {
            const record = {
              title: next.title,
              organization_name: next.organization_name || null,
              started_on: next.started_on || null,
              ended_on: next.ended_on || null,
              description: next.description || null,
              employment_type: next.employment_type || null,
              location: next.location || null,
            }
            const list =
              dialog.index === null
                ? [...experience, record]
                : experience.map((r, n) => (n === dialog.index ? record : r))
            return save({
              experience: list,
              ...(profile.no_experience_yet ? { no_experience_yet: false } : {}),
            })
          }}
          onDelete={
            dialog.index !== null
              ? () => save({ experience: experience.filter((_, n) => n !== dialog.index) })
              : undefined
          }
        />
      ) : null}

      {dialog?.kind === 'education' ? (
        <EducationDialog
          record={dialog.index !== null ? (profile.education[dialog.index] ?? null) : null}
          saving={saving}
          error={error}
          onClose={closeDialog}
          onSave={async (record) => {
            const list =
              dialog.index === null
                ? [...education, record]
                : education.map((r, n) => (n === dialog.index ? record : r))
            if (await save({ education: list })) closeDialog()
          }}
          onDelete={
            dialog.index !== null
              ? async () => {
                  if (await save({ education: education.filter((_, n) => n !== dialog.index) }))
                    closeDialog()
                }
              : undefined
          }
        />
      ) : null}

      {dialog?.kind === 'basic' ? (
        <BasicDialog
          profile={profile}
          countries={options.countries}
          regions={options.regions}
          saving={saving}
          error={error}
          onClose={closeDialog}
          onSave={async (body) => {
            if (await save(body)) closeDialog()
          }}
        />
      ) : null}

      {dialog?.kind === 'expertise' ? (
        <ExpertiseDialog
          selected={{
            domains: profile.domains.map((d) => d.label),
            specializations: profile.specializations.map((s) => s.label),
          }}
          domains={options.domains}
          specializations={options.specializations}
          saving={saving}
          error={error}
          onClose={closeDialog}
          onSave={async (body) => {
            if (await save(body)) closeDialog()
          }}
        />
      ) : null}
    </div>
  )
}
