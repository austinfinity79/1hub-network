# WF05-PROD-00_runtime-matrices

**WF05-PROD-00 — runtime journey, persistence, lifecycle, ownership and cross-workflow identity**, read from the running build (`f40f70c`, GET probes as member / leader / ops) and the code. Gap IDs refer to the [gap matrix](WF05-PROD-00_gap-matrix.md).

## Journey (runtime)
| # | Step | Route → component | Data | Class |
|---|---|---|---|---|
| 1 | entry | MemberShell foot "Dự án & Startup · Demo" (`lib/member/nav.ts:44-50`); WorkspaceShell "Hồ sơ đăng ký" → `/demo/projects` | — | REAL_RUNTIME, DEMO_ONLY label |
| 2 | S01 list | `/demo/projects` → `ProjectDemoList` (client fetch) | `GET /api/v1/demo/projects` (WF02 `getOwnNetwork` + `listOpenForms`), `GET /me/applications` | REAL_API, PERSISTED, DEMO_ONLY frame |
| 3 | S02 venture | `/demo/projects/:id` (server guard + client read) | WF02 `getVenture` / `getTeam` | REAL_API |
| 4 | project info / team | S02 read only; "Sửa hồ sơ" → `/projects/:id/edit`, "Xem đội" → `/projects/:id/team` (WF02) | canonical venture, ACTIVE members | REAL_API, PERSISTED |
| 5 | programme discovery | S01 "Chương trình đang mở", S02 rows with server eligibility; no member programme page (DEC-W4P-D10) | PUBLISHED programmes with a form | REAL_API |
| 6 | start | `/programmes/:pid/apply`: 0 eligible venture → SUB0 QuickTeam (`POST /ventures`), 1 → form, n → CHOOSE | DB | REAL_API, PERSISTED |
| 7 | form steps | `/projects/:id/applications/:pid?buoc=n` → SUB1, steps from `question.step` | DB form | REAL_API |
| 8 | draft | `POST /applications` on first save (Idempotency-Key), then `PATCH` on blur, every 20 s, on step change | `applications.answers` | PERSISTED (typing not yet saved: NON_PERSISTED, G26) |
| 9 | review / submit | `…/review` → `POST …/submit` (Idempotency-Key) | SUBMITTED + snapshot, one transaction | REAL_API, PERSISTED |
| 10 | submitted | `…/submitted`, read only from the snapshot | snapshot | PERSISTED |
| 11 | return | SUB1 cancel → `/demo/projects/:id` always (G24); SUB3 → `/projects`; old `/demo/projects/:id/applications/:pid` → 307 to member route | — | PARTIAL |

**Fixture / client-only:** no runtime fixture import (WF04 fixtures are test-only), no business data in browser storage, no hard-coded venture / programme id. Remaining demo-only pieces: the "Đặt lại demo" reset that clears a dead key (`project-demo/demo-store.tsx:26-33`, G21), its actor-key plumbing (`read-model.ts:33-36`), the demo notice and labels, the `/demo` route and API namespace (G22).

**What disappears or turns inconsistent?** Refresh: up to 20 s of unsaved typing (G26). Relogin, app restart, DB restart: nothing. Seed re-run on a used DB: the d4 form is overwritten (G20). Programme closed: the application leaves every list (G25); a draft reads with no questions and hidden answers (G11).

## Persistence
| Object / action | UI → API → service → table | Status |
|---|---|---|
| create / edit venture | WF02 editor, SUB0 → `POST / PATCH /ventures` → `lib/venture` → `projects`, `project_domains` | GREEN |
| ownership | `projects.owner_profile_id`, never from the request | GREEN |
| team / members | WF02 team → `/ventures/{id}/team*` → `project_members` | GREEN (invite key G08) |
| programme association | `applications.programme_id` FK → `programmes` | GREEN |
| draft + answers | SUB1 → `POST` / `PATCH /applications` → `applications` | GREEN (G09, G10, G26) |
| submit + submitted state | SUB2 → `POST …/submit` → status + snapshot + trigger | GREEN (DELETE G16) |
| refresh / relogin / restart | server state only; sessions and idempotency in DB | GREEN |
| demo reset | S01 / S02 → nothing persisted | DEMO_ONLY (G21) |

## Lifecycle
| Object | Transition | UI | API / server rule | DB | Retry |
|---|---|---|---|---|---|
| Venture | DRAFT / PRIVATE → ACTIVE / PUBLIC | WF02 publish | owner, five required fields | `ck_projects_draft_private` | repeat returns the same state |
| Venture | → ARCHIVED | none (test SQL only) | no API (DEC-WF02-S05-G3) | label only | — |
| Application | create DRAFT | first save | owner, eligible venture + PUBLISHED form, one active pair | `uq_applications_active_pair` | ON CONFLICT + key |
| Application | incomplete / ready | derived | server `missing` list, re-checked at submit | not stored | — |
| Application | DRAFT → SUBMITTED | SUB2 | owner, row lock, eligibility, required answers | snapshot CHECK, trigger blocks UPDATE | row lock + key |
| Application | after SUBMITTED | read only | 409 on PATCH / submit | trigger (UPDATE only, G16) | — |
No lifecycle exists only in the frontend.

## RBAC / ownership
| Actor | Venture create / edit | Team mutation | Application create | Application read / update / submit |
|---|---|---|---|---|
| owner | yes | yes | yes | yes |
| member EDIT / VIEW | edit (EDIT) / 403 | 403 | 403 | 404 |
| other signed-in user | 404 | 404 | 404 | 404 |
| guest | 401 | 401 | 401 | 401 |
| leader / admin (operator) | 404 | 404 | 404 | 404; no operator read (HD-A13) |
No IDOR, owner injection, status injection or role spoofing found; the WF05 UAT covers 8 actors with and without spoofed headers.

## WF02 ↔ WF05 identity
| Surface | Source | Id |
|---|---|---|
| `/me`, `/projects` | `listOwnVentures` | `projects.id` |
| `/demo/projects`, `/demo/projects/:id` | `getOwnNetwork`, `getVenture`, `getTeam` | `projects.id` |
| `/programmes/:id/apply`, application pages | `getApplyOptions`, `getApplicationContext` | `applications.venture_id` → `projects.id` |
No copy-on-enter (a draft reads the live venture; the snapshot is written once at submit, `snapshot.venture.id = venture_id` 7 / 7); SUB0 calls the canonical `POST /ventures`; owner relation canonical (16 / 16 rows).

## WF04 ↔ WF05 application
| Check | Result |
|---|---|
| same programme / application ids, one storage | yes: `applications` → `programmes` FK; WF04 has no application table |
| same form, versioned | yes: `question_set_version` + snapshot version |
| form locked once applied | yes (`PUT …/registration` 409), but racy at create (G10) |
| WF05 invents no programme data | yes: reads PUBLISHED only; member `GET /programmes/{id}` 404 |
| CLOSED / unpublished | create 404; PATCH / submit 409; SUBMITTED reads its snapshot; draft display G11 |

## Related
- [WF05-PROD-00_gap-audit.md](WF05-PROD-00_gap-audit.md) · [WF05-PROD-00_gap-matrix.md](WF05-PROD-00_gap-matrix.md) · [WF05-PROD-00_api-db-security.md](WF05-PROD-00_api-db-security.md)
