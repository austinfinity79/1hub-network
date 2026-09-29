'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import { HeaderAction, Optional, saveMessage, useLeave } from '../parts'
import stage from '../stage.module.css'
import styles from './capability.module.css'
import { ExperienceDialog, type ExperienceRecord } from './experience-dialog'

/**
 * ACC-07 — onboarding stage 2, "Năng lực và lĩnh vực hoạt động" (BA workbook
 * rows 56, 68; DEC-L1R-D4).
 *
 * Nothing is required. Fields (multi-select), specialisations (at most 5) and
 * skills come from the controlled vocabulary; a skill is picked, never typed
 * in as free text. Experience records are edited in the L12 dialog and saved
 * with the stage. "Tiếp tục" saves, records the stage as passed and opens
 * stage 3; "Lưu và hoàn tất sau" saves and leaves. The board's AI banner and
 * "AI đề xuất" marks belong to suggested items, and there are none (D-A1).
 */

type Option = { id: string; label: string }
export type StoredLink = { label: string | null; url: string }

type Initial = {
  domain_ids: string[]
  specialization_ids: string[]
  skill_ids: string[]
  experience: ExperienceRecord[]
  no_experience_yet: boolean
  links: StoredLink[]
}

const MAX_SPECIALIZATIONS = 5
/** Chips shown before "+ N lĩnh vực khác", as on the board. */
const VISIBLE_DOMAINS = 8
/** Quick picks under the skill control, as on the board. */
const SUGGESTED_SKILLS = 3

const LINKEDIN = 'LinkedIn'
const WEBSITE = 'Website'

/** Copy for states the board does not show. */
const MESSAGES = {
  skillUnknown: 'Vui lòng chọn kỹ năng trong danh mục chuẩn.',
  link: 'Liên kết chưa hợp lệ.',
  linkCount: 'Hồ sơ giữ tối đa 5 liên kết.',
} as const

const years = (record: ExperienceRecord) =>
  record.started_on
    ? `${record.started_on.slice(0, 4)} – ${record.ended_on ? record.ended_on.slice(0, 4) : 'nay'}`
    : ''

/** The board draws addresses without a scheme; they are stored absolute. */
const absolute = (value: string) => {
  const text = value.trim()
  return !text || /^https?:\/\//i.test(text) ? text : `https://${text}`
}

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()

export function CapabilityForm({
  initial,
  domains,
  specializations,
  skills,
}: {
  initial: Initial
  domains: Option[]
  specializations: Option[]
  skills: Option[]
}) {
  const leave = useLeave()
  const ids = useId()
  const [domainIds, setDomainIds] = useState(initial.domain_ids)
  const [specializationIds, setSpecializationIds] = useState(initial.specialization_ids)
  const [skillIds, setSkillIds] = useState(initial.skill_ids)
  const [skillText, setSkillText] = useState('')
  const [skillError, setSkillError] = useState<string>()
  const [experience, setExperience] = useState(initial.experience)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [linkedin, setLinkedin] = useState(
    initial.links.find((l) => l.label === LINKEDIN)?.url ?? '',
  )
  const [website, setWebsite] = useState(initial.links.find((l) => l.label === WEBSITE)?.url ?? '')
  const [expanded, setExpanded] = useState(false)
  const [linkError, setLinkError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState<'next' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)

  const id = (name: string) => `${ids}-${name}`

  // Selected items first, in the order the server gave, so none hides behind "+ N".
  const [domainOrder] = useState(() => [
    ...domains.filter((o) => initial.domain_ids.includes(o.id)),
    ...domains.filter((o) => !initial.domain_ids.includes(o.id)),
  ])
  const shownDomains = expanded ? domainOrder : domainOrder.slice(0, VISIBLE_DOMAINS)
  const hiddenDomains = domainOrder.length - shownDomains.length
  const specializationsFull = specializationIds.length >= MAX_SPECIALIZATIONS

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  const pickedSkills = skillIds
    .map((value) => skills.find((s) => s.id === value))
    .filter((s): s is Option => Boolean(s))
  const openSkills = skills.filter((s) => !skillIds.includes(s.id))

  function addSkill(option: Option) {
    setSkillIds((current) => (current.includes(option.id) ? current : [...current, option.id]))
    setSkillText('')
    setSkillError(undefined)
  }

  /** Adds the item the field names: the item, `null` for an empty field, `false` for no item. */
  function commitSkill(text: string): Option | null | false {
    const wanted = fold(text)
    if (!wanted) return null
    const exact = openSkills.find((s) => fold(s.label) === wanted)
    const starts = openSkills.filter((s) => fold(s.label).startsWith(wanted))
    const match = exact ?? (starts.length === 1 ? starts[0] : undefined)
    if (!match) {
      setSkillError(MESSAGES.skillUnknown)
      return false
    }
    addSkill(match)
    return match
  }

  function onSkillKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitSkill(skillText)
    } else if (event.key === 'Backspace' && !skillText && skillIds.length > 0) {
      setSkillIds((current) => current.slice(0, -1))
    }
  }

  async function save(mode: 'next' | 'later') {
    if (inFlight.current) return
    setFormError(undefined)
    setLinkError(undefined)
    const typed = commitSkill(skillText)
    if (typed === false) return
    // The field's item reaches the state after this call, so it is added here too.
    const chosenSkills = typed ? [...skillIds, typed.id] : skillIds

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
          domain_ids: domainIds,
          specialization_ids: specializationIds,
          skill_ids: chosenSkills,
          experience: experience.map((record) => ({
            title: record.title,
            organization_name: record.organization_name || null,
            started_on: record.started_on || null,
            ended_on: record.ended_on || null,
            description: record.description || null,
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

          <div className={styles.guide} data-anchor="guide">
            <div>
              <p className={styles.guideLabel}>LĨNH VỰC</p>
              <p className={styles.guideBody}>
                Ngành hoặc chủ đề bạn quan tâm, nghiên cứu hoặc hoạt động.
              </p>
              <p className={styles.guideExample}>Ví dụ: AI · Fintech · EdTech · Climate Tech</p>
            </div>
            <div>
              <p className={styles.guideLabel}>CHUYÊN MÔN</p>
              <p className={styles.guideBody}>Chức năng hoặc năng lực nghề nghiệp của bạn.</p>
              <p className={styles.guideExample}>
                Ví dụ: Product · Business Development · Technology · Design · Marketing · Finance ·
                Legal
              </p>
            </div>
          </div>

          <fieldset className={styles.block} data-anchor="domains" aria-labelledby={id('domains')}>
            <div className={styles.blockHead}>
              <h2 id={id('domains')} className={styles.blockTitle}>
                Lĩnh vực quan tâm
              </h2>
              <span className={styles.blockNote}>CHỌN NHIỀU</span>
            </div>
            <p className={styles.blockLede}>
              Chọn các ngành hoặc chủ đề bạn đang hoạt động hoặc quan tâm.
            </p>
            <div className={styles.chips}>
              {shownDomains.map((option) => (
                <Chip
                  key={option.id}
                  option={option}
                  checked={domainIds.includes(option.id)}
                  onChange={() => setDomainIds((current) => toggle(current, option.id))}
                />
              ))}
              {hiddenDomains > 0 ? (
                <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
                  + {hiddenDomains} lĩnh vực khác
                </button>
              ) : null}
            </div>
          </fieldset>

          <fieldset
            className={styles.block}
            data-anchor="specializations"
            aria-labelledby={id('specializations')}
          >
            <div className={styles.blockHead}>
              <h2 id={id('specializations')} className={styles.blockTitle}>
                Chuyên môn
              </h2>
              <span className={styles.blockNote} aria-live="polite">
                ĐÃ CHỌN {specializationIds.length}/{MAX_SPECIALIZATIONS}
              </span>
            </div>
            <p className={styles.blockLede}>
              Chọn những chức năng hoặc năng lực chuyên môn nổi bật nhất.
            </p>
            <div className={styles.chips}>
              {specializations.map((option) => {
                const checked = specializationIds.includes(option.id)
                return (
                  <Chip
                    key={option.id}
                    option={option}
                    checked={checked}
                    disabled={!checked && specializationsFull}
                    onChange={() =>
                      setSpecializationIds((current) =>
                        current.includes(option.id) || current.length < MAX_SPECIALIZATIONS
                          ? toggle(current, option.id)
                          : current,
                      )
                    }
                  />
                )
              })}
            </div>
          </fieldset>

          <div className={styles.block} data-anchor="skills">
            <label className={styles.blockTitle} htmlFor={id('skill')}>
              Kỹ năng
            </label>
            <div className={styles.tags}>
              {pickedSkills.map((skill) => (
                <span key={skill.id} className={styles.tag} data-skill={skill.id}>
                  {skill.label}
                  <button
                    type="button"
                    className={styles.tagRemove}
                    aria-label={`Bỏ ${skill.label}`}
                    onClick={() => setSkillIds((current) => current.filter((x) => x !== skill.id))}
                  >
                    <svg viewBox="0 0 9 9" aria-hidden="true" focusable="false">
                      <path d="M1 1l7 7M8 1L1 8" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                id={id('skill')}
                className={styles.tagInput}
                list={id('skill-list')}
                autoComplete="off"
                placeholder="Thêm kỹ năng..."
                aria-invalid={skillError ? true : undefined}
                aria-describedby={skillError ? id('skill-error') : id('skill-help')}
                value={skillText}
                onChange={(e) => {
                  const text = e.target.value
                  setSkillText(text)
                  setSkillError(undefined)
                  // Picking from the list fills the whole label: take it at once.
                  const exact = openSkills.find((s) => s.label === text)
                  if (exact) addSkill(exact)
                }}
                onKeyDown={onSkillKey}
              />
              <datalist id={id('skill-list')}>
                {openSkills.map((skill) => (
                  <option key={skill.id} value={skill.label} />
                ))}
              </datalist>
            </div>
            {skillError ? (
              <p id={id('skill-error')} role="alert" className={stage.error}>
                {skillError}
              </p>
            ) : null}
            {openSkills.length > 0 ? (
              <p className={styles.suggest}>
                Gợi ý chuẩn:
                {openSkills.slice(0, SUGGESTED_SKILLS).map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={styles.suggestItem}
                    onClick={() => addSkill(skill)}
                  >
                    + {skill.label}
                  </button>
                ))}
              </p>
            ) : null}
            <p id={id('skill-help')} className={styles.example}>
              Ví dụ: Pitching, Nghiên cứu, Phân tích dữ liệu, Gọi vốn, UI/UX
            </p>
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

function Chip({
  option,
  checked,
  disabled,
  onChange,
}: {
  option: Option
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <label className={styles.chip}>
      <input
        type="checkbox"
        className={stage.srOnly}
        value={option.id}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {checked ? (
        <svg viewBox="0 0 10 10" className={styles.check} aria-hidden="true" focusable="false">
          <path d="M1.2 5.4l2.5 2.5 5-6" />
        </svg>
      ) : null}
      {option.label}
    </label>
  )
}
