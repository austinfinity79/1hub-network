# Claude Task Report

## 1. Task
- Task ID / name: WF02-S06 — Venture Team / Members (resolve G9, implement)
- Status: **DONE — LOCAL REVIEW**. The final WF02 screen: WF02 is 7 / 7.
- Mode: LOCAL REVIEW. WF03 and WF05 UI were not implemented. Nothing was pushed.

## 2. Decisions
| Item | Result |
|---|---|
| G1–G8 | DEC-WF02-S06-G1..G8 (human approved, unchanged) |
| G9 | DEC-WF02-S06-G9: repair the fixture; the migration never infers legacy meaning. OPEN-WF02-S06 → CLOSED; remaining human decisions: 0 |
| D1–D3 | API shape, reused frozen error codes, UI (for review) |
| Matrix §E | `venture:read` / `venture:team_manage` routes listed; accept/decline need no capability (recipient email match only) |

## 3. Migration 008 (`008_p0_venture_team.sql`)
- Guard: any `project_members` row that is not an open ACTIVE row aborts the whole transaction with a clear message; `PENDING_APPROVAL` is never mapped.
- Enum `team_membership_state` = PENDING_CONFIRMATION, ACTIVE, LEFT, REMOVED, REJECTED; the `state` column is converted, and `record_state` is left untouched.
- `profile_id` and `joined_at` become nullable. New columns: `invite_email_normalized`, `invited_by_profile_id`, `invited_at`, `updated_at`.
- One CHECK per state (pending, active, left, removed, rejected) plus a normalised-email CHECK. Partial unique indexes on ACTIVE (project, profile) and PENDING (project, email).

| Proof | Result |
|---|---|
| Fresh DB 001→008 + seed | PASS |
| Rerun (migrate + seed) | 008 skipped; `project_members` md5 identical |
| Upgrade 001→007 with the legacy fixture → 008 | **Aborts loudly**; no ledger row; column type unchanged |
| Upgrade 001→007 with canonical ACTIVE rows → 008 | PASS; row values preserved |
| CHECK / unique probes (14 cases) | All invalid shapes and duplicates rejected; valid shapes accepted |
| Old migrations / design-reference | Untouched |

## 4. Seed (G9)
- The owner `'Founder'` member row is removed; the owner is `projects.owner_profile_id` only.
- `…-0002` is now PENDING_CONFIRMATION: `profile_id NULL`, `leader@example.test`, inviter = owner, fixed `invited_at`, role `Contributor`. It is not auto-linked.
- The seed stays deterministic and idempotent.
- Only the disposable local dev DB (`localhost:55432`) was reset. No deployment, PRE-UAT or remote DB was touched.

## 5. Behaviour
| Area | Result |
|---|---|
| Invite | Owner only; email normalised; 201 PENDING_CONFIRMATION; no account lookup (no enumeration); the owner's own email → 422; duplicate / parallel duplicate → one row, others 409 |
| Accept | Explicit; only the signed-in account whose email matches; PENDING → ACTIVE atomically (profile, `joined_at`, email cleared); repeated or concurrent accept → one row, one event; already-ACTIVE recipient → 409; another user → 404 |
| Decline | PENDING → REJECTED, `ended_at`; idempotent; no membership |
| Cancel / remove | Owner DELETE: PENDING or ACTIVE → REMOVED with `ended_at`; rows are never deleted; closed rows → 409 |
| Role edit | Owner, ACTIVE rows only; display text ≤ 100; grants nothing (a member labelled "Owner" still gets 403) |
| Owner protection | The owner has no row; legacy owner rows are hidden and give 404; `owner_profile_id` is never written |
| Privacy (G8) | A member sees the owner and ACTIVE members only; no email, profile/account ids or metadata in the DTO |
| Audit (G7) | 5 codes, only on real transitions; payload = `project_id` + state |
| UI | Owner table + "Tuỳ chọn" menu (Sửa vai trò, Gỡ khỏi đội) + "Huỷ lời mời"; invite form that states that no email is sent; member read-only view; recipient panel (Nhận lời mời / Từ chối) |

## 6. Tests / build
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 157 passed |
| DB | 281 passed (+22 team, +1 enum); 3 clean reruns |
| Playwright full | 358 passed, 24 skipped, 0 failed (WF01 specs incl. screen pixel, WF01 UAT, WF02 T00/S01–S07, M0-ENTRY-01, SEC-OBS-01, shell, console health) |
| Restart proof | App + PostgreSQL restarted: owner DTO, member DTO and page rows identical; 0 email/token/cookie lines in logs; fixture removed |

## 7. Visual QA (1440×900 DPR1)
| Segment | Outside-text drift |
|---|---|
| Editor header | 0 |
| Team table | 16 px (raster) |
| Note cards | 0 |
| Full page (H12) | 0 unexpected below the reference |

Intentional: "Gửi lại" (P0-SCOPE, G3); "Đổi quyền" → "Tuỳ chọn" and pending "Huỷ lời mời" (CONTRACT, G4/G6); "Quyền" without tiers and owner "Tham gia từ" "—" (CONTRACT, G4/G5); "Ba mức quyền" card text (P0-SCOPE); history note copy (COPY).

## 8. Deviations / notes
- Harness: the shell evidence moved to `/ops/network` because no member placeholder is left. The baseline `shell-member-placeholder.png` was replaced by `shell-ops-placeholder.png`. Harness only; `design-reference/final` is untouched.
- Flaky assertion fixed: the first final DB run had 1 intermittent failure in the accept-vs-cancel race test. It was not reproduced in 20+ reruns. Most likely cause: `audit_events.created_at` is the transaction start time, not commit order, so the test's order assumption was wrong. The assertion now compares event sets. Product behaviour is unchanged.
- Added copy (invite note, menu labels, notes, recipient panel) awaits PO review (D3).
- Blocking gaps: 0.

## 9. Git
- Branch: `main`; start HEAD `755f2a7` (checked again before the commit)
- Implementation commit: `4dc50b5`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `d54cc8d`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Related
- [WF02_S06_PREFLIGHT_AUDIT.md](../WF02_S06_PREFLIGHT_AUDIT.md) — preflight
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](../WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [P0_STATUS.md](../P0_STATUS.md) — status
