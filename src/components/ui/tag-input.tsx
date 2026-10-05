'use client'

import { useId, useState, type KeyboardEvent } from 'react'

import styles from './tag-input.module.css'

/**
 * FB-09 — free text with suggestions, the ONE tag control for "Lĩnh vực quan
 * tâm" and "Chuyên môn" (onboarding stage 2, the profile dialog, the editor).
 *
 * Typing shows up to 8 catalogue suggestions; the closest canonical value
 * ("fin tech" → "Fintech") comes first. Enter adds the highlighted suggestion,
 * or the typed text when none is highlighted: a value outside the catalogue is
 * allowed and the server stores it as "chưa chuẩn hóa". Limits: 1–5 tags of
 * 2–40 characters, no duplicate (case and extra spaces ignored). Leaving the
 * field adds a valid typed value, so a save never drops it.
 */

export const TAG_RULES = { min: 2, max: 40, count: 5, suggestions: 8 } as const

const clean = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ')
const key = (text: string) => clean(text).toLocaleLowerCase('vi')
/** Accents, case and spaces ignored: how close a suggestion is. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, '')

/** Catalogue values for `text`, closest first, at most eight. */
export function suggestFor(text: string, options: readonly string[], chosen: readonly string[]) {
  const wanted = fold(text)
  if (!wanted) return []
  const taken = new Set(chosen.map(key))
  const scored: { label: string; score: number }[] = []
  for (const label of options) {
    if (taken.has(key(label))) continue
    const folded = fold(label)
    const score =
      folded === wanted ? 0 : folded.startsWith(wanted) ? 1 : folded.includes(wanted) ? 2 : -1
    if (score >= 0) scored.push({ label, score })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, TAG_RULES.suggestions)
    .map((s) => s.label)
}

const MESSAGES = {
  length: `Mỗi mục từ ${TAG_RULES.min} đến ${TAG_RULES.max} ký tự.`,
  duplicate: (label: string) => `Đã có “${label}”.`,
  full: `Tối đa ${TAG_RULES.count} mục.`,
} as const

export function TagInput({
  id,
  name,
  tags,
  options,
  onChange,
  placeholder,
  labelledBy,
  error,
  boxClassName,
}: {
  /** The text field's id, for an external <label htmlFor>. */
  id: string
  name: string
  tags: readonly string[]
  /** Canonical labels the catalogue suggests. */
  options: readonly string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  labelledBy?: string
  /** A message from the form (for example "required"), shown with the field. */
  error?: string
  /** The host screen's skin for the control box (its approved field metrics). */
  boxClassName?: string
}) {
  const ids = useId()
  const listId = `${ids}-list`
  const messageId = `${ids}-message`
  const [text, setText] = useState('')
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()

  const shown = open ? suggestFor(text, options, tags) : []
  const full = tags.length >= TAG_RULES.count
  const message = problem ?? error

  function add(raw: string): boolean {
    const label = clean(raw)
    if (!label) return false
    if (tags.some((tag) => key(tag) === key(label))) {
      setProblem(MESSAGES.duplicate(label))
      return false
    }
    if (full) {
      setProblem(MESSAGES.full)
      return false
    }
    // A catalogue value keeps its canonical spelling; free text keeps the member's.
    const canonical = options.find((option) => key(option) === key(label))
    if (!canonical && (label.length < TAG_RULES.min || label.length > TAG_RULES.max)) {
      setProblem(MESSAGES.length)
      return false
    }
    onChange([...tags, canonical ?? label])
    setText('')
    setActive(-1)
    setProblem(undefined)
    return true
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && shown.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % shown.length)
    } else if (event.key === 'ArrowUp' && shown.length > 0) {
      event.preventDefault()
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      add(active >= 0 && shown[active] ? shown[active]! : text)
    } else if (event.key === 'Escape' && shown.length > 0) {
      // Only an open list is closed here; otherwise Escape reaches the dialog / page.
      event.preventDefault()
      setOpen(false)
      setActive(-1)
    } else if (event.key === 'Backspace' && !text && tags.length > 0) {
      onChange(tags.slice(0, -1))
      setProblem(undefined)
    }
  }

  const hint = open && clean(text) && shown.length === 0 && !full
  return (
    <div className={styles.root}>
      <div
        className={boxClassName ? `${styles.box} ${boxClassName}` : styles.box}
        data-invalid={message ? 'true' : undefined}
      >
        {tags.map((tag) => (
          <span key={key(tag)} className={styles.tag} data-tag={tag}>
            {tag}
            <button
              type="button"
              className={styles.remove}
              aria-label={`Bỏ ${tag}`}
              onClick={() => {
                onChange(tags.filter((t) => t !== tag))
                setProblem(undefined)
              }}
            >
              <svg viewBox="0 0 9 9" aria-hidden="true" focusable="false">
                <path d="M1 1l7 7M8 1L1 8" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={id}
          name={name}
          className={styles.input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-labelledby={labelledBy}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          autoComplete="off"
          placeholder={full ? undefined : placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(-1)
            setProblem(undefined)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setActive(-1)
            if (clean(text)) add(text)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul id={listId} role="listbox" className={styles.list} hidden={shown.length === 0}>
        {shown.map((label, i) => (
          <li
            key={label}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={styles.option}
            // Keeps the focus in the field, so choosing does not blur it first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => add(label)}
          >
            {label}
          </li>
        ))}
      </ul>
      {hint ? (
        <p className={styles.hint} aria-live="polite">
          Nhấn Enter để thêm ‘{clean(text)}’
        </p>
      ) : null}
      {message ? (
        <p id={messageId} role="alert" className={styles.message}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
