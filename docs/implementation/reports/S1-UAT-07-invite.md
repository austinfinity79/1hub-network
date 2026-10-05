# S1-UAT-07 invite

Sprint 1 team invitations: e-mail invitation brought to US-02.11 (7-day expiry, re-send, limits), invitation by link added in parallel (US-02.12, FB-18), invitation detail in the workspace shell (FB-14). Decisions [DEC-S1I](../../decisions/DECISION_LOG.md#dec-s1i) on the PO / SA freeze D1–D5; contract [05 amendment A15](../../architecture/05_API_CONTRACT_P0_v1.0.md). Tests and git: [S1-UAT-07-evidence](S1-UAT-07-evidence.md).

## Preflight
| Check | Result |
|---|---|
| Base | `6ab6cbc` (S1-UAT-05 docs); worktree `../1hub-network-s1-invite`, branch `feat/s1-uat-07-invite`; HEAD unchanged by others until commit |
| Isolated DB | `hubnetwork_s1invite`; every reset with exported `DATABASE_URL` checked by `case`, runner prints the target; shared `hubnetwork_p0` stays 017 |
| Secret | `INVITE_LINK_SECRET` only in the gitignored `.env.local`; `.env.example` names it with no value |

## Audit before the change
| Item | Before |
|---|---|
| EMAIL_INVITE_EXPIRY_GAP | YES — `project_members` PENDING_CONFIRMATION had no expiry (DEC-PDF-D2 "no expiry exists") |
| Duplicate pending address | refused `409`; no re-send |
| Current member's address | a second invitation was created and e-mailed; only its acceptance was refused |
| Link invitation | drawn inert ("Tính năng giai đoạn sau"), no storage, no endpoint (D-T1 / DEC-PDF-D2) |
| FB-14 | `team-invitation.tsx` under `EditorHeader`, not the workspace shell |

## Migration 020 (D1)
| Object | Why |
|---|---|
| `project_members.invite_expires_at` + `ck_pm_invite_expiry` | EMAIL_INVITE_SCHEMA_CHANGE: the minimum for "hết hạn sau 7 ngày" on the existing row; pending rows backfilled now + 7 days, so nothing already sent is lost |
| `venture_invite_links` | logical `TeamInviteLink(token, expires_at, revoked_at)`; `venture_*` follows the API's name for a `projects` row (FK `project_id`); stores `token_hash` only (CHECK 64 hex); unique hash; partial unique index = one unrevoked link per venture |
| Not created | no InvitationV2, no second membership model: a link join is an ordinary ACTIVE `project_members` row |

## Token (D2)
HMAC-SHA256(secret, "venture-invite-link:v1:" + link id), first 160 bits (≥ 128 required). The DB keeps SHA-256(token); lookups compare the hash in an indexed equality. The owner can copy the same link again because the server recomputes it — the DB alone cannot. Never in logs, audit JSON or error bodies. Without the secret the feature answers `INVITE_LINK_UNAVAILABLE` — **deploy prerequisite**.

## Behaviour
| Area | Result |
|---|---|
| Owner link | "Sao chép link" ensures the live link, copies `origin + /moi/{slug}-{token}`; "Đã sao chép" only after the clipboard resolved, 2.5 s; refusal → alert + read-only selected field. "Tạo lại link" revokes and creates in one transaction (venture row locked first) |
| Receiver `/moi/:code` (WF02-S09) | guest → `/auth?redirect=…` → back; onboarding first if needed; card: team name, "Thành viên · quyền Xem", expiry, "Tham gia"; opening joins nothing; owner / member → team page |
| Join | empty body only (any field → 422); headcount ≤ 20 under the venture lock; the receiver's own pending e-mail invitation is closed (REMOVED) so nobody counts twice; unique index makes double / concurrent joins one row |
| Invalid | unknown, malformed, expired, regenerated, archived → one `INVITE_LINK_INVALID` card naming nothing |
| EMAIL_INVITE_RESEND_BEHAVIOR | same row, `expires_at` = now + 7 days, role / level unchanged, e-mail re-sent, 3 sends per address per 24 h, notice "Đã gửi lại lời mời; hạn mới 7 ngày." |
| E-mail limits | current member → "Người này đã ở trong đội."; ≤ 10 addresses per send; ≤ 20 people (pending counted); expired rows not accepted, listed or counted; team table shows "Đã hết hạn" |
| FB-14 | detail inside `WorkspaceShell` (5-item sidebar, "Dự án & startup" active), ME7 eyebrow / title / card, "Từ chối" · "Chấp nhận" |

## Deviations (PO review)
| Item | Disposition |
|---|---|
| US-02.11 AC1 "Chưa có tài khoản HUB" row note | not shown (PO 05/10, privacy: DEC-WF02-S06, DEC-S1A-D11) → PASS_WITH_DEVIATION |
| UAT role "Cố vấn" | not added; three roles kept (PO 05/10, D4) |
| PRJ2 link row text | board shows an address; build says what the link grants, since no link exists until the owner asks (no link minted on view). INTENTIONAL, recorded in `wf02-l2-revision` |
| Old 20-pending bound (DEC-L2R-D8, `too_many_pending`) | replaced by 20 people per team (`TEAM_FULL`), A15 §32.2 |

## Related
- [S1-UAT-07-evidence](S1-UAT-07-evidence.md)
- [DECISION_LOG DEC-S1I](../../decisions/DECISION_LOG.md#dec-s1i)
- [S1-UAT-05-profile](S1-UAT-05-profile.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
