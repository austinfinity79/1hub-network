'use client'

import { useState, type FormEvent } from 'react'

import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import type { MetricsDTO, MetricUnit, MetricView } from '@/lib/startup/metrics'

import styles from './startup.module.css'

/**
 * THAO-06 Chỉ số (DEC-THAO-SP-D2, D10: DM10 figures / cards). Every viewer sees
 * the metrics the server sent (PUBLIC only, unless they edit). An editor also
 * gets the visibility of each metric and the form for a quarterly value. A
 * save is a new record: an earlier value of the quarter stays in the history.
 * Numbers come from the venture's own entries only; nothing is a placeholder.
 */

const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

export function formatMetric(value: number, unit: MetricUnit): string {
  return unit === 'vnd' ? `${NUMBER.format(value)} ₫` : NUMBER.format(value)
}

const period = (p: { year: number; quarter: number }) => `Q${p.quarter}/${p.year}`

const REASONS: Record<string, string> = {
  future: 'Quý này chưa bắt đầu.',
  negative: 'Giá trị không được âm.',
  precision: 'Tối đa hai chữ số thập phân.',
  too_large: 'Giá trị quá lớn.',
  invalid: 'Giá trị chưa hợp lệ.',
  unknown: 'Chỉ số không có trong danh mục.',
}

function MetricCard({
  metric,
  canEdit,
  onVisibility,
  busy,
}: {
  metric: MetricView
  canEdit: boolean
  onVisibility: (m: MetricView) => void
  busy: boolean
}) {
  const [current, ...older] = metric.history
  return (
    <li className={styles.metricCard} data-metric={metric.slug}>
      <div className={styles.metricHead}>
        <h3>{metric.label}</h3>
        {canEdit && metric.visibility ? (
          <span
            className={metric.visibility === 'PUBLIC' ? styles.tagPublic : styles.tagPrivate}
            data-visibility={metric.visibility}
          >
            {metric.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}
          </span>
        ) : null}
      </div>
      {current ? (
        <>
          <p className={styles.metricValue}>{formatMetric(current.value, metric.unit)}</p>
          <p className={styles.metricPeriod}>{period(current)}</p>
        </>
      ) : (
        <p className={styles.metricPeriod}>Chưa có giá trị</p>
      )}
      {older.length ? (
        <ol className={styles.history} aria-label={`Lịch sử ${metric.label}`}>
          {older.map((h) => (
            <li key={period(h)}>
              <span>{period(h)}</span>
              <strong>{formatMetric(h.value, metric.unit)}</strong>
            </li>
          ))}
        </ol>
      ) : null}
      {canEdit && metric.visibility ? (
        <button
          type="button"
          className={styles.textButton}
          disabled={busy}
          onClick={() => onVisibility(metric)}
        >
          {metric.visibility === 'PUBLIC' ? 'Chuyển sang riêng tư' : 'Công khai chỉ số'}
        </button>
      ) : null}
    </li>
  )
}

export function MetricsPanel({
  slug,
  initial,
  thisYear,
  thisQuarter,
}: {
  slug: string
  initial: MetricsDTO
  thisYear: number
  thisQuarter: number
}) {
  const [data, setData] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const first = data.catalogue?.[0]?.slug ?? ''
  const [metric, setMetric] = useState(first)
  const [year, setYear] = useState(thisYear)
  const [quarter, setQuarter] = useState(thisQuarter)
  const [value, setValue] = useState('')
  const base = `/startups/${encodeURIComponent(slug)}/metrics`

  async function run(task: () => Promise<MetricsDTO>, ok: string) {
    setBusy(true)
    setMessage(null)
    try {
      setData(await task())
      setMessage(ok)
      return true
    } catch (error) {
      const reason = isApiError(error) ? Object.values(error.fields ?? {})[0] : undefined
      setMessage((reason && REASONS[reason]) ?? 'Chưa lưu được, vui lòng thử lại.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const number = Number(value.replace(',', '.'))
    const done = await run(
      () =>
        apiRequest<MetricsDTO>(base, {
          method: 'POST',
          body: { metric, year, quarter, value: number },
        }),
      'Đã lưu chỉ số.',
    )
    if (done) setValue('')
  }

  const toggle = (m: MetricView) =>
    run(
      () =>
        apiRequest<MetricsDTO>(`${base}/${encodeURIComponent(m.slug)}`, {
          method: 'PATCH',
          body: { visibility: m.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' },
        }),
      'Đã cập nhật chế độ hiển thị.',
    )

  const years = Array.from({ length: 5 }, (_, i) => thisYear - i)
  return (
    <div className={styles.tabBody} data-section="metrics">
      <section className={styles.block} aria-labelledby="sp-metrics">
        <h2 id="sp-metrics" className={styles.label}>
          Chỉ số theo quý
        </h2>
        {data.metrics.length ? (
          <ul className={styles.metricGrid} role="list">
            {data.metrics.map((m) => (
              <MetricCard
                key={m.slug}
                metric={m}
                canEdit={data.can_edit}
                onVisibility={toggle}
                busy={busy}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.empty} data-state="empty">
            {data.can_edit
              ? 'Chưa có chỉ số nào. Thêm giá trị đầu tiên bên dưới.'
              : 'Startup chưa công bố chỉ số nào.'}
          </p>
        )}
      </section>

      {data.can_edit && data.catalogue ? (
        <section
          className={styles.card}
          aria-labelledby="sp-metric-form"
          data-section="metric-editor"
        >
          <h2 id="sp-metric-form" className={styles.label}>
            Thêm giá trị
          </h2>
          <form className={styles.editor} onSubmit={save}>
            <label>
              Chỉ số
              <select value={metric} onChange={(e) => setMetric(e.target.value)} required>
                {data.catalogue.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Năm
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quý
              <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Giá trị
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </label>
            <button type="submit" className={styles.primary} disabled={busy}>
              Lưu chỉ số
            </button>
          </form>
          <p className={styles.note}>
            Chỉ số mới ở chế độ riêng tư cho đến khi bạn công khai. Mỗi lần lưu là một bản ghi mới;
            giá trị trước đó của quý vẫn được giữ trong lịch sử.
          </p>
          {message ? (
            <p className={styles.note} role="status">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
