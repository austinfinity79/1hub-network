# ADMIN-PROD-05-feedback-categories

**ADMIN-PROD-05 — Feedback / category / account operations APIs (IMPLEMENT, no frontend).** Evidence 1 – 9. Contract: [05 §28, A11](../../architecture/05_API_CONTRACT_P0_v1.0.md) · rules [DEC-ADM-R12…R16](../../decisions/DECISION_LOG.md#dec-adm-r12). Companions: [accounts](ADMIN-PROD-05-accounts.md) · [QA](ADMIN-PROD-05-qa.md) · [PROD-06 handoff](ADMIN-PROD-05-prod06-handoff.md).

## 1. Preflight
`feat/admin-portal` at `58692aa` (ADMIN-PROD-04; the task's "5b692aa" is no commit — a typo for it), migrations 001 – 017 intact, tree clean except `AGENTS.md`, HEAD unchanged until the commit; origin/main and production `78f21f2`; no other branch writes feedback or account requests (the only matches elsewhere are the empty-table test list); Sprint1 FB-01 has no code.

## 2. Feedback lifecycle (PD-5, R12)
NEW → IN_REVIEW → DONE; NEW → DONE only with a resolution note (the contract's duplicate / spam path); DONE is final (no reopen); no other status. Invalid moves 409; the same status again is no change (no audit).

## 3. Queue / detail — `GET /ops/feedback`, `GET …/{id}`
`feedback:manage`, PLATFORM_ADMIN only (no wider scope in the contract): list 403 and every id 404 for anyone else. Filters status, type, priority (incl. NONE), owner (profile id / `none`), created_from / created_to (Vietnam days), keyset cursor, limit 1 – 50; bad values 422; newest first; `counts.open`. Item: type, status, priority, owner, sender kind (+ discovery name), excerpt, has_screenshot, times — never the guest e-mail. Detail: full content, sender (member: profile id + discovery name; guest: the optional e-mail), context reduced to operator keys (route, screen, step, workflow, browser, os, device, viewport, locale, user_agent — anything else stays stored, unshown), screenshot view, priority, owner, status, resolution note, history.

## 4. Assignment / priority / status — `PATCH …/{id}`
`{ type?, priority? | null, owner_profile_id? | null, status?, resolution_note? | null }`; authority checked before the body is read (anyone else 404, never a 422 hint); strict keys; the owner must be an ACTIVE `feedback:manage` holder (else 422 `not_eligible`); note ≤ 2,000. Row locked; each real change audited in the transaction: `FEEDBACK_STATUS_CHANGED`, `FEEDBACK_PRIORITY_CHANGED`, `FEEDBACK_ASSIGNED`, `FEEDBACK_UPDATED` (type, `resolution_changed` flag) — codes and ids only, never text; `updated_at` stamped.

## 5. Screenshot retention (90 days, R13)
`expires_at` = submission + 90 days, returned in the detail. The media route serves a screenshot only to feedback managers and only before that instant — not even to its uploader (avatar rules unchanged). One statement (`SCREENSHOT_RETENTION_SQL`) clears the reference, sets `screenshot_deleted_at` and returns the file, bounded and `SKIP LOCKED`; files are removed inside the transaction, never one still used elsewhere (avatar, logo, proposed logo, another feedback). It runs on every queue read (the idempotency store's pattern) and from `scripts/admin/feedback-retention.mjs` (same statement, test-enforced; prints a count only) for a daily cron — scheduling it on the VPS is an operations step, not done here. Nothing is retained silently: access ends exactly at 90 days, the file at the next run.

## 6. Guest e-mail
Optional; `parseGuestEmail` (shared with FB-01): blank → none, else a plausible address ≤ 254 or 422 `invalid`; no account needed; the DB keeps it for guests only (017 check). Shown only in the manager detail; never in lists, audit, logs or any public path.

## 7. Weekly summary — `GET /ops/feedback/summary?week=YYYY-Www`
ISO week, Monday 00:00 Vietnam time (default: the current week; an impossible week such as 2025-W53 → 422): `total`, `by_type` (technical_bug = BUG, ux, feature_request = FEATURE, other) × open / closed, `by_priority` (+ NONE), `by_owner` (+ unassigned). Read only; no e-mail, Slack or dashboard.

## 8. Categories — `GET /ops/categories/{type}`, `PATCH …/{itemId}`, `PUT …/order`
`vocabulary:manage`, PLATFORM_ADMIN only. The six existing types only (unknown → 404); per item: code, label, sort_order, status, `in_use`. PATCH label (≤ 200), sort_order (0 – 100,000), status ACTIVE / ARCHIVED; VENTURE_STAGE label and order only (status → 422 `not_allowed`). PUT order: every item of the type exactly once → 10, 20, 30…, all rows locked in id order, so two reorders serialize. Not built (task: "only"): item creation (the contract allowed it), deletion (never). Audit `VOCABULARY_ITEM_UPDATED` / `_ARCHIVED` / `_ACTIVATED` (the task's CATEGORY_* names mapped, R14).

## 9. Referential safety
Archiving writes only the item's status. Every foreign key into `vocabulary_items` (profile region / country / domains / skills / specializations, venture region / stage / domains — the eight, all counted by `in_use`) keeps pointing at it; labels still resolve for existing rows (test: a public venture keeps its archived sector in the Library); `assertSelectable` refuses only NEW selections. No delete endpoint, so no dangling key is possible.

## Related
- [ADMIN-PROD-05-accounts.md](ADMIN-PROD-05-accounts.md) · [ADMIN-PROD-05-qa.md](ADMIN-PROD-05-qa.md) · [ADMIN-PROD-05-prod06-handoff.md](ADMIN-PROD-05-prod06-handoff.md) · [ADMIN-PROD-04-prod05-handoff.md](ADMIN-PROD-04-prod05-handoff.md)
