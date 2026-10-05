import { ApiError } from '@/lib/api/errors'
import {
  FEEDBACK_LIMITS,
  SENDER_FEEDBACK_TYPES,
  parseGuestEmail,
  type FeedbackType,
} from '@/lib/admin/feedback'
import type { Executor } from '@/lib/db/client'
import { query } from '@/lib/db/client'
import { removeAsset, saveAvatarAsset, sniffAvatarType } from '@/lib/media/avatar-storage'

import { feedbackRoute, feedbackSurface } from './surfaces'

/**
 * S1-UAT-02 — FB-01 submission (US-X.01; API 05 §6 `POST /feedback`), into the
 * ONE canonical store `feedback_submissions` (migration 017, read by the Admin
 * feedback queue). No new table, no new upload store.
 *
 *   type        BUG · UX · FEATURE (Báo lỗi · Góp ý trải nghiệm · Đề xuất tính
 *               năng); OTHER stays the admin's reclassification bucket.
 *   content     required, 1 … 2000 characters after trimming.
 *   screenshot  optional, PNG / JPEG / WebP sniffed from the bytes, ≤ 5 MB, in
 *               the existing media asset store; served to feedback managers
 *               only, for 90 days (ADMIN-PROD-05).
 *   e-mail      a guest's optional reply address only; a signed-in sender is
 *               its account (the DB check `ck_feedback_guest_email`).
 *   identity    `account_id` / `profile_id` come from the session, never the body.
 *   context     route (path only), screen / workflow / step DERIVED from the
 *               route, browser / os / device / user_agent from the request's
 *               User-Agent header, viewport and locale as reported. Nothing
 *               else the client sends is kept: no query, cookie, token, header
 *               or form value.
 *   status      NEW (the queue's initial state); the answer reads RECEIVED (§6).
 *   limit       "Quá 10 góp ý/giờ → chặn" (US-X.01): per account, or per
 *               client address for a guest.
 */

export const FEEDBACK_PER_HOUR = 10

export type FeedbackInput = {
  type: FeedbackType
  content: string
  guestEmail: string | null
  route: string | null
  viewport: string | null
  locale: string | null
  screenshot: { bytes: Uint8Array; contentType: 'image/png' | 'image/jpeg' | 'image/webp' } | null
}

export type FeedbackAccepted = { id: string; status: 'RECEIVED'; submitted_at: string }

const invalid = (fields: Record<string, string>) =>
  new ApiError('FEEDBACK_VALIDATION_FAILED', 422, 'Some fields are invalid.', fields)

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '')

/** Validates a multipart body. Returns the clean input or throws 422 with every failing field. */
export async function parseFeedbackForm(form: FormData, signedIn: boolean): Promise<FeedbackInput> {
  const fields: Record<string, string> = {}

  const type = text(form.get('type'))
  if (!type) fields.type = 'required'
  else if (!(SENDER_FEEDBACK_TYPES as readonly string[]).includes(type)) fields.type = 'invalid'

  const content = text(form.get('content'))
  if (!content.trim()) fields.content = 'required'
  else if (content.length > FEEDBACK_LIMITS.content) fields.content = 'too_long'

  // A signed-in sender's address is its account: any e-mail field is ignored.
  const email = signedIn ? null : parseGuestEmail(form.get('email') ?? undefined)
  if (email === 'invalid') fields.email = 'invalid'

  let screenshot: FeedbackInput['screenshot'] = null
  const file = form.get('screenshot')
  if (file instanceof Blob && file.size > 0) {
    if (file.size > FEEDBACK_LIMITS.screenshotBytes) fields.screenshot = 'too_large'
    else {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const contentType = sniffAvatarType(bytes)
      if (!contentType) fields.screenshot = 'unsupported'
      else screenshot = { bytes, contentType }
    }
  }

  if (Object.keys(fields).length > 0) throw invalid(fields)

  const short = (value: FormDataEntryValue | null, max: number) => {
    const v = text(value).trim()
    return v && v.length <= max ? v : null
  }
  return {
    type: type as FeedbackType,
    content: content.trim(),
    guestEmail: email === 'invalid' ? null : email,
    route: feedbackRoute(form.get('route')),
    viewport: /^\d{2,5}x\d{2,5}$/.test(text(form.get('viewport')))
      ? text(form.get('viewport'))
      : null,
    locale: short(form.get('locale'), 35),
    screenshot,
  }
}

/** Coarse browser / OS / device from the request's own User-Agent header. */
export function describeUserAgent(ua: string): { browser: string; os: string; device: string } {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Other'
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other'
  const device = /iPad|Tablet/.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|Android/.test(ua)
      ? 'mobile'
      : 'desktop'
  return { browser, os, device }
}

/** The stored context: only FEEDBACK_CONTEXT_KEYS, every value derived or bounded. */
export function buildFeedbackContext(
  input: FeedbackInput,
  userAgent: string,
): Record<string, string> {
  const context: Record<string, string> = {}
  if (input.route) {
    context.route = input.route
    const surface = feedbackSurface(input.route)
    if (surface) {
      context.screen = surface.screen
      context.workflow = surface.workflow
      if (surface.step) context.step = surface.step
    }
  }
  const ua = userAgent.slice(0, 300)
  if (ua) Object.assign(context, describeUserAgent(ua), { user_agent: ua })
  if (input.viewport) context.viewport = input.viewport
  if (input.locale) context.locale = input.locale
  return context
}

declare global {
  var __hubFeedbackGuestHits: Map<string, number[]> | undefined
}
const guestHits = () => (globalThis.__hubFeedbackGuestHits ??= new Map<string, number[]>())
const HOUR_MS = 60 * 60 * 1000

const limited = () =>
  new ApiError('FEEDBACK_RATE_LIMITED', 429, 'Too many feedback messages. Try again later.')

/** "Quá 10 góp ý/giờ → chặn": an account by its stored rows, a guest by its address. */
export async function assertFeedbackRate(
  accountId: string | null,
  ip: string | null,
  now = Date.now(),
): Promise<void> {
  if (accountId) {
    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM feedback_submissions
        WHERE account_id = $1 AND created_at > now() - interval '1 hour'`,
      [accountId],
    )
    if ((row?.n ?? 0) >= FEEDBACK_PER_HOUR) throw limited()
    return
  }
  if (!ip) return
  const hits = (guestHits().get(ip) ?? []).filter((t) => now - t < HOUR_MS)
  if (hits.length >= FEEDBACK_PER_HOUR) {
    guestHits().set(ip, hits)
    throw limited()
  }
  hits.push(now)
  guestHits().set(ip, hits)
}

/**
 * Stores one submission, in the caller's transaction (the idempotency claim
 * commits with it). The screenshot file is written first and removed again if
 * the row does not commit, so no orphan asset survives a failure.
 */
export async function storeFeedback(
  exec: Executor,
  sender: { accountId: string | null },
  input: FeedbackInput,
  context: Record<string, string>,
): Promise<FeedbackAccepted> {
  const [profile] = sender.accountId
    ? await exec<{ id: string }>(`SELECT id::text FROM individual_profiles WHERE account_id = $1`, [
        sender.accountId,
      ])
    : []

  const assetId = input.screenshot
    ? await saveAvatarAsset(
        sender.accountId ?? 'guest',
        input.screenshot.bytes,
        input.screenshot.contentType,
      )
    : null
  try {
    const [row] = await exec<{ id: string; created_at: Date }>(
      `INSERT INTO feedback_submissions
         (account_id, profile_id, body, type, context, screenshot_asset_id, guest_email, status)
       VALUES ($1, $2, $3, $4::feedback_type, $5::jsonb, $6, $7, 'NEW')
       RETURNING id::text, created_at`,
      [
        sender.accountId,
        profile?.id ?? null,
        input.content,
        input.type,
        JSON.stringify(context),
        assetId,
        sender.accountId ? null : input.guestEmail,
      ],
    )
    return { id: `fb_${row!.id}`, status: 'RECEIVED', submitted_at: row!.created_at.toISOString() }
  } catch (error) {
    if (assetId) await removeAsset(assetId)
    throw error
  }
}
