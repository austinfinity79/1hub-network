# ADMIN-PROD-05-prod06-handoff

**Evidence 21: exact frontend handoff to ADMIN-PROD-06 (Admin / OpsShell integration).** Parent: [ADMIN-PROD-05-qa.md](ADMIN-PROD-05-qa.md). Not started. Design: ADMIN-DESIGN-01 in the existing OpsShell and design system (PD-8); pixel QA in ADMIN-PROD-08.

## Routes, capabilities, APIs
| Route (contract IA) | Shown when the session's `capabilities` hold | APIs (05 §26 – §28) |
|---|---|---|
| `/ops` Admin Home: pending counts per section | any operator capability | the lists' `counts` (`limit=1`): verification `pending`, venture reviews `pending`, feedback `open`, account requests `pending` |
| `/ops/verification` queue + detail | `verification:review` | `GET /ops/verification-requests` (status, organization_id, routed_to, cursor, limit), `GET …/{id}`, `POST …/approve` / `reject` `{version, reason?}` |
| `/ops/ventures` queue + diff | `venture:review` | `GET /ops/venture-reviews` (status, kind, venture_id), `GET …/{id}`, approve / reject; logos at `/media/assets/{id}` |
| `/ops/org/[id]/access` "Phân quyền" tab | `access:delegate` (list 403 hides it) | `GET / POST /ops/organizations/{id}/access`, `…/history`, `…/{grantId}/revoke` |
| `/ops/feedback` queue, detail, weekly summary | `feedback:manage` | `GET /ops/feedback`, `GET …/summary?week=`, `GET / PATCH …/{id}`; screenshots at `/media/assets/{id}` |
| `/ops/categories` six type tabs | `vocabulary:manage` | `GET /ops/categories/{type}`, `PATCH …/{itemId}`, `PUT …/order` |
| `/ops/accounts` requests + actions | `account:administer` | `GET /ops/account-requests` (status, kind), `GET …/{id}`, process / decline; `POST /ops/accounts/{profileId}/{lock,unlock,deactivate,reactivate,soft-delete}` |
| WF03 member detail: "Đề nghị khoá / vô hiệu hoá" | `account:escalate` on that unit | `POST /ops/organizations/{orgId}/members/{profileId}/account-requests` |
Menus are display only: every call re-authorizes on the server. Hide self-actions (target profile = own); the server refuses them anyway.

## States (every screen)
| State | Rendering |
|---|---|
| loading | skeleton rows; buttons disabled while a mutation runs |
| empty | per queue: "Không có yêu cầu chờ xử lý" style copy (copy from ADMIN-DESIGN-01) |
| 401 | the existing session-expired flow |
| 403 | "Bạn không có quyền với mục này" (no data hint) |
| 404 | "Không tìm thấy hoặc ngoài phạm vi" — unknown and foreign ids are identical |
| 409 | "Mục này vừa thay đổi" + reload the detail (stale `version`, already decided, impossible transition) |
| 422 | `fields` mapped to inputs (`invalid`, `too_long`, `required`, `not_accepted`, `not_eligible`, `not_allowed`, `incomplete`) |
| 5xx / network | generic retry; the request id from `x-request-id` for support |

## Interaction rules
- Paging: `page.next_cursor` → "Tải thêm"; never page numbers; filters reset the cursor.
- Decisions send the detail's `version`; every mutation sends an `Idempotency-Key` (one UUID per click) so a retry after a timeout replays.
- Confirm dialogs: approve / reject (optional reason ≤ 500), grant / revoke, every account action. Declining a deletion request (SELF_DELETION or a SOFT_DELETE escalation) requires the reason (≤ 500): prompt for the obligation that blocks it — legal, retention, security or operational (DEC-ADM-PD7.1). The account dialog names the person and the consequence (LOCK: sign-in blocked, sessions ended; DEACTIVATE: profile hidden, unit roles closed; SOFT_DELETE: irreversible in the portal, flagged for deletion — typed confirmation recommended).
- Feedback: filters status, type, priority (incl. "Chưa đặt" = NONE), owner (me / none / anyone), created_from / to; inline owner, priority, status with the NEW → DONE note rule; the week picker drives the summary.
- Categories: inline label edit, archive toggle (absent for VENTURE_STAGE), `in_use` shown, drag-and-drop sends the whole ordered id list.
- Verification / venture detail: identity through discovery (a hidden name shows as "Ẩn danh"); diff tables use `vocabulary` labels.

## Gaps PROD-06 must handle or raise
| Item | Note |
|---|---|
| `/ops` entry | `requireOps` / `OPS_ENTRY` use `network:read`; capability-only grantees (e.g. `verification:review` on a CLB) need entry by any operator capability (contract) |
| `GET /ops/summary` | not built; compose Home counts from the lists or add it with an amendment |
| organization lifecycle APIs | not assigned to any task yet |
| deletion rejection, user side | the decline reason is kept in the audit only (not on the request DTO); WF02-S07 does not show a rejection to the user — PO follow-up |
| owner / user sides | verification requests (S1-UAT-03B), venture submit / save / logo upload (S1-UAT-06), feedback submission (FB-01) |

## Related
- [ADMIN-PROD-05-qa.md](ADMIN-PROD-05-qa.md) · [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md) · [ADMIN-PROD-01-implementation-plan.md](ADMIN-PROD-01-implementation-plan.md)
