# ADMIN-PORTAL-00-gap-audit

**ADMIN-PORTAL-00 — Admin Portal scope / architecture / dependency audit (AUDIT, docs only).** What exists, what the business has actually asked for, who can act, and how an Admin Portal relates to `/ops` and auth. Scope and authority: [ADMIN-PORTAL-00-scope-matrix.md](ADMIN-PORTAL-00-scope-matrix.md); blocked items, Sprint1 and PO decisions: [ADMIN-PORTAL-00-dependency-map.md](ADMIN-PORTAL-00-dependency-map.md).

**Sources.** SOT, architecture and `DECISION_LOG` in this repo; runtime at `1ed6010`; the business Sprint1 documents `~/Downloads/1hubnetwork_uat_sprint1_wf01_wf02.md` (UAT), `1hubnetwork_feedback_sprint1.md` (FB), `1hubnetwork_business_uat_scope_for_thao.md` (SCOPE). The backlog ids ADMIN-BIZ-01/02, ADMIN-DATA-01, ADMIN-FEEDBACK-01, BIZ-/DATA-/OPS-CLARIFY-* exist only in this task's contract: no file or branch holds them.

## Preflight (evidence 1)
| Check | Result |
|---|---|
| repo / HEAD | `/Users/thanosvn/workspace/hubnetwork`, `feat/wf06-prod-hardening` at `1ed6010`; tree clean except `AGENTS.md` |
| origin/main · production | `78f21f2` · `78f21f2` |
| WF04 / WF05 / WF06 | `f40f70c`, `8c1fbd6` / `5199e07`, `d113d14` / `1ed6010` in HEAD: PROD HARDENED, NOT DEPLOYED |
| branches | other lanes are separate worktrees (`docs/ai-ingestion-contract` = Sprint1 AI import contract, user-side; mobile shell, library layout, about, legal, deploy); no admin branch; no conflict |
| Admin Portal runtime | none: no `/admin` route, no admin API; operator runtime is `/ops` and `/demo/programmes` |

## Existing admin-like capability (evidence 2)
| Capability | Where | Class |
|---|---|---|
| network list (actor's orgs; all for PLATFORM_ADMIN) | `/ops/network`, `GET /ops/organizations` | REAL_RUNTIME |
| org dashboard, members, member detail | `/ops/org/[id]…`, `GET …/dashboard`, `…/members` | REAL_RUNTIME |
| membership request review (approve / reject) | `PATCH …/memberships/{id}`, audited | REAL_RUNTIME |
| HUB declaration review (onboarding `hub_declaration` rows; PLATFORM only, D6B) | same member review, per org; no cross-org queue | PARTIAL |
| leadership create / end | `…/leadership` | REAL_RUNTIME |
| org profile (name, description only) | `/ops/org/[id]/profile`, `PATCH …/profile` | PARTIAL |
| org relationships (parent: create / close) | `/ops/org/[id]/settings`, `…/relationships` | REAL_RUNTIME |
| events (create, edit, publish, cancel) | `/ops/org/[id]/events`, `/ops/events/*` | REAL_RUNTIME |
| programmes / challenges (WF04) | `/demo/programmes/*` (production-backed), `/api/v1/programmes*`; `/ops/org/[id]/programmes` is a placeholder | REAL_RUNTIME (naming debt) |
| org create / publish / archive, role assignment, vocabulary write, legal publish, homepage / CTA content, feedback, audit read, account block, deletion processing, application review, venture moderation | — (seed, migration or code only) | NO_RUNTIME |
| dev login, e-mail outbox, pixel / primitives pages | `/dev/*` behind `ENABLE_DEV_ROUTES` | INTERNAL_TOOL |
| Library / homepage sample activities | static arrays labelled "Dữ liệu minh hoạ" | DEMO (static) |
Data already canonical but unused by any operator: `feedback_submissions` (NEW / REVIEWED / CLOSED), `audit_events` (written, never read), `account_deletion_requests`, `user_accounts.status BLOCKED` (never set).

## Admin needs map (evidence 3)
| Need | Evidence | Verdict |
|---|---|---|
| ADMIN-BIZ-01 role verification queue | UAT 658–678 (per-unit request, PENDING / VERIFIED / NOT_VERIFIED, reason, resubmit); D6B DL:1482 (Platform Admin only); DL:1484 queue deferred | real need; routing conflict → [dependency map](ADMIN-PORTAL-00-dependency-map.md) |
| ADMIN-BIZ-02 venture review & publish queue | UAT 873, 1644–1669 (PENDING_REVIEW, reject reason, ADM6 out of sprint 1) vs DEC-PDF-D1 (self-publish, no moderation) | real need, BLOCKED by decision |
| ADMIN-DATA-01 organization governance | FB 113–121 (13 Chapters / 55 CLB, seed); DL:761 (no create in WF03); ADM15 FUTURE (DL:1330) | edit / relationships exist; role assignment missing; create / archive later |
| role assignment (leaders, "người phụ trách") | roles only via seed SQL; UAT 664 needs a responsible person per unit; DL:1482 HUB ops act through assignments | real need (found, not in backlog) |
| controlled vocabulary (country, province, domain…) | FRZ:207 + A03:113 (Platform Admin owns lifecycle, no write path); UAT 403–405 catalog; WF06 DOMAIN slug map | real need |
| ADMIN-FEEDBACK-01 triage + weekly summary | FB-01 (popup, types, screenshot, guest e-mail); table exists, API none; A05 `GET /ops/feedback` contracted | real need after Sprint1 submission |
| homepage / About / featured activities | FB 14–16, 51–56: PO supplies content and a sheet; no source asks for editing by an admin | no CMS need evidenced |
| legal / static content | DL:1368-1369: new versions = PO decision + migration + file | stays release-managed |
| navigation / action registry | UAT 779, 1517 (hide, no dead link); typed `Cta` actions + `FROZEN_ROUTES` + no-dead-control specs exist | code registry suffices; no runtime registry |
| search / filter config | SCOPE 197–200 open question only | no evidence |
| account lock / deletion processing | UAT 209, 1239; DL:545 (no processing defined); DL:756 G3 (no account admin) | gap, owner undefined → PO |
| audit log view | UAT 1792 ("có log từ chối" = logged, not viewed); DL:821 card out of P0 | later |

## Actors (evidence 4)
| Actor (task term) | Canonical | Scope | Approval authority today | Delegation |
|---|---|---|---|---|
| Admin Master | `PLATFORM_ADMIN` (only platform role, DL:1482: no separate HUB ops role) | platform | all ten capabilities; HUB declarations; no other user's profile edit, no impersonation, no PII bypass (CAP D3, G4) | grants nothing today (no API) |
| Data / Content Admin | none | — | — | not created: no evidence, no CMS need |
| HUB Tổng BĐH / Chapter BĐH | `HUB_COMMUNITY_LEADER` on the HUB / Chapter org | that org only, no inheritance (DL:764) | members, join requests (not declarations), leadership, events, relationships, programmes | undefined (L27 handover FUTURE) |
| CLB delegated manager | `HUB_COMMUNITY_LEADER` on the CLB | that CLB | as above | assigned by seed only |
A LeadershipRecord (BĐH title) grants nothing (DL:759); only a RoleAssignment does.

## Auth and `/ops` relationship (evidence 20, 21)
| Topic | Finding / proposal |
|---|---|
| authentication | reuse `user_accounts` + sessions + `role_assignments`; no separate admin user store; Sprint1 auth replacement (password + Google, UAT 1853) applies to admins unchanged |
| authorisation | server-side capability per call (CAP §D); route guards are convenience only |
| post-login | unchanged resolver (onboarding → `/me`); operators keep the member-nav entry "Vận hành tổ chức" → `/ops/network` (`src/lib/member/nav.ts` `OPS_ENTRY`); optional later: PLATFORM_ADMIN lands on `/ops/network` |
| `/ops` vs Admin Portal | **coexist in one shell**: platform-scoped sections added to the existing `OpsShell`, visible only with platform capabilities; no rewrite of WF03 ops tools; `/demo/programmes` stays, linked from ops nav later (naming debt) |

## Related
- [ADMIN-PORTAL-00-scope-matrix.md](ADMIN-PORTAL-00-scope-matrix.md) · [ADMIN-PORTAL-00-dependency-map.md](ADMIN-PORTAL-00-dependency-map.md) · [WF06-PROD-06_production-readiness.md](WF06-PROD-06_production-readiness.md)
