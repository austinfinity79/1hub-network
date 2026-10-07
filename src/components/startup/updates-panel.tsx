'use client'

import { useState, type FormEvent } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { UpdateDTO, UpdatesDTO } from '@/lib/startup/updates'

import styles from './startup.module.css'

/**
 * THAO-06 Cập nhật (DEC-THAO-SP-D3, D10: DM10 cards). Newest first, plain
 * text (React escapes it; line breaks kept by CSS). An owner or editor writes,
 * edits and deletes; deleting asks for a second, inline confirmation (no
 * browser dialog). No author, reaction, comment or notification.
 */

export const UPDATE_LIMIT = 2000

const WHEN = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function Post({
  post,
  canEdit,
  busy,
  onEdit,
  onDelete,
}: {
  post: UpdateDTO
  canEdit: boolean
  busy: boolean
  onEdit: (id: string, body: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [confirm, setConfirm] = useState(false)
  return (
    <li className={styles.post} data-update="">
      <p className={styles.postMeta}>
        <time dateTime={post.published_at}>{WHEN.format(new Date(post.published_at))}</time>
        {post.edited ? <span> · đã chỉnh sửa</span> : null}
      </p>
      {editing ? (
        <form
          className={styles.composer}
          onSubmit={async (e) => {
            e.preventDefault()
            if (await onEdit(post.id, draft)) setEditing(false)
          }}
        >
          <textarea
            value={draft}
            maxLength={UPDATE_LIMIT}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Sửa nội dung cập nhật"
            rows={4}
          />
          <div className={styles.composerBar}>
            <span>
              {draft.length}/{UPDATE_LIMIT}
            </span>
            <button type="button" className={styles.textButton} onClick={() => setEditing(false)}>
              Huỷ
            </button>
            <button type="submit" className={styles.primary} disabled={busy}>
              Lưu
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.postBody}>{post.body}</p>
      )}
      {canEdit && !editing ? (
        <div className={styles.postActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setDraft(post.body)
              setEditing(true)
            }}
          >
            Sửa
          </button>
          {confirm ? (
            <>
              <button
                type="button"
                className={styles.textDanger}
                disabled={busy}
                onClick={() => onDelete(post.id)}
              >
                Xác nhận xoá
              </button>
              <button type="button" className={styles.textButton} onClick={() => setConfirm(false)}>
                Huỷ
              </button>
            </>
          ) : (
            <button type="button" className={styles.textButton} onClick={() => setConfirm(true)}>
              Xoá
            </button>
          )}
        </div>
      ) : null}
    </li>
  )
}

export function UpdatesPanel({ slug, initial }: { slug: string; initial: UpdatesDTO }) {
  const [data, setData] = useState(initial)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const base = `/startups/${encodeURIComponent(slug)}/updates`

  async function run(task: () => Promise<UpdatesDTO>, ok: string): Promise<boolean> {
    setBusy(true)
    setMessage(null)
    try {
      setData(await task())
      setMessage(ok)
      return true
    } catch {
      setMessage('Chưa lưu được, vui lòng thử lại.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function post(e: FormEvent) {
    e.preventDefault()
    if (
      await run(
        () => apiRequest(base, { method: 'POST', body: { body: draft } }),
        'Đã đăng cập nhật.',
      )
    )
      setDraft('')
  }

  return (
    <div className={styles.tabBody} data-section="updates">
      {data.can_edit ? (
        <section
          className={styles.card}
          aria-labelledby="sp-update-form"
          data-section="update-editor"
        >
          <h2 id="sp-update-form" className={styles.label}>
            Đăng cập nhật
          </h2>
          <form className={styles.composer} onSubmit={post}>
            <textarea
              value={draft}
              maxLength={UPDATE_LIMIT}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Chia sẻ tiến độ của startup…"
              aria-label="Nội dung cập nhật"
              rows={4}
              required
            />
            <div className={styles.composerBar}>
              <span>
                {draft.length}/{UPDATE_LIMIT}
              </span>
              <button type="submit" className={styles.primary} disabled={busy || !draft.trim()}>
                Đăng cập nhật
              </button>
            </div>
          </form>
          {message ? (
            <p className={styles.note} role="status">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.block} aria-labelledby="sp-updates">
        <h2 id="sp-updates" className={styles.label}>
          Cập nhật
        </h2>
        {data.updates.length ? (
          <ol className={styles.posts}>
            {data.updates.map((u) => (
              <Post
                key={u.id}
                post={u}
                canEdit={data.can_edit}
                busy={busy}
                onEdit={(id, body) =>
                  run(
                    () => apiRequest(`${base}/${id}`, { method: 'PATCH', body: { body } }),
                    'Đã lưu chỉnh sửa.',
                  )
                }
                onDelete={(id) =>
                  run(() => apiRequest(`${base}/${id}`, { method: 'DELETE' }), 'Đã xoá cập nhật.')
                }
              />
            ))}
          </ol>
        ) : (
          <p className={styles.empty} data-state="empty">
            Startup chưa có cập nhật nào.
          </p>
        )}
      </section>
    </div>
  )
}
