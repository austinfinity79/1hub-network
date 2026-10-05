'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { TagInput } from '@/components/ui/tag-input'
import { apiRequest } from '@/lib/api/client'

import { HeaderAction, Optional, saveMessage, useLeave } from '../parts'
import stage from '../stage.module.css'
import styles from './capability.module.css'
import { ExperienceDialog, type ExperienceRecord } from './experience-dialog'

/**
 * ACC-07 — onboarding stage 2, "Năng lực và lĩnh vực hoạt động" (BA workbook
 * rows 56, 68; DEC-L1R-D4).
 *
 * S1-UAT-05 (FB-09, FB-10): "Lĩnh vực quan tâm" and "Chuyên môn" are free
 * text with catalogue suggestions, 1–5 tags each, required to continue (not to
 * "save and finish later"); a value outside the catalogue is stored as
 * "chưa chuẩn hóa" by the server. "Kỹ năng" is gone. Experience records are
 * edited in the L12 dialog (with "Loại hình" and "Địa điểm") and saved with the
 * stage. "Tiếp tục" saves, records the stage as passed and opens
 * stage 3; "Lưu và hoàn tất sau" saves and leaves. The board's AI banner and
 * "AI đề xuất" marks belong to suggested items, and there are none (D-A1).
 *
 * S1-UAT-09 (FB-08): no "LĨNH VỰC / CHUYÊN MÔN" guide block and no line under
 * the two field titles; only the titles and the short placeholders stay.
 */

export type StoredLink = { label: string | null; url: string }

type Initial = {
  domains: string[]
  specializations: string[]
  experience: ExperienceRecord[]
  no_experience_yet: boolean
  links: StoredLink[]
}

const MAX_TAGS = 5

const LINKEDIN = 'LinkedIn'
const WEBSITE = 'Website'

/** Copy for states the board does not show. */
const MESSAGES = {
  domains: 'Vui lòng thêm ít nhất một lĩnh vực.',
  specializations: 'Vui lòng thêm ít nhất một chuyên môn.',
  link: 'Liên kết chưa hợp lệ.',
  linkCount: 'Hồ sơ giữ tối đa 5 liên kết.',
} as const

const years = (record: ExperienceRecord) =>
  [
    record.started_on
      ? `${record.started_on.slice(0, 4)} – ${record.ended_on ? record.ended_on.slice(0, 4) : 'nay'}`
      : '',
    record.employment_type,
    record.location,
  ]
    .filter(Boolean)
    .join(' · ')

/** The board draws addresses without a scheme; they are stored absolute. */
const absolute = (value: string) => {
  const text = value.trim()
  return !text || /^https?:\/\//i.test(text) ? text : `https://${text}`
}

export function CapabilityForm({
  initial,
  domainOptions,
  specializationOptions,
}: {
  initial: Initial
  /** Canonical labels the tag fields suggest. */
  domainOptions: string[]
  specializationOptions: string[]
}) {
  const leave = useLeave()
  const ids = useId()
  const [domains, setDomains] = useState(initial.domains)
  const [specializations, setSpecializations] = useState(initial.specializations)
  const [tagErrors, setTagErrors] = useState<{ domains?: string; specializations?: string }>({})
  const [experience, setExperience] = useState(initial.experience)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [linkedin, setLinkedin] = useState(
    initial.links.find((l) => l.label === LINKEDIN)?.url ?? '',
  )
  const [website, setWebsite] = useState(initial.links.find((l) => l.label === WEBSITE)?.url ?? '')
  const [linkError, setLinkError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState<'next' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)

  const id = (name: string) => `${ids}-${name}`

  async function save(mode: 'next' | 'later') {
    if (inFlight.current) return
    setFormError(undefined)
    setLinkError(undefined)
    // US-01.09: continuing needs one of each; saving for later does not.
    if (mode === 'next') {
      const missing = {
        domains: domains.length === 0 ? MESSAGES.domains : undefined,
        specializations: specializations.length === 0 ? MESSAGES.specializations : undefined,
      }
      setTagErrors(missing)
      if (missing.domains || missing.specializations) return
    }

    const others = initial.links.filter((l) => l.label !== LINKEDIN && l.label !== WEBSITE)
    const links = [
      ...(linkedin.trim() ? [{ label: LINKEDIN, url: absolute(linkedin) }] : []),
      ...(website.trim() ? [{ label: WEBSITE, url: absolute(website) }] : []),
      ...others,
    ]

    inFlight.current = true
    setSaving(mode)
    try {
      await apiRequest('/me/profile', {
        method: 'PATCH',
        body: {
          domains,
          specializations,
          experience: experience.map((record) => ({
            title: record.title,
            organization_name: record.organization_name || null,
            started_on: record.started_on || null,
            ended_on: record.ended_on || null,
            description: record.description || null,
            employment_type: record.employment_type || null,
            location: record.location || null,
          })),
          // Records and "no experience yet" never coexist (DEC-WF02-S02-D1).
          ...(experience.length > 0 && initial.no_experience_yet
            ? { no_experience_yet: false }
            : {}),
          links,
        },
      })
      if (mode === 'next') {
        await apiRequest('/me/onboarding/stage', {
          method: 'PUT',
          body: { completed: 'CAPABILITY' },
        })
      }
      leave(mode === 'next' ? '/onboarding/purpose' : '/')
      // Stay busy while navigating, so the mutation cannot repeat.
    } catch (caught) {
      inFlight.current = false
      setSaving(undefined)
      const fields = (caught as { fields?: Record<string, string> } | null)?.fields
      if (fields?.links) {
        setLinkError(fields.links === 'too_many' ? MESSAGES.linkCount : MESSAGES.link)
      } else setFormError(saveMessage(caught))
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save('next')
  }

  const busy = saving !== undefined
  const record = typeof editing === 'number' ? (experience[editing] ?? null) : null

  return (
    <div className={styles.card} data-screen="ACC-07">
      <HeaderAction>
        <button type="button" disabled={busy} onClick={() => void save('later')}>
          Lưu và hoàn tất sau
        </button>
      </HeaderAction>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby={id('title')}>
          <h1 id={id('title')} className={stage.title}>
            Năng lực và lĩnh vực hoạt động
          </h1>
          <p className={styles.lede}>
            Thông tin này giúp hệ thống đề xuất cơ hội phù hợp hơn với bạn.
          </p>

          <div className={styles.block} data-anchor="domains">
            <div className={styles.blockHead}>
              <label id={id('domains')} className={styles.blockTitle} htmlFor={id('domain')}>
                Lĩnh vực quan tâm
              </label>
              <span className={styles.blockNote} aria-live="polite">
                ĐÃ THÊM {domains.length}/{MAX_TAGS}
              </span>
            </div>
            <TagInput
              id={id('domain')}
              name="domains"
              labelledBy={id('domains')}
              tags={domains}
              options={domainOptions}
              placeholder="Gõ lĩnh vực, Enter để thêm"
              error={tagErrors.domains}
              onChange={(next) => {
                setDomains(next)
                setTagErrors((e) => ({ ...e, domains: undefined }))
              }}
            />
          </div>

          <div className={styles.block} data-anchor="specializations">
            <div className={styles.blockHead}>
              <label
                id={id('specializations')}
                className={styles.blockTitle}
                htmlFor={id('specialization')}
              >
                Chuyên môn
              </label>
              <span className={styles.blockNote} aria-live="polite">
                ĐÃ THÊM {specializations.length}/{MAX_TAGS}
              </span>
            </div>
            <TagInput
              id={id('specialization')}
              name="specializations"
              labelledBy={id('specializations')}
              tags={specializations}
              options={specializationOptions}
              placeholder="Gõ chuyên môn, Enter để thêm"
              error={tagErrors.specializations}
              onChange={(next) => {
                setSpecializations(next)
                setTagErrors((e) => ({ ...e, specializations: undefined }))
              }}
            />
          </div>

          <div className={styles.block} data-anchor="experience">
            <h2 className={styles.blockTitle}>Kinh nghiệm nổi bật</h2>
            <p className={styles.blockLede}>
              Thêm những kinh nghiệm thể hiện rõ nhất năng lực của bạn.
            </p>
            {experience.length > 0 ? (
              <ul className={styles.records}>
                {experience.map((item, i) => (
                  <li key={i} className={styles.record}>
                    <div className={styles.recordText}>
                      <p className={styles.recordTitle}>
                        {item.organization_name
                          ? `${item.title} — ${item.organization_name}`
                          : item.title}
                      </p>
                      {years(item) ? <p className={styles.recordMeta}>{years(item)}</p> : null}
                    </div>
                    <div className={styles.recordActions}>
                      <button
                        type="button"
                        className={styles.recordAction}
                        aria-label={`Sửa ${item.title}`}
                        onClick={() => setEditing(i)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={styles.recordAction}
                        data-tone="remove"
                        aria-label={`Bỏ ${item.title}`}
                        onClick={() => setExperience((list) => list.filter((_, n) => n !== i))}
                      >
                        Bỏ
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className={styles.add} onClick={() => setEditing('new')}>
              + Thêm kinh nghiệm
            </button>
          </div>

          <div className={styles.block} data-anchor="links">
            <h2 className={styles.blockTitle}>Liên kết</h2>
            <div className={styles.links}>
              <div className={`${stage.field} ${styles.linkField}`}>
                <label className={stage.label} htmlFor={id('linkedin')}>
                  LinkedIn
                  <Optional />
                </label>
                <div className={stage.control}>
                  <input
                    id={id('linkedin')}
                    className="ui-input"
                    name="linkedin"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="Dán liên kết LinkedIn"
                    aria-invalid={linkError ? true : undefined}
                    aria-describedby={linkError ? id('link-error') : undefined}
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
              </div>
              <div className={`${stage.field} ${styles.linkField}`}>
                <label className={stage.label} htmlFor={id('website')}>
                  Website/Portfolio
                  <Optional />
                </label>
                <div className={stage.control}>
                  <input
                    id={id('website')}
                    className="ui-input"
                    name="website"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="Dán liên kết website hoặc portfolio"
                    aria-invalid={linkError ? true : undefined}
                    aria-describedby={linkError ? id('link-error') : undefined}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {linkError ? (
              <p id={id('link-error')} role="alert" className={stage.error}>
                {linkError}
              </p>
            ) : null}
          </div>

          {formError ? (
            <div className={stage.formError}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <hr className={`${stage.rule} ${styles.end}`} data-anchor="rule" />

          <div className={styles.footer} data-anchor="footer">
            <Link
              href="/onboarding/profile"
              className="ui-button"
              data-variant="secondary"
              data-nav="back"
            >
              <span>Quay lại</span>
            </Link>
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

      {editing !== null ? (
        <ExperienceDialog
          record={record}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setExperience((list) =>
              editing === 'new' ? [...list, next] : list.map((r, n) => (n === editing ? next : r)),
            )
            setEditing(null)
          }}
          onDelete={
            typeof editing === 'number'
              ? () => {
                  setExperience((list) => list.filter((_, n) => n !== editing))
                  setEditing(null)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
