'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { apiRequest } from '@/lib/api/client'
import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import { applicationRoutes } from '@/lib/application/routes'
import type { ApplicantType } from '@/lib/application/types'

import styles from './application.module.css'

type Option = { id: string; label: string }
type VentureType = 'PROJECT' | 'STARTUP'

/** DEC-WF05-G4 in reverse: the venture type that gives an applicant type. */
const TYPE_FOR: Record<ApplicantType, VentureType> = { TEAM: 'PROJECT', STARTUP: 'STARTUP' }

/**
 * TASK 24.4 — SUB0, quick team (L37, DEC-L5-D5). Shown only when the member
 * owns no venture that may apply. It creates the canonical venture through
 * `POST /ventures` (the WF02 rules, audit and idempotency) and opens its
 * application form; the application itself is created on the first save.
 * The type is asked only when the programme accepts both (HD-A11); the stage
 * is asked because the canonical venture requires it (DEC-L2R-D4).
 */
export function QuickTeam({
  programmeId,
  displayName,
  applicantTypes,
  domains,
  stages,
}: {
  programmeId: string
  displayName: string
  applicantTypes: ApplicantType[]
  domains: Option[]
  stages: Option[]
}) {
  const router = useRouter()
  const types = applicantTypes.map((t) => TYPE_FOR[t])
  const [type, setType] = useState<VentureType | null>(types.length === 1 ? types[0]! : null)
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [stage, setStage] = useState('')
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const key = useRef<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const missing: Record<string, string> = {}
    if (!name.trim()) missing.name = COPY.fieldRequired
    if (!type) missing.type = COPY.fieldRequired
    if (picked.length === 0) missing.domain_ids = COPY.fieldRequired
    if (!stage) missing.stage_id = COPY.fieldRequired
    if (!summary.trim()) missing.summary = COPY.fieldRequired
    setErrors(missing)
    if (Object.keys(missing).length || busy) return
    setBusy(true)
    setFailed(false)
    key.current ??= crypto.randomUUID()
    try {
      const created = await apiRequest<{ id: string }>('/ventures', {
        method: 'POST',
        body: {
          type,
          name: name.trim(),
          summary: summary.trim(),
          domain_ids: picked,
          stage_id: stage,
        },
        idempotencyKey: key.current,
      })
      router.push(applicationRoutes.form(created.id, programmeId))
    } catch (caught) {
      const fields = (caught as { fields?: Record<string, string> }).fields ?? {}
      setErrors(Object.fromEntries(Object.keys(fields).map((f) => [f, COPY.fieldRequired])))
      setFailed(true)
      setBusy(false)
    }
  }

  const labels = domains
    .filter((d) => picked.includes(d.id))
    .map((d) => d.label)
    .join(' · ')

  const error = (field: string) =>
    errors[field] ? (
      <p className={styles.fieldError} role="alert">
        {errors[field]}
      </p>
    ) : null

  return (
    <div className={styles.page} data-screen="L5-SUB0">
      <header className={`${styles.bar} ${styles.barSlim}`}>
        <span className={styles.brand}>HUB NETWORK</span>
        <span className={styles.who}>{displayName}</span>
      </header>
      <form className={styles.quick} onSubmit={submit} noValidate>
        <span className={styles.chip} data-anchor="chip">
          {COPY.quickChip}
        </span>
        <h1 className={styles.quickTitle}>{COPY.quickTitle}</h1>
        <p className={styles.quickLead}>{COPY.quickLead}</p>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quick-name">
            {COPY.nameLabel}
            <span className={styles.required}>{COPY.required}</span>
          </label>
          <p className={styles.help}>{COPY.nameHelp}</p>
          <input
            id="quick-name"
            className={styles.input}
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
          {error('name')}
        </div>

        {types.length > 1 ? (
          <fieldset className={styles.field}>
            <legend className={styles.fieldLabel}>
              {COPY.typeLabel}
              <span className={styles.required}>{COPY.required}</span>
            </legend>
            <p className={styles.help}>{COPY.typeHelp}</p>
            <div className={styles.choices}>
              {types.map((t) => (
                <label key={t} className={styles.choice}>
                  <input
                    type="radio"
                    name="quick-type"
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  {COPY.types[t]}
                </label>
              ))}
            </div>
            {error('type')}
          </fieldset>
        ) : null}

        {/* The WF02 domain picker (L37): a field showing the choices, opening the list. */}
        <div className={styles.field}>
          <p id="quick-domain-label" className={styles.fieldLabel}>
            {COPY.domainLabel}
            <span className={styles.required}>{COPY.required}</span>
          </p>
          <p id="quick-domain-help" className={styles.help}>
            {COPY.domainHelp}
          </p>
          <button
            type="button"
            className={`${styles.input} ${styles.picker}`}
            aria-expanded={open}
            aria-controls="quick-domain-list"
            aria-labelledby="quick-domain-label"
            aria-describedby="quick-domain-help"
            onClick={() => setOpen((o) => !o)}
            data-action="domain-picker"
          >
            <span className={labels ? undefined : styles.placeholder}>
              {labels || COPY.domainPlaceholder}
            </span>
          </button>
          {open ? (
            <ul id="quick-domain-list" className={styles.choices} aria-label={COPY.domainLabel}>
              {domains.map((d) => {
                const on = picked.includes(d.id)
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={styles.choice}
                      aria-pressed={on}
                      onClick={() =>
                        setPicked((all) => (on ? all.filter((x) => x !== d.id) : [...all, d.id]))
                      }
                    >
                      {d.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {error('domain_ids')}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quick-stage">
            {COPY.stageLabel}
            <span className={styles.required}>{COPY.required}</span>
          </label>
          <p className={styles.help}>{COPY.stageHelp}</p>
          <select
            id="quick-stage"
            className={styles.select}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">{COPY.stagePlaceholder}</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {error('stage_id')}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="quick-summary">
            {COPY.summaryLabel}
            <span className={styles.required}>{COPY.required}</span>
          </label>
          <p className={styles.help}>{COPY.summaryHelp}</p>
          <input
            id="quick-summary"
            className={styles.input}
            value={summary}
            maxLength={2000}
            onChange={(e) => setSummary(e.target.value)}
          />
          {error('summary')}
        </div>

        <p className={styles.note}>{COPY.quickNote}</p>
        {failed ? (
          <p className={styles.alert} role="alert">
            {COPY.quickFailed}
          </p>
        ) : null}
        <div className={styles.quickActions}>
          <button type="submit" className={styles.primary} disabled={busy} data-action="quick-go">
            {COPY.quickGo}
          </button>
        </div>
      </form>
    </div>
  )
}
